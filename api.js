/* JSON API: logins, sessions and one route per game action.
 * Sessions are a random token in an HttpOnly cookie; only its SHA-256 is stored in the database.
 * The student or teacher id always comes from the session, never from the request body. */
const crypto = require("crypto");
const { hashPassword, verifyPassword } = require("./db/auth");
const { HttpError } = require("./db/store");

const COOKIE = "grounded_sid", DAYS = 30;
const RAW = Symbol("raw response already sent");
const sha = t => crypto.createHash("sha256").update(t).digest("hex");

function createApi({ db, store, hasAI, aiCheck, retakes, trustProxy, secureCookies }) {
  const q1 = (sql, ...a) => db.get(sql, ...a);
  const run = (sql, ...a) => db.run(sql, ...a);

  /* --- small helpers --- */
  const ipOf = req => (trustProxy && String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress || "?";
  /* Rate limits live in the database (table rate_hits): a serverless function has no memory that lasts between requests,
   * and two requests may be served by different instances. */
  const sweep = async () => { if (Math.random() < 0.02) await run("DELETE FROM rate_hits WHERE ts < ?", Date.now() - 10 * 60000); };   // 10 min is the longest window in use
  async function limited(key, max, windowMs) {                // sliding window
    const now = Date.now();
    await run("INSERT INTO rate_hits(key,ts) VALUES (?,?)", key, now);
    const r = await q1("SELECT COUNT(*) n FROM rate_hits WHERE key=? AND ts>?", key, now - windowMs);
    await sweep();
    return r.n > max;
  }
  /* Failed-login limits. A whole class shares one school IP address, so successful logins must never count:
   * only wrong passwords do. One account is locked after 10 misses in 5 minutes; one IP after 100 misses in 10. */
  const misses = async (key, windowMs) => (await q1("SELECT COUNT(*) n FROM rate_hits WHERE key=? AND ts>?", key, Date.now() - windowMs)).n;
  const lockedOut = async (idKey, ip) => { const [a, b] = await Promise.all([misses("id:" + idKey, 5 * 60000), misses("ip:" + ip, 10 * 60000)]); return a >= 10 || b >= 100; };
  const failLogin = async (idKey, ip) => { const now = Date.now(); await db.batch([["INSERT INTO rate_hits(key,ts) VALUES (?,?)", "id:" + idKey, now], ["INSERT INTO rate_hits(key,ts) VALUES (?,?)", "ip:" + ip, now]]); };
  const json = (res, code, obj, headers = {}) => { res.writeHead(code, Object.assign({ "Content-Type": "application/json", "Cache-Control": "no-store" }, headers)); res.end(JSON.stringify(obj)); };
  /* The JSON body. On Vercel the platform has already read the stream and offers it as req.body; with plain Node
   * (npm start) we read the stream ourselves. Either way the size limit applies. */
  const readBody = (req, max) => new Promise((resolve, reject) => {
    const fail = e => reject(e instanceof HttpError ? e : new HttpError(400, "Bad JSON"));
    if (Number(req.headers["content-length"] || 0) > max) return reject(new HttpError(413, "Too large"));
    const parse = txt => { try { resolve(txt ? JSON.parse(txt) : {}); } catch (e) { fail(e); } };
    const pre = req.body;                                       // undefined under plain Node; parsed by the platform on Vercel
    if (pre !== undefined) {
      if (Buffer.isBuffer(pre)) return pre.length > max ? reject(new HttpError(413, "Too large")) : parse(pre.toString("utf8"));
      if (typeof pre === "string") return pre.length > max ? reject(new HttpError(413, "Too large")) : parse(pre);
      return resolve(pre && typeof pre === "object" ? pre : {});
    }
    let size = 0; const chunks = [];
    req.on("data", c => { size += c.length; if (size > max) { reject(new HttpError(413, "Too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => parse(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
  const cookies = req => Object.fromEntries(String(req.headers.cookie || "").split(";").map(c => c.trim().split(/=(.*)/s).slice(0, 2)).filter(p => p[0]));
  const setCookie = (token, maxAge) => COOKIE + "=" + token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge + (secureCookies ? "; Secure" : "");

  async function startSession(res, kind, userId) {
    const token = crypto.randomBytes(32).toString("base64url");
    if (Math.random() < 0.05) await run("DELETE FROM sessions WHERE expires_at < datetime('now')");   // tidy up now and then
    await run("INSERT INTO sessions(token_hash,kind,user_id,expires_at) VALUES (?,?,?,datetime('now','+" + DAYS + " days'))", sha(token), kind, userId);
    return { "Set-Cookie": setCookie(token, DAYS * 86400) };
  }
  async function sessionOf(req) {
    const t = cookies(req)[COOKIE]; if (!t) return null;
    const s = await q1("SELECT kind,user_id FROM sessions WHERE token_hash=? AND expires_at > datetime('now')", sha(t));
    return s ? { kind: s.kind, id: s.user_id, hash: sha(t) } : null;
  }
  const needStudent = s => { if (!s || s.kind !== "student") throw new HttpError(401, "Please log in"); return s.id; };
  const needTeacher = async s => {
    if (!s || s.kind !== "user") throw new HttpError(401, "Please log in");
    if (!await q1("SELECT 1 x FROM users WHERE id=? AND role='teacher'", s.id)) throw new HttpError(403, "Teachers only");
    return s.id;
  };
  const text = (v, max) => String(v ?? "").trim().slice(0, max);

  /* --- the AI photo check, tied to the logged-in student's current project --- */
  // The latest result per student and project waits in the table pending_checks until Submit.
  const CHECK_TTL = 15 * 60 * 1000;
  async function photoCheck(sid, body) {
    const pid = text(body.projectId, 20), local = body.local || {};
    if (await limited("check:" + sid, 20, 60000)) throw new HttpError(429, "Slow down");
    let r;
    if (local.verdict === "fail") r = { verdict: "fail", confidence: Math.max(0, Math.min(1, Number(local.confidence) || 0)), feedback: text(local.feedback, 300), stage: "local", mode: "demo" };
    else if (hasAI) {
      const b64 = String(body.image || "");
      if (!/^\/9j\/[A-Za-z0-9+/=]+$/.test(b64) || b64.length * 0.75 > 600 * 1024) throw new HttpError(400, "Expected a JPEG under 600 kB");
      if (!await store.q1("SELECT 1 x FROM student_projects WHERE student_id=? AND project_id=? AND steps_done=4", sid, pid)) throw new HttpError(400, "Finish the earlier steps first");
      try { r = Object.assign(await aiCheck(pid, b64), { stage: "ai" }); }
      catch (e) {   // outage, rate limit or bad key: never auto-pass, let the teacher decide
        r = { verdict: "unsure", confidence: 0, feedback: "The photo checker is busy, so your teacher will take a look.", stage: "ai-down", mode: "demo" };
      }
    } else {
      // No API key: the on-device verdict stands (demo mode). It is only as trustworthy as the browser.
      if (!["pass", "unsure"].includes(local.verdict)) throw new HttpError(400, "No check result");
      r = { verdict: local.verdict, confidence: Math.max(0, Math.min(1, Number(local.confidence) || 0)), feedback: text(local.feedback, 300), stage: "local-only", mode: "demo" };
    }
    const out = await store.recordCheck(sid, pid, r, retakes);
    // Every photo the student can submit (pass or unsure) is kept with the pending check and saved to the database at Submit,
    // so the teacher can see it. A photo that fails the check is never submitted, so it is never kept.
    const b64 = String(body.image || ""), image = out.verdict !== "fail" && /^\/9j\/[A-Za-z0-9+/=]+$/.test(b64) && b64.length * 0.75 <= 600 * 1024 ? Buffer.from(b64, "base64") : null;
    if (out.verdict !== "fail") await run("INSERT INTO pending_checks(student_id,project_id,ts,result,jpeg) VALUES (?,?,?,?,?) ON CONFLICT(student_id,project_id) DO UPDATE SET ts=excluded.ts, result=excluded.result, jpeg=excluded.jpeg", sid, pid, Date.now(), JSON.stringify(out), image);
    else await run("DELETE FROM pending_checks WHERE student_id=? AND project_id=?", sid, pid);
    return out;
  }

  /* --- routes: [method, path] -> handler(ctx) returning JSON --- */
  const stu = ctx => store.studentState(ctx.sid);
  const R = {
    "POST /api/login": async ({ body, req, res }) => {
      const email = text(body.email, 200), idKey = "u:" + email.toLowerCase();
      if (await lockedOut(idKey, ipOf(req))) throw new HttpError(429, "Too many wrong tries. Wait a few minutes.");
      const u = await q1("SELECT id,role,password_hash FROM users WHERE email=?", email);
      const ok = u ? verifyPassword(String(body.password || ""), u.password_hash) : (verifyPassword("x", "scrypt$00$00"), false);
      if (!ok || u.role !== body.role) { await failLogin(idKey, ipOf(req)); throw new HttpError(401, "That email or password is not right."); }
      return { headers: await startSession(res, "user", u.id), body: u.role === "teacher" ? await store.teacherData(u.id) : { user: { role: "coffeebot", name: (await q1("SELECT name FROM users WHERE id=?", u.id)).name } } };
    },
    "POST /api/student/login": async ({ body, req, res }) => {
      const code = text(body.code, 40), name = text(body.name, 30), idKey = "s:" + code.toLowerCase() + "|" + name.toLowerCase();
      if (await lockedOut(idKey, ipOf(req))) throw new HttpError(429, "Too many wrong tries. Wait a few minutes.");
      const s = await q1("SELECT s.id,s.password_hash FROM students s JOIN classes c ON c.id=s.class_id WHERE c.code=? AND s.name=?", code, name);
      if (!(s ? verifyPassword(String(body.password || ""), s.password_hash) : (verifyPassword("x", "scrypt$00$00"), false))) { await failLogin(idKey, ipOf(req)); throw new HttpError(401, "Check your class code, name and password."); }
      await store.touch(s.id);
      return { headers: await startSession(res, "student", s.id), body: await store.studentState(s.id) };
    },
    "POST /api/student/signup": async ({ body, req, res }) => {
      if (await limited("signup:" + ipOf(req), 120, 10 * 60000)) throw new HttpError(429, "Too many tries. Wait a few minutes.");   // generous: a class signs up from one school IP
      const name = text(body.name, 30), pw = String(body.password || "");
      const cls = await q1("SELECT id FROM classes WHERE code=?", text(body.code, 40));
      if (!cls) throw new HttpError(404, "That class code was not found.");
      if (!name) throw new HttpError(400, "Please enter your name.");
      if (pw.length < 6 || pw.length > 100) throw new HttpError(400, "Choose a password of at least 6 characters.");
      if (await q1("SELECT 1 x FROM students WHERE class_id=? AND name=? COLLATE NOCASE", cls.id, name)) throw new HttpError(409, "Someone in this class already uses that name. Log in, or add your initial to your name.");
      const hash = hashPassword(pw);
      const sid = await db.tx(async t => {                       // all or nothing: never leave a half-made student behind
        const id = (await t.run("INSERT INTO students(class_id,name,password_hash) VALUES (?,?,?)", cls.id, name, hash)).lastInsertRowid;
        await t.run("INSERT INTO buddies VALUES (?,0)", id);
        return id;
      });
      await store.touch(sid);
      return { headers: await startSession(res, "student", sid), body: await store.studentState(sid) };
    },
    "POST /api/logout": async ({ session, res }) => {
      if (session) await run("DELETE FROM sessions WHERE token_hash=?", session.hash);
      return { headers: { "Set-Cookie": setCookie("", 0) }, body: { ok: true } };
    },
    "GET /api/me": async ({ session }) => {
      if (!session) return { user: null };
      if (session.kind === "student") return store.studentState(session.id);
      const u = await q1("SELECT role,name FROM users WHERE id=?", session.id);
      return u.role === "teacher" ? store.teacherData(session.id) : { user: { role: "coffeebot", name: u.name } };
    },
    /* students */
    "GET /api/state": async ctx => stu(Object.assign(ctx, { sid: needStudent(ctx.session) })),
    "POST /api/begin": async ctx => { ctx.sid = needStudent(ctx.session); await store.begin(ctx.sid, text(ctx.body.pid, 20)); return stu(ctx); },
    "POST /api/step": async ctx => { ctx.sid = needStudent(ctx.session); await store.step(ctx.sid, text(ctx.body.pid, 20), Number(ctx.body.i)); return stu(ctx); },
    "POST /api/check": async ctx => { ctx.sid = needStudent(ctx.session); return photoCheck(ctx.sid, ctx.body); },
    "POST /api/submit": async ctx => {
      ctx.sid = needStudent(ctx.session);
      const pid = text(ctx.body.pid, 20), row = await q1("SELECT ts,result,jpeg FROM pending_checks WHERE student_id=? AND project_id=?", ctx.sid, pid);
      if (!row || Date.now() - row.ts > CHECK_TTL) throw new HttpError(400, "Please check your photo again.");
      await run("DELETE FROM pending_checks WHERE student_id=? AND project_id=?", ctx.sid, pid);   // one submit per check
      const result = await store.submit(ctx.sid, pid, JSON.parse(row.result), row.jpeg ? Buffer.from(row.jpeg) : null);
      return Object.assign(await stu(ctx), { result });
    },
    "POST /api/quiz": async ctx => { ctx.sid = needStudent(ctx.session); const r = await store.answerQuiz(ctx.sid, Number(ctx.body.pick)); return Object.assign(await stu(ctx), { result: r }); },
    "POST /api/buy": async ctx => { ctx.sid = needStudent(ctx.session); await store.buy(ctx.sid, text(ctx.body.id, 30)); return stu(ctx); },
    "POST /api/plant": async ctx => { ctx.sid = needStudent(ctx.session); await store.plant(ctx.sid, text(ctx.body.pid, 20), text(ctx.body.species, 30)); return stu(ctx); },
    "POST /api/equip": async ctx => { ctx.sid = needStudent(ctx.session); await store.equip(ctx.sid, text(ctx.body.id, 30), !!ctx.body.on); return stu(ctx); },
    /* teachers */
    "GET /api/teacher": async ctx => store.teacherData(await needTeacher(ctx.session)),
    "GET /api/teacher/photo": async ({ session, res, url }) => {
      const jpeg = await store.classPhoto(await needTeacher(session), text(url.searchParams.get("id"), 20));   // only photos from this teacher's own class
      if (!jpeg) throw new HttpError(404, "No photo stored");
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "Content-Length": jpeg.length,
        "Content-Security-Policy": "default-src 'none'; sandbox", "X-Content-Type-Options": "nosniff" });
      res.end(jpeg);
      return RAW;
    },
    "POST /api/teacher/review": async ctx => { const t = await needTeacher(ctx.session); await store.review(t, text(ctx.body.id, 20), ctx.body.v === "ok" ? "ok" : "redo"); return store.teacherData(t); },
    "POST /api/teacher/class-code": async ctx => { const t = await needTeacher(ctx.session); await store.setClassCode(t, ctx.body.code); return store.teacherData(t); },
    "POST /api/teacher/mission": async ctx => { const t = await needTeacher(ctx.session); await store.addMission(t, ctx.body.name, Number(ctx.body.goal)); return store.teacherData(t); },
    "POST /api/teacher/reset-password": async ctx => {
      const t = await needTeacher(ctx.session), pw = String(ctx.body.password || "");
      if (pw.length < 6 || pw.length > 100) throw new HttpError(400, "Choose a password of at least 6 characters.");
      const s = await store.studentInTeacherClass(t, Number(ctx.body.studentId));
      await run("UPDATE students SET password_hash=? WHERE id=?", hashPassword(pw), s.id);
      await run("DELETE FROM sessions WHERE kind='student' AND user_id=?", s.id);       // log them out everywhere
      return store.teacherData(t);
    }
  };

  /* Returns true if the request was an API call and has been answered. */
  return async function handle(req, res, url) {
    if (!url.pathname.startsWith("/api/")) return false;
    const route = R[req.method + " " + url.pathname];
    if (!route) return false;                                  // /api/demo and friends are handled by server.js
    try {
      if (req.method === "POST") {
        const origin = req.headers.origin;                      // block cross-site form posts
        if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, "Bad origin");
        if (!/^application\/json/.test(req.headers["content-type"] || "")) throw new HttpError(415, "JSON only");
      }
      const body = req.method === "POST" ? await readBody(req, url.pathname === "/api/check" ? 1.2e6 : 5000) : {};
      const out = await route({ req, res, url, body, session: await sessionOf(req) });
      if (out === RAW) return true;
      if (out && out.headers) json(res, 200, out.body, out.headers); else json(res, 200, out);
    } catch (e) {
      if (e instanceof HttpError) return json(res, e.status, { error: e.message }), true;
      console.error(req.method + " " + url.pathname + " failed:", e);
      json(res, 500, { error: "Something went wrong" });
    }
    return true;
  };
}

module.exports = { createApi };
