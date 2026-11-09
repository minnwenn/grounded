/* All game rules and queries. The browser only asks for things; the server decides what counts.
 * Every function takes a student or class id that the API layer has already taken from the login session. */
const { realDay, dayToDate, dateToDay } = require("./clock");

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (msg, status = 400) => { throw new HttpError(status, msg); };

function createStore(db, D, opts = {}) {
  const demo = opts.demo || (() => ({ day: 0, evening: false }));   // terminal-controlled demo clock (README)
  const PROJECTS = Object.fromEntries(D.projects.map(p => [p.id, p]));
  const ACC = Object.fromEntries(D.accessories.map(a => [a.id, a]));
  const q1 = (sql, ...a) => db.prepare(sql).get(...a);
  const qa = (sql, ...a) => db.prepare(sql).all(...a);
  const run = (sql, ...a) => db.prepare(sql).run(...a);
  const tx = fn => { db.exec("BEGIN"); try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } };

  const today = () => realDay() + demo().day;
  const level = pts => D.levels.reduce((c, l) => (pts >= l.at ? l : c), D.levels[0]);
  const ledger = (sid, kind, delta, reason, pid = null) => run("INSERT INTO ledger(student_id,kind,delta,reason,project_id) VALUES (?,?,?,?,?)", sid, kind, delta, reason, pid);
  const sum = (sid, kind) => q1("SELECT COALESCE(SUM(delta),0) n FROM ledger WHERE student_id=? AND kind=?", sid, kind).n;
  const touch = sid => run("UPDATE students SET last_active=? WHERE id=?", dayToDate(today()), sid);
  const todaysQuiz = () => { const n = D.quiz.length, i = ((today() % n) + n) % n; return { i, q: D.quiz[i] }; };

  /* ----- per-student facts ----- */
  function lastQuizDay(sid) {
    const r = q1("SELECT MAX(quiz_date) d FROM quiz_answers WHERE student_id=?", sid);
    if (r.d) return dateToDay(r.d);
    return dateToDay(q1("SELECT substr(created_at,1,10) d FROM students WHERE id=?", sid).d) - 1;   // new student: first quiz is due
  }
  const streakNow = (sid, last = lastQuizDay(sid)) => (today() - last >= 2 ? 0 : (q1("SELECT streak FROM buddies WHERE student_id=?", sid) || { streak: 0 }).streak);

  function verifiedProjects(sid) { return qa("SELECT project_id FROM student_projects sp WHERE student_id=? AND steps_done=5 AND NOT EXISTS (SELECT 1 FROM photo_submissions ps WHERE ps.student_id=sp.student_id AND ps.project_id=sp.project_id AND ps.status='pending')", sid).length; }

  /* ----- class-level views ----- */
  function missions(classId) {
    const steps = q1("SELECT COALESCE(SUM(steps_done),0) n FROM student_projects WHERE student_id IN (SELECT id FROM students WHERE class_id=?)", classId).n;
    const projs = q1("SELECT COUNT(*) n FROM student_projects sp JOIN students s ON s.id=sp.student_id WHERE s.class_id=? AND sp.steps_done=5 AND NOT EXISTS (SELECT 1 FROM photo_submissions ps WHERE ps.student_id=sp.student_id AND ps.project_id=sp.project_id AND ps.status='pending')", classId).n;
    return qa("SELECT id,name,goal,unit FROM missions WHERE class_id=? ORDER BY id", classId).map(m => {
      const cur = m.unit === "steps" ? steps : projs;
      return { id: "m" + m.id, name: m.name, goal: m.goal, unit: m.unit === "steps" ? "steps" : "projects verified", cur: Math.min(cur, m.goal), done: cur >= m.goal };
    });
  }

  function roster(classId, meId = null) {
    const day = today(), pending = new Set(qa("SELECT student_id||':'||project_id k FROM photo_submissions WHERE status='pending' AND student_id IN (SELECT id FROM students WHERE class_id=?)", classId).map(r => r.k));
    const prog = {};
    qa("SELECT student_id,project_id,steps_done FROM student_projects WHERE student_id IN (SELECT id FROM students WHERE class_id=?)", classId).forEach(r => (prog[r.student_id] ||= {})[r.project_id] = r.steps_done);
    return qa("SELECT s.id,s.name,s.last_active FROM students s WHERE s.class_id=? ORDER BY s.name COLLATE NOCASE", classId).map(s => {
      const status = {};
      D.projects.forEach(p => {
        const n = (prog[s.id] || {})[p.id];
        status[p.id] = n === undefined ? "none" : n < 5 ? "started" : pending.has(s.id + ":" + p.id) ? "sent" : "verified";
      });
      return { id: s.id, name: s.name, you: s.id === meId, status, streak: streakNow(s.id), lastDays: s.last_active ? Math.max(0, day - dateToDay(s.last_active)) : 99 };
    });
  }

  /* ----- student state sent to the browser after every action ----- */
  function studentState(sid) {
    const s = q1("SELECT s.id,s.name,s.class_id,c.name cname,c.code,sc.name sname FROM students s JOIN classes c ON c.id=s.class_id JOIN schools sc ON sc.id=c.school_id WHERE s.id=?", sid);
    const points = sum(sid, "points"), progress = {}, fails = {}, owned = [], equipped = {};
    qa("SELECT project_id,steps_done,fails FROM student_projects WHERE student_id=?", sid).forEach(r => { progress[r.project_id] = r.steps_done; if (r.fails) fails[r.project_id] = r.fails; });
    qa("SELECT accessory_id,equipped FROM student_accessories WHERE student_id=?", sid).forEach(r => {
      const a = ACC[r.accessory_id]; if (!a) return;
      if (a.how === "buy") owned.push(a.id);
      if (r.equipped) equipped[a.slot] = a.id;
    });
    const last = lastQuizDay(sid), pick = q1("SELECT pick_idx p, question_id qid FROM quiz_answers WHERE student_id=? AND quiz_date=?", sid, dayToDate(today()));
    return {
      user: { role: "student", name: s.name },
      cls: { name: s.cname, code: s.code, school: s.sname },
      today: today(), evening: !!demo().evening, token: demo().token || "", demoDay: demo().day,
      points, beans: sum(sid, "beans"), streak: (q1("SELECT streak FROM buddies WHERE student_id=?", sid) || { streak: 0 }).streak,
      lastQuizDay: last, quizPick: pick ? pick.p : null, quizQ: pick ? pick.qid - 1 : null, progress, fails, owned, equipped,
      roster: roster(s.class_id, sid), missions: missions(s.class_id),
      // other classes at the same school, for the school forest: one plant per student who has begun a project
      schoolClasses: qa("SELECT c.name, (SELECT COUNT(*) FROM students x WHERE x.class_id=c.id AND EXISTS (SELECT 1 FROM student_projects sp WHERE sp.student_id=x.id)) n FROM classes c WHERE c.school_id=(SELECT school_id FROM classes WHERE id=?) AND c.id<>? ORDER BY c.name", s.class_id, s.class_id)
    };
  }

  function teacherData(userId) {
    const u = q1("SELECT id,name FROM users WHERE id=? AND role='teacher'", userId);
    const c = q1("SELECT c.id,c.name,c.code,sc.name school FROM classes c JOIN schools sc ON sc.id=c.school_id WHERE c.teacher_id=? ORDER BY c.id LIMIT 1", userId);
    const base = { user: { role: "teacher", name: u.name }, today: today(), evening: !!demo().evening, token: demo().token || "", demoDay: demo().day };
    if (!c) return Object.assign(base, { cls: null, roster: [], flags: [], photos: [], missions: [], quiz7: [0, 0, 0, 0, 0, 0, 0] });
    const flag = r => ({ id: "f" + r.id, student: r.student, project: PROJECTS[r.project_id].name, pid: r.project_id, pts: PROJECTS[r.project_id].pts, note: r.note || "Needs a teacher's look", status: r.status, hasPhoto: !!r.has_photo, reviewed: r.reviewed_by ? (r.status === "approved" ? "ok" : "redo") : null });
    const flags = qa("SELECT ps.id,ps.project_id,ps.note,ps.status,ps.reviewed_by,s.name student,EXISTS(SELECT 1 FROM photo_images i WHERE i.submission_id=ps.id) has_photo FROM photo_submissions ps JOIN students s ON s.id=ps.student_id WHERE s.class_id=? AND (ps.status='pending' OR ps.reviewed_by IS NOT NULL) ORDER BY ps.id DESC", c.id).map(flag);
    // every photo the class has submitted, newest first (the images themselves load one by one from /api/teacher/photo)
    const photos = qa("SELECT ps.id,ps.project_id,ps.verdict,ps.status,substr(ps.created_at,1,10) date,s.name student FROM photo_submissions ps JOIN students s ON s.id=ps.student_id WHERE s.class_id=? AND EXISTS (SELECT 1 FROM photo_images i WHERE i.submission_id=ps.id) ORDER BY ps.id DESC LIMIT 300", c.id)
      .map(r => ({ id: "f" + r.id, student: r.student, project: PROJECTS[r.project_id].name, pid: r.project_id, verdict: r.verdict, status: r.status, date: r.date }));
    const quiz7 = [];
    for (let k = 6; k >= 0; k--) {
      const r = q1("SELECT COUNT(*) n, COALESCE(SUM(correct),0) ok FROM quiz_answers WHERE quiz_date=? AND student_id IN (SELECT id FROM students WHERE class_id=?)", dayToDate(today() - k), c.id);
      quiz7.push(r.n ? Math.round(r.ok / r.n * 100) : 0);
    }
    return Object.assign(base, { cls: { id: c.id, name: c.name, code: c.code, school: c.school }, roster: roster(c.id), flags, photos, missions: missions(c.id), quiz7 });
  }

  /* ----- student actions ----- */
  function begin(sid, pid) {
    const p = PROJECTS[pid] || bad("Unknown project");
    if (level(sum(sid, "points")).n < p.level) bad("Reach level " + p.level + " first", 403);
    run("INSERT OR IGNORE INTO student_projects(student_id,project_id) VALUES (?,?)", sid, pid);
    touch(sid);
  }

  function step(sid, pid, i) {
    const sp = q1("SELECT steps_done FROM student_projects WHERE student_id=? AND project_id=?", sid, pid);
    if (!sp || sp.steps_done !== i || !(i >= 0 && i < 4)) bad("That step is not available yet");
    tx(() => { run("UPDATE student_projects SET steps_done=steps_done+1 WHERE student_id=? AND project_id=?", sid, pid); ledger(sid, "beans", 5, "step", pid); });
    touch(sid);
  }

  /* Result of one photo check. Counts a failed try; after `retakes` retakes the photo goes to the teacher. */
  function recordCheck(sid, pid, r, retakes) {
    const sp = q1("SELECT steps_done,fails FROM student_projects WHERE student_id=? AND project_id=?", sid, pid);
    if (!sp || sp.steps_done !== 4) bad("Finish the earlier steps first");
    if (r.verdict === "fail") {
      const fails = sp.fails + 1, left = retakes + 1 - fails;
      run("UPDATE student_projects SET fails=? WHERE student_id=? AND project_id=?", fails, sid, pid);
      if (left <= 0) return { verdict: "unsure", confidence: r.confidence, stage: r.stage, mode: r.mode, reason: "retakes", feedback: "Still not a match after " + fails + " tries. Send it and your teacher will check it.", fails };
      return Object.assign({}, r, { left, fails });
    }
    return Object.assign({}, r, r.verdict === "unsure" ? { reason: r.stage === "ai" ? "ai-unsure" : "local-unsure" } : {});
  }

  function submit(sid, pid, r, image) {
    const p = PROJECTS[pid], sp = q1("SELECT steps_done,fails FROM student_projects WHERE student_id=? AND project_id=?", sid, pid);
    if (!sp || sp.steps_done !== 4) bad("Nothing to submit");
    const level0 = level(sum(sid, "points")).n;
    tx(() => {
      run("UPDATE student_projects SET steps_done=5, fails=0, completed_at=? WHERE student_id=? AND project_id=?", dayToDate(today()), sid, pid);
      ledger(sid, "beans", 10, "photo_verified", pid);
      const unsure = r.verdict === "unsure";
      const note = !unsure ? null : r.reason === "retakes" ? "Failed the photo check " + sp.fails + " times" : r.stage === "ai" ? "AI unsure (confidence " + (+r.confidence || 0).toFixed(2) + ")" : r.stage === "ai-down" ? "AI check was unavailable" : "Quick check unsure, AI unavailable";
      const sub = run("INSERT INTO photo_submissions(student_id,project_id,verdict,confidence,feedback,note,mode,status) VALUES (?,?,?,?,?,?,?,?)",
        sid, pid, r.verdict, r.confidence ?? null, String(r.feedback || "").slice(0, 300), note, r.mode === "ai" ? "ai" : "demo", unsure ? "pending" : "approved");
      if (image) run("INSERT INTO photo_images(submission_id,jpeg) VALUES (?,?)", Number(sub.lastInsertRowid), image);   // every submitted photo is kept for the teacher
      if (!unsure) ledger(sid, "points", p.pts, "photo_verified", pid);
    });
    touch(sid);
    return { sent: r.verdict === "unsure", pts: p.pts, levelUp: level(sum(sid, "points")).n > level0 ? level(sum(sid, "points")).name : null };
  }

  function answerQuiz(sid, pick) {
    const { i, q } = todaysQuiz(), last = lastQuizDay(sid), gap = today() - last;
    if (!Number.isInteger(pick) || pick < 0 || pick >= q.o.length) bad("Pick one of the answers");
    if (q1("SELECT 1 FROM quiz_answers WHERE student_id=? AND quiz_date=?", sid, dayToDate(today()))) bad("You already answered today");
    const good = q.a < 0 || pick === q.a;
    tx(() => {
      run("INSERT INTO quiz_answers VALUES (?,?,?,?,?)", sid, dayToDate(today()), i + 1, pick, good ? 1 : 0);
      const cur = (q1("SELECT streak FROM buddies WHERE student_id=?", sid) || { streak: 0 }).streak;
      run("INSERT INTO buddies VALUES (?,?) ON CONFLICT(student_id) DO UPDATE SET streak=excluded.streak", sid, gap === 1 ? cur + 1 : 1);
      ledger(sid, "beans", good ? 5 : 1, "quiz");
    });
    touch(sid);
    return { good };
  }

  function unlocked(sid, a) {
    if (a.how === "buy") return !!q1("SELECT 1 FROM student_accessories WHERE student_id=? AND accessory_id=?", sid, a.id);
    if (a.how === "streak") return streakNow(sid) >= a.need;
    if (a.how === "project") return verifiedProjects(sid) >= a.need;
    if (a.how === "mission") return missions(q1("SELECT class_id c FROM students WHERE id=?", sid).c).filter(m => m.done).length >= a.need;
    return false;
  }
  function equip(sid, id, on) {
    const a = ACC[id] || bad("Unknown item");
    if (!unlocked(sid, a)) bad("Not unlocked yet", 403);
    tx(() => {
      if (on) run("UPDATE student_accessories SET equipped=0 WHERE student_id=? AND accessory_id IN (" + D.accessories.filter(x => x.slot === a.slot).map(() => "?").join(",") + ")", sid, ...D.accessories.filter(x => x.slot === a.slot).map(x => x.id));
      run("INSERT INTO student_accessories VALUES (?,?,?) ON CONFLICT(student_id,accessory_id) DO UPDATE SET equipped=excluded.equipped", sid, id, on ? 1 : 0);
    });
  }
  function buy(sid, id) {
    const a = ACC[id];
    if (!a || a.how !== "buy") bad("That item is not for sale");
    if (q1("SELECT 1 FROM student_accessories WHERE student_id=? AND accessory_id=?", sid, id)) bad("You already own that");
    if (sum(sid, "beans") < a.cost) bad("Not enough beans");
    tx(() => { ledger(sid, "beans", -a.cost, "purchase"); run("INSERT INTO student_accessories VALUES (?,?,0)", sid, id); });
    equip(sid, id, true);
  }

  /* ----- teacher actions (always scoped to the teacher's own class) ----- */
  const teacherClassId = userId => (q1("SELECT id FROM classes WHERE teacher_id=? ORDER BY id LIMIT 1", userId) || bad("You have no class yet", 404)).id;

  function review(userId, flagId, verdict) {
    const id = Number(String(flagId).replace(/^f/, "")), cid = teacherClassId(userId);
    const r = q1("SELECT ps.id,ps.student_id,ps.project_id,ps.status FROM photo_submissions ps JOIN students s ON s.id=ps.student_id WHERE ps.id=? AND s.class_id=?", id, cid);
    if (!r || r.status !== "pending") bad("That photo is not waiting for review", 404);
    tx(() => {
      if (verdict === "ok") {
        run("UPDATE photo_submissions SET status='approved', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?", userId, id);
        ledger(r.student_id, "points", PROJECTS[r.project_id].pts, "teacher_approved", r.project_id);
      } else {
        run("UPDATE photo_submissions SET status='redo', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?", userId, id);
        run("UPDATE student_projects SET steps_done=4, fails=0, completed_at=NULL WHERE student_id=? AND project_id=?", r.student_id, r.project_id);
      }
    });
  }
  /* A stored photo, for any submission (waiting or already decided), and only for the teacher whose class it belongs to. */
  function classPhoto(userId, flagId) {
    const id = Number(String(flagId).replace(/^f/, "")), cid = teacherClassId(userId);
    const r = q1("SELECT i.jpeg FROM photo_images i JOIN photo_submissions ps ON ps.id=i.submission_id JOIN students s ON s.id=ps.student_id WHERE ps.id=? AND s.class_id=?", id, cid);
    return r ? Buffer.from(r.jpeg) : null;
  }
  /* A teacher renames their own class's join code. Students keep their accounts; the old code stops working at once. */
  function setClassCode(userId, code) {
    code = String(code || "").trim();
    if (!/^[A-Za-z0-9-]{6,40}$/.test(code)) bad("Use 6 to 40 letters, numbers or dashes (no spaces).");
    const cid = teacherClassId(userId);
    if (q1("SELECT 1 FROM classes WHERE code=? AND id<>?", code, cid)) bad("Another class already uses that code. Try a different one.", 409);
    run("UPDATE classes SET code=? WHERE id=?", code, cid);
  }
  function addMission(userId, name, goal) {
    name = String(name || "").trim().slice(0, 60);
    if (!name || !Number.isInteger(goal) || goal < 1 || goal > 500) bad("Give the mission a name and a goal from 1 to 500");
    run("INSERT INTO missions(class_id,name,goal,unit,created_by) VALUES (?,?,?,'projects',?)", teacherClassId(userId), name, goal, userId);
  }
  function studentInTeacherClass(userId, studentId) {
    return q1("SELECT s.id FROM students s WHERE s.id=? AND s.class_id=?", studentId, teacherClassId(userId)) || bad("No such student in your class", 404);
  }

  return { HttpError, today, level, studentState, teacherData, begin, step, recordCheck, submit, answerQuiz, buy, equip, review, classPhoto, setClassCode, addMission, studentInTeacherClass, touch, q1, qa, run };
}

module.exports = { createStore, HttpError };
