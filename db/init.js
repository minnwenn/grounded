#!/usr/bin/env node
/* Creates db/bean.db from schema.sql and seeds it from js/data.js.
 * Usage: npm run db:init   (add --force to wipe an existing database)
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const { DatabaseSync } = require("node:sqlite");
const { hashPassword } = require("./auth");

const ROOT = path.join(__dirname, "..");
const FILE = process.env.DB_FILE || path.join(__dirname, "bean.db");
if (fs.existsSync(FILE)) {
  if (!process.argv.includes("--force")) { console.error(FILE + " already exists. Run with --force to wipe and recreate it."); process.exit(1); }
  fs.rmSync(FILE);
}
const D = vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js/data.js"), "utf8") + ";DATA");
const db = new DatabaseSync(FILE);
db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));

const run = (sql, ...a) => db.prepare(sql).run(...a);
const id = r => Number(r.lastInsertRowid);
db.exec("BEGIN");
try {
  // content
  D.levels.forEach(l => run("INSERT INTO levels VALUES (?,?,?)", l.n, l.name, l.at));
  D.projects.forEach(p => {
    run("INSERT INTO projects VALUES (?,?,?,?,?,?,?,?)", p.id, p.name, p.level, p.pts, p.desc, p.photoPrompt, p.plant, p.color);
    p.steps.forEach((s, i) => run("INSERT INTO project_steps VALUES (?,?,?,?)", p.id, i, s[0], s[1]));
  });
  D.weeks.forEach(w => {
    run("INSERT INTO weeks VALUES (?,?,?)", w.n, w.name, w.goal);
    w.projects.forEach(pid => run("INSERT INTO week_projects VALUES (?,?)", w.n, pid));
  });
  D.accessories.forEach(a => run("INSERT INTO accessories VALUES (?,?,?,?,?,?,?)", a.id, a.name, a.slot, a.how, a.cost ?? null, a.need ?? null, a.hint ?? null));

  // organisations
  const cohort = {};
  [...new Set(D.schools.map(s => s.cohort))].forEach(c => cohort[c] = id(run("INSERT INTO cohorts(name) VALUES (?)", c)));
  const school = {};
  D.schools.forEach(s => school[s.id] = id(run("INSERT INTO schools(name,cohort_id) VALUES (?,?)", s.name, cohort[s.cohort])));

  // demo users (password for both: "demo")
  const teacher = id(run("INSERT INTO users(role,name,email,password_hash,school_id) VALUES ('teacher','Teacher','teacher@maple.example',?,?)", hashPassword("demo"), school.s1));
  const cb = id(run("INSERT INTO users(role,name,email,password_hash) VALUES ('coffeebot','CoffeeBot team','team@coffeebot.example',?)", hashPassword("demo")));

  // quiz bank: seeded as human-reviewed by the CoffeeBot user
  D.quiz.forEach(q => run("INSERT INTO quiz_questions(question,options,answer_idx,explanation,reviewed_by,reviewed_at) VALUES (?,?,?,?,?,datetime('now'))", q.q, JSON.stringify(q.o), q.a, q.why, cb));

  // demo class, roster and missions
  const cls = id(run("INSERT INTO classes(school_id,teacher_id,name,code) VALUES (?,?,?,?)", school.s1, teacher, D.className, D.classCode));
  D.students.forEach(st => {
    const sid = id(run("INSERT INTO students(class_id,name,last_active) VALUES (?,?,datetime('now',?))", cls, st.n, "-" + st.last + " days"));
    run("INSERT INTO buddies VALUES (?,?)", sid, st.streak);
  });
  D.baseMissions.forEach(m => run("INSERT INTO missions(class_id,name,goal,unit,created_by) VALUES (?,?,?,?,?)", cls, m.name, m.goal, m.unit, teacher));

  // batches
  D.batches.forEach(b => {
    run("INSERT INTO batches VALUES (?,?,?,?,?,?)", b.id, school[b.school], cohort[b.cohort], b.outlet, b.kg, b.events.some(e => e[2] === "wait") ? 0 : 1);
    b.events.forEach(e => run("INSERT INTO batch_events(batch_id,happened,text,done) VALUES (?,?,?,?)", b.id, e[0] === "pending" ? null : e[0], e[1], e[2] === "ok" ? 1 : 0));
  });
  db.exec("COMMIT");
} catch (e) { db.exec("ROLLBACK"); throw e; }

const n = t => db.prepare("SELECT COUNT(*) c FROM " + t).get().c;
console.log("Created " + FILE);
["cohorts","schools","users","classes","students","projects","project_steps","weeks","accessories","quiz_questions","missions","batches","batch_events"]
  .forEach(t => console.log("  " + t.padEnd(16) + n(t)));
