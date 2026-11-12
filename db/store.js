/* All game rules and queries. The browser only asks for things; the server decides what counts.
 * Every function takes a student or class id that the API layer has already taken from the login session.
 * Everything is async: the database is remote (Turso) when deployed. Independent queries run in parallel with
 * Promise.all, and per-student loops are folded into one query, so a page load is a few round trips, not hundreds. */
const { realDay, dayToDate, dateToDay } = require("./clock");

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (msg, status = 400) => { throw new HttpError(status, msg); };

function createStore(db, D, opts = {}) {
  const demo = opts.demo || (() => ({ day: 0, evening: false }));   // demo clock, set from the terminal (README); loaded per request
  const PROJECTS = Object.fromEntries(D.projects.map(p => [p.id, p]));
  const ACC = Object.fromEntries(D.accessories.map(a => [a.id, a]));
  const q1 = (sql, ...a) => db.get(sql, ...a);
  const qa = (sql, ...a) => db.all(sql, ...a);
  const run = (sql, ...a) => db.run(sql, ...a);
  const tx = fn => db.tx(fn);                                    // fn gets a transaction handle t with get/all/run

  const today = () => realDay() + demo().day;
  const level = pts => D.levels.reduce((c, l) => (pts >= l.at ? l : c), D.levels[0]);
  const ledger = (ex, sid, kind, delta, reason, pid = null) => ex.run("INSERT INTO ledger(student_id,kind,delta,reason,project_id) VALUES (?,?,?,?,?)", sid, kind, delta, reason, pid);
  const sum = async (sid, kind) => (await q1("SELECT COALESCE(SUM(delta),0) n FROM ledger WHERE student_id=? AND kind=?", sid, kind)).n;
  const touch = sid => run("UPDATE students SET last_active=? WHERE id=?", dayToDate(today()), sid);
  const todaysQuiz = () => { const n = D.quiz.length, i = ((today() % n) + n) % n; return { i, q: D.quiz[i] }; };

  /* ----- per-student facts ----- */
  /* A student's quiz history in ONE query: the last quiz day (a new student's first quiz is due, so their "last" is the
   * day before they joined) and the streak (cached, and shown as 0 once a day has been missed). */
  async function quizFacts(sid) {
    const r = await q1("SELECT (SELECT MAX(quiz_date) FROM quiz_answers WHERE student_id=?) d, (SELECT substr(created_at,1,10) FROM students WHERE id=?) c, COALESCE((SELECT streak FROM buddies WHERE student_id=?),0) streak", sid, sid, sid);
    const last = r.d ? dateToDay(r.d) : dateToDay(r.c) - 1;
    return { last, streak: r.streak, now: today() - last >= 2 ? 0 : r.streak };
  }

  const NOT_PENDING = "NOT EXISTS (SELECT 1 FROM photo_submissions ps WHERE ps.student_id=sp.student_id AND ps.project_id=sp.project_id AND ps.status='pending')";
  const verifiedProjects = async sid => (await q1("SELECT COUNT(*) n FROM student_projects sp WHERE student_id=? AND steps_done=5 AND " + NOT_PENDING, sid)).n;

  /* ----- class-level views ----- */
  async function missions(classId) {
    const [steps, projs, list] = await Promise.all([
      q1("SELECT COALESCE(SUM(steps_done),0) n FROM student_projects WHERE student_id IN (SELECT id FROM students WHERE class_id=?)", classId),
      q1("SELECT COUNT(*) n FROM student_projects sp JOIN students s ON s.id=sp.student_id WHERE s.class_id=? AND sp.steps_done=5 AND " + NOT_PENDING, classId),
      qa("SELECT id,name,goal,unit FROM missions WHERE class_id=? ORDER BY id", classId)
    ]);
    return list.map(m => {
      const cur = m.unit === "steps" ? steps.n : projs.n;
      return { id: "m" + m.id, name: m.name, goal: m.goal, unit: m.unit === "steps" ? "steps" : "projects verified", cur: Math.min(cur, m.goal), done: cur >= m.goal };
    });
  }

  async function roster(classId, meId = null) {
    const day = today();
    const [pendingRows, progRows, students] = await Promise.all([
      qa("SELECT student_id||':'||project_id k FROM photo_submissions WHERE status='pending' AND student_id IN (SELECT id FROM students WHERE class_id=?)", classId),
      qa("SELECT student_id,project_id,steps_done FROM student_projects WHERE student_id IN (SELECT id FROM students WHERE class_id=?)", classId),
      // one row per student with the quiz facts the streak needs, instead of a few queries per student
      qa("SELECT s.id,s.name,s.last_active,substr(s.created_at,1,10) joined, (SELECT MAX(quiz_date) FROM quiz_answers q WHERE q.student_id=s.id) lastq, COALESCE((SELECT streak FROM buddies b WHERE b.student_id=s.id),0) streak FROM students s WHERE s.class_id=? ORDER BY s.name COLLATE NOCASE", classId)
    ]);
    const pending = new Set(pendingRows.map(r => r.k)), prog = {};
    progRows.forEach(r => (prog[r.student_id] ||= {})[r.project_id] = r.steps_done);
    return students.map(s => {
      const status = {};
      D.projects.forEach(p => {
        const n = (prog[s.id] || {})[p.id];
        status[p.id] = n === undefined ? "none" : n < 5 ? "started" : pending.has(s.id + ":" + p.id) ? "sent" : "verified";
      });
      const last = s.lastq ? dateToDay(s.lastq) : dateToDay(s.joined) - 1;
      return { id: s.id, name: s.name, you: s.id === meId, status, streak: day - last >= 2 ? 0 : s.streak, lastDays: s.last_active ? Math.max(0, day - dateToDay(s.last_active)) : 99 };
    });
  }

  /* ----- student state sent to the browser after every action ----- */
  async function studentState(sid) {
    const s = await q1("SELECT s.id,s.name,s.class_id,c.name cname,c.code,sc.name sname FROM students s JOIN classes c ON c.id=s.class_id JOIN schools sc ON sc.id=c.school_id WHERE s.id=?", sid);
    const [totals, projRows, accRows, qf, pick, rosterList, missionList, plantableList, gardenRows, schoolRows] = await Promise.all([
      qa("SELECT kind, COALESCE(SUM(delta),0) n FROM ledger WHERE student_id=? GROUP BY kind", sid),
      qa("SELECT project_id,steps_done,fails FROM student_projects WHERE student_id=?", sid),
      qa("SELECT accessory_id,equipped FROM student_accessories WHERE student_id=?", sid),
      quizFacts(sid),
      q1("SELECT pick_idx p, question_id qid FROM quiz_answers WHERE student_id=? AND quiz_date=?", sid, dayToDate(today())),
      roster(s.class_id, sid), missions(s.class_id), plantable(sid),
      qa("SELECT gp.id,gp.student_id,s.name,gp.species,gp.project_id,gp.planted_day FROM garden_plants gp JOIN students s ON s.id=gp.student_id WHERE s.class_id=? ORDER BY gp.planted_day,gp.id", s.class_id),
      qa("SELECT c.name cls, gp.species, gp.planted_day FROM garden_plants gp JOIN students s ON s.id=gp.student_id JOIN classes c ON c.id=s.class_id WHERE c.school_id=(SELECT school_id FROM classes WHERE id=?) AND c.id<>? ORDER BY gp.planted_day,gp.id", s.class_id, s.class_id)
    ]);
    const n = k => (totals.find(t => t.kind === k) || { n: 0 }).n;
    const progress = {}, fails = {}, owned = [], equipped = {};
    projRows.forEach(r => { progress[r.project_id] = r.steps_done; if (r.fails) fails[r.project_id] = r.fails; });
    accRows.forEach(r => {
      const a = ACC[r.accessory_id]; if (!a) return;
      if (a.how === "buy") owned.push(a.id);
      if (r.equipped) equipped[a.slot] = a.id;
    });
    return {
      user: { role: "student", name: s.name },
      cls: { name: s.cname, code: s.code, school: s.sname },
      today: today(), evening: !!demo().evening, token: demo().token || "", demoDay: demo().day,
      points: n("points"), beans: n("beans"), streak: qf.streak,
      lastQuizDay: qf.last, quizPick: pick ? pick.p : null, quizQ: pick ? pick.qid - 1 : null, progress, fails, owned, equipped,
      roster: rosterList, missions: missionList,
      plantable: plantableList,                       // finished projects that still need a plant
      garden: gardenRows.map(r => ({ id: r.id, who: r.name, you: r.student_id === sid, species: r.species, project: PROJECTS[r.project_id] ? PROJECTS[r.project_id].name : r.project_id, stage: plantStage(r.planted_day) })),
      schoolGarden: schoolRows.map(r => ({ cls: r.cls, species: r.species, stage: plantStage(r.planted_day) }))   // other classes, no names
    };
  }

  async function teacherData(userId) {
    const [u, c] = await Promise.all([
      q1("SELECT id,name FROM users WHERE id=? AND role='teacher'", userId),
      q1("SELECT c.id,c.name,c.code,sc.name school FROM classes c JOIN schools sc ON sc.id=c.school_id WHERE c.teacher_id=? ORDER BY c.id LIMIT 1", userId)
    ]);
    const base = { user: { role: "teacher", name: u.name }, today: today(), evening: !!demo().evening, token: demo().token || "", demoDay: demo().day };
    if (!c) return Object.assign(base, { cls: null, roster: [], flags: [], photos: [], missions: [], quiz7: [0, 0, 0, 0, 0, 0, 0] });
    const flag = r => ({ id: "f" + r.id, student: r.student, project: PROJECTS[r.project_id].name, pid: r.project_id, pts: PROJECTS[r.project_id].pts, note: r.note || "Needs a teacher's look", status: r.status, hasPhoto: !!r.has_photo, reviewed: r.reviewed_by ? (r.status === "approved" ? "ok" : "redo") : null });
    const t0 = today() - 6;
    const [flagRows, photoRows, quizRows, rosterList, missionList] = await Promise.all([
      qa("SELECT ps.id,ps.project_id,ps.note,ps.status,ps.reviewed_by,s.name student,EXISTS(SELECT 1 FROM photo_images i WHERE i.submission_id=ps.id) has_photo FROM photo_submissions ps JOIN students s ON s.id=ps.student_id WHERE s.class_id=? AND (ps.status='pending' OR ps.reviewed_by IS NOT NULL) ORDER BY ps.id DESC", c.id),
      // every photo the class has submitted, newest first (the images themselves load one by one from /api/teacher/photo)
      qa("SELECT ps.id,ps.project_id,ps.verdict,ps.status,substr(ps.created_at,1,10) date,s.name student FROM photo_submissions ps JOIN students s ON s.id=ps.student_id WHERE s.class_id=? AND EXISTS (SELECT 1 FROM photo_images i WHERE i.submission_id=ps.id) ORDER BY ps.id DESC LIMIT 300", c.id),
      qa("SELECT quiz_date d, COUNT(*) n, COALESCE(SUM(correct),0) ok FROM quiz_answers WHERE quiz_date BETWEEN ? AND ? AND student_id IN (SELECT id FROM students WHERE class_id=?) GROUP BY quiz_date", dayToDate(t0), dayToDate(today()), c.id),
      roster(c.id), missions(c.id)
    ]);
    const byDate = Object.fromEntries(quizRows.map(r => [r.d, r]));
    const quiz7 = [];
    for (let k = 6; k >= 0; k--) { const r = byDate[dayToDate(today() - k)]; quiz7.push(r && r.n ? Math.round(r.ok / r.n * 100) : 0); }
    return Object.assign(base, {
      cls: { id: c.id, name: c.name, code: c.code, school: c.school }, roster: rosterList, flags: flagRows.map(flag), missions: missionList, quiz7,
      photos: photoRows.map(r => ({ id: "f" + r.id, student: r.student, project: PROJECTS[r.project_id].name, pid: r.project_id, verdict: r.verdict, status: r.status, date: r.date }))
    });
  }

  /* ----- student actions ----- */
  async function begin(sid, pid) {
    const p = PROJECTS[pid] || bad("Unknown project");
    if (level(await sum(sid, "points")).n < p.level) bad("Reach level " + p.level + " first", 403);
    await run("INSERT OR IGNORE INTO student_projects(student_id,project_id) VALUES (?,?)", sid, pid);
    await touch(sid);
  }

  async function step(sid, pid, i) {
    const sp = await q1("SELECT steps_done FROM student_projects WHERE student_id=? AND project_id=?", sid, pid);
    if (!sp || sp.steps_done !== i || !(i >= 0 && i < 4)) bad("That step is not available yet");
    await tx(async t => { await t.run("UPDATE student_projects SET steps_done=steps_done+1 WHERE student_id=? AND project_id=?", sid, pid); await ledger(t, sid, "beans", 5, "step", pid); });
    await touch(sid);
  }

  /* Result of one photo check. Counts a failed try; after `retakes` retakes the photo goes to the teacher. */
  async function recordCheck(sid, pid, r, retakes) {
    const sp = await q1("SELECT steps_done,fails FROM student_projects WHERE student_id=? AND project_id=?", sid, pid);
    if (!sp || sp.steps_done !== 4) bad("Finish the earlier steps first");
    if (r.verdict === "fail") {
      const fails = sp.fails + 1, left = retakes + 1 - fails;
      await run("UPDATE student_projects SET fails=? WHERE student_id=? AND project_id=?", fails, sid, pid);
      if (left <= 0) return { verdict: "unsure", confidence: r.confidence, stage: r.stage, mode: r.mode, reason: "retakes", feedback: "Still not a match after " + fails + " tries. Send it and your teacher will check it.", fails };
      return Object.assign({}, r, { left, fails });
    }
    return Object.assign({}, r, r.verdict === "unsure" ? { reason: r.stage === "ai" ? "ai-unsure" : "local-unsure" } : {});
  }

  async function submit(sid, pid, r, image) {
    const p = PROJECTS[pid], sp = await q1("SELECT steps_done,fails FROM student_projects WHERE student_id=? AND project_id=?", sid, pid);
    if (!sp || sp.steps_done !== 4) bad("Nothing to submit");
    const level0 = level(await sum(sid, "points")).n;
    await tx(async t => {
      await t.run("UPDATE student_projects SET steps_done=5, fails=0, completed_at=? WHERE student_id=? AND project_id=?", dayToDate(today()), sid, pid);
      await ledger(t, sid, "beans", 10, "photo_verified", pid);
      const unsure = r.verdict === "unsure";
      const note = !unsure ? null : r.reason === "retakes" ? "Failed the photo check " + sp.fails + " times" : r.stage === "ai" ? "AI unsure (confidence " + (+r.confidence || 0).toFixed(2) + ")" : r.stage === "ai-down" ? "AI check was unavailable" : "Quick check unsure, AI unavailable";
      const sub = await t.run("INSERT INTO photo_submissions(student_id,project_id,verdict,confidence,feedback,note,mode,status) VALUES (?,?,?,?,?,?,?,?)",
        sid, pid, r.verdict, r.confidence ?? null, String(r.feedback || "").slice(0, 300), note, r.mode === "ai" ? "ai" : "demo", unsure ? "pending" : "approved");
      if (image) await t.run("INSERT INTO photo_images(submission_id,jpeg) VALUES (?,?)", sub.lastInsertRowid, image);   // every submitted photo is kept for the teacher
      if (!unsure) await ledger(t, sid, "points", p.pts, "photo_verified", pid);
    });
    await touch(sid);
    const after = level(await sum(sid, "points"));
    return { sent: r.verdict === "unsure", pts: p.pts, levelUp: after.n > level0 ? after.name : null };
  }

  async function answerQuiz(sid, pick) {
    const { i, q } = todaysQuiz(), gap = today() - (await quizFacts(sid)).last;
    if (!Number.isInteger(pick) || pick < 0 || pick >= q.o.length) bad("Pick one of the answers");
    if (await q1("SELECT 1 x FROM quiz_answers WHERE student_id=? AND quiz_date=?", sid, dayToDate(today()))) bad("You already answered today");
    const good = q.a < 0 || pick === q.a;
    await tx(async t => {
      await t.run("INSERT INTO quiz_answers VALUES (?,?,?,?,?)", sid, dayToDate(today()), i + 1, pick, good ? 1 : 0);
      const cur = (await t.get("SELECT streak FROM buddies WHERE student_id=?", sid) || { streak: 0 }).streak;
      await t.run("INSERT INTO buddies VALUES (?,?) ON CONFLICT(student_id) DO UPDATE SET streak=excluded.streak", sid, gap === 1 ? cur + 1 : 1);
      await ledger(t, sid, "beans", good ? 5 : 1, "quiz");
    });
    await touch(sid);
    return { good };
  }

  /* ----- the class garden ----- */
  const SPECIES = new Set((D.plants || []).map(p => p.id));
  const plantStage = day => { const d = today() - day; return d < 1 ? 1 : d < 3 ? 2 : 3; };   // sprout today, growing from tomorrow, in bloom after 3 days
  /* projects the student has finished (verified, not waiting for a teacher) but not yet planted a plant for */
  async function plantable(sid) {
    return (await qa("SELECT sp.project_id pid FROM student_projects sp WHERE sp.student_id=? AND sp.steps_done=5 AND " + NOT_PENDING + " " +
      "AND NOT EXISTS (SELECT 1 FROM garden_plants g WHERE g.student_id=sp.student_id AND g.project_id=sp.project_id) ORDER BY sp.completed_at, sp.project_id", sid)).map(r => r.pid);
  }
  async function plant(sid, pid, species) {
    if (!SPECIES.has(species)) bad("Pick one of the plants");
    if (!PROJECTS[pid]) bad("Unknown project");
    if (await q1("SELECT 1 x FROM garden_plants WHERE student_id=? AND project_id=?", sid, pid)) bad("You already planted something for that project", 409);
    if (!(await plantable(sid)).includes(pid)) bad("Finish this project and get it verified first, then you can plant", 403);
    await run("INSERT INTO garden_plants(student_id,project_id,species,planted_day) VALUES (?,?,?,?)", sid, pid, species, today());
    await touch(sid);
  }

  async function unlocked(sid, a) {
    if (a.how === "buy") return !!await q1("SELECT 1 x FROM student_accessories WHERE student_id=? AND accessory_id=?", sid, a.id);
    if (a.how === "streak") return (await quizFacts(sid)).now >= a.need;
    if (a.how === "project") return await verifiedProjects(sid) >= a.need;
    if (a.how === "mission") return (await missions((await q1("SELECT class_id c FROM students WHERE id=?", sid)).c)).filter(m => m.done).length >= a.need;
    return false;
  }
  async function equip(sid, id, on) {
    const a = ACC[id] || bad("Unknown item");
    if (!await unlocked(sid, a)) bad("Not unlocked yet", 403);
    const same = D.accessories.filter(x => x.slot === a.slot).map(x => x.id);
    await tx(async t => {
      if (on) await t.run("UPDATE student_accessories SET equipped=0 WHERE student_id=? AND accessory_id IN (" + same.map(() => "?").join(",") + ")", sid, ...same);
      await t.run("INSERT INTO student_accessories VALUES (?,?,?) ON CONFLICT(student_id,accessory_id) DO UPDATE SET equipped=excluded.equipped", sid, id, on ? 1 : 0);
    });
  }
  async function buy(sid, id) {
    const a = ACC[id];
    if (!a || a.how !== "buy") bad("That item is not for sale");
    if (await q1("SELECT 1 x FROM student_accessories WHERE student_id=? AND accessory_id=?", sid, id)) bad("You already own that");
    if (await sum(sid, "beans") < a.cost) bad("Not enough beans");
    await tx(async t => { await ledger(t, sid, "beans", -a.cost, "purchase"); await t.run("INSERT INTO student_accessories VALUES (?,?,0)", sid, id); });
    await equip(sid, id, true);
  }

  /* ----- teacher actions (always scoped to the teacher's own class) ----- */
  const teacherClassId = async userId => (await q1("SELECT id FROM classes WHERE teacher_id=? ORDER BY id LIMIT 1", userId) || bad("You have no class yet", 404)).id;

  async function review(userId, flagId, verdict) {
    const id = Number(String(flagId).replace(/^f/, "")), cid = await teacherClassId(userId);
    const r = await q1("SELECT ps.id,ps.student_id,ps.project_id,ps.status FROM photo_submissions ps JOIN students s ON s.id=ps.student_id WHERE ps.id=? AND s.class_id=?", id, cid);
    if (!r || r.status !== "pending") bad("That photo is not waiting for review", 404);
    await tx(async t => {
      if (verdict === "ok") {
        await t.run("UPDATE photo_submissions SET status='approved', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?", userId, id);
        await ledger(t, r.student_id, "points", PROJECTS[r.project_id].pts, "teacher_approved", r.project_id);
      } else {
        await t.run("UPDATE photo_submissions SET status='redo', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?", userId, id);
        await t.run("UPDATE student_projects SET steps_done=4, fails=0, completed_at=NULL WHERE student_id=? AND project_id=?", r.student_id, r.project_id);
      }
    });
  }
  /* A stored photo, for any submission (waiting or already decided), and only for the teacher whose class it belongs to. */
  async function classPhoto(userId, flagId) {
    const id = Number(String(flagId).replace(/^f/, "")), cid = await teacherClassId(userId);
    const r = await q1("SELECT i.jpeg FROM photo_images i JOIN photo_submissions ps ON ps.id=i.submission_id JOIN students s ON s.id=ps.student_id WHERE ps.id=? AND s.class_id=?", id, cid);
    return r ? Buffer.from(r.jpeg) : null;
  }
  /* A teacher renames their own class's join code. Students keep their accounts; the old code stops working at once. */
  async function setClassCode(userId, code) {
    code = String(code || "").trim();
    if (!/^[A-Za-z0-9-]{6,40}$/.test(code)) bad("Use 6 to 40 letters, numbers or dashes (no spaces).");
    const cid = await teacherClassId(userId);
    if (await q1("SELECT 1 x FROM classes WHERE code=? AND id<>?", code, cid)) bad("Another class already uses that code. Try a different one.", 409);
    await run("UPDATE classes SET code=? WHERE id=?", code, cid);
  }
  async function addMission(userId, name, goal) {
    name = String(name || "").trim().slice(0, 60);
    if (!name || !Number.isInteger(goal) || goal < 1 || goal > 500) bad("Give the mission a name and a goal from 1 to 500");
    await run("INSERT INTO missions(class_id,name,goal,unit,created_by) VALUES (?,?,?,'projects',?)", await teacherClassId(userId), name, goal, userId);
  }
  async function studentInTeacherClass(userId, studentId) {
    return await q1("SELECT s.id FROM students s WHERE s.id=? AND s.class_id=?", studentId, await teacherClassId(userId)) || bad("No such student in your class", 404);
  }

  return { HttpError, today, level, studentState, teacherData, begin, step, recordCheck, submit, answerQuiz, buy, equip, review, classPhoto, setClassCode, plant, plantable, addMission, studentInTeacherClass, touch, q1, qa, run };
}

module.exports = { createStore, HttpError };
