#!/usr/bin/env node
/* Creates the database from schema.sql and keeps the learning content in step with js/data.js.
 *
 *   npm run db:init                  empty database: content only, no accounts. Create accounts with db/admin.js.
 *   npm run db:init -- --demo        also adds a demo school, teacher, class and students (password "demo")
 *   npm run db:reset                 wipe and recreate (add -- --demo for the demo data)
 *
 * The server calls createDb() itself on first start if the file is missing, and syncContent() on every start.
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const { DatabaseSync } = require("node:sqlite");
const { hashPassword } = require("./auth");
const { seedDemo } = require("./demo-seed");

const ROOT = path.join(__dirname, "..");
const DEFAULT_FILE = process.env.DB_FILE || path.join(__dirname, "grounded.db");
const loadData = () => vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js/data.js"), "utf8") + ";DATA");

function openDb(file = DEFAULT_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  return db;
}

/* A database made before logins existed has no sessions table. Say so plainly instead of failing on the first query. */
function assertSchema(db, file = DEFAULT_FILE) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sessions'").get()) {
    console.error(file + " was created by an older version of Grounded and has no login tables.\n" +
      "If it only holds demo data (it did before accounts existed), recreate it:  npm run db:reset:demo\n" +
      "On a real database, do not reset it: ask for a migration instead.");
    process.exit(1);
  }
}

const tx = (db, fn) => { db.exec("BEGIN"); try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } };

/* Upserts levels, projects, weeks, accessories and the quiz bank from js/data.js. Safe to run on every start:
 * rows are updated in place, so student progress that points at them is never touched. */
function syncContent(db, D = loadData()) {
  db.exec(`CREATE TABLE IF NOT EXISTS photo_images (           -- every submitted photo, shown only to the student's own teacher
  submission_id  INTEGER PRIMARY KEY REFERENCES photo_submissions(id) ON DELETE CASCADE,
  jpeg           BLOB NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
`);   // added after first release: lets older databases pick it up
  tx(db, () => {
    const run = (sql, ...a) => db.prepare(sql).run(...a);
    D.levels.forEach(l => run("INSERT INTO levels VALUES (?,?,?) ON CONFLICT(n) DO UPDATE SET name=excluded.name, at=excluded.at", l.n, l.name, l.at));
    D.projects.forEach(p => {
      run("INSERT INTO projects VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, level=excluded.level, pts=excluded.pts, description=excluded.description, photo_prompt=excluded.photo_prompt, plant=excluded.plant, color=excluded.color",
        p.id, p.name, p.level, p.pts, p.desc, p.photoPrompt, p.plant, p.color);
      run("DELETE FROM project_steps WHERE project_id=?", p.id);
      p.steps.forEach((s, i) => run("INSERT INTO project_steps VALUES (?,?,?,?)", p.id, i, s[0], s[1]));
    });
    run("DELETE FROM week_projects");
    D.weeks.forEach(w => {
      run("INSERT INTO weeks VALUES (?,?,?) ON CONFLICT(n) DO UPDATE SET name=excluded.name, goal=excluded.goal", w.n, w.name, w.goal);
      w.projects.forEach(pid => run("INSERT INTO week_projects VALUES (?,?)", w.n, pid));
    });
    D.accessories.forEach(a => run("INSERT INTO accessories VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slot=excluded.slot, how=excluded.how, cost=excluded.cost, need=excluded.need, hint=excluded.hint",
      a.id, a.name, a.slot, a.how, a.cost ?? null, a.need ?? null, a.hint ?? null));
    // Quiz question id = position in data.js + 1. The text lives in data.js and is reviewed there.
    D.quiz.forEach((q, i) => run("INSERT INTO quiz_questions(id,question,options,answer_idx,explanation,reviewed_at) VALUES (?,?,?,?,?,datetime('now')) ON CONFLICT(id) DO UPDATE SET question=excluded.question, options=excluded.options, answer_idx=excluded.answer_idx, explanation=excluded.explanation",
      i + 1, q.q, JSON.stringify(q.o), q.a, q.why));
  });
}

/* Fill an existing but EMPTY database (no schools and no accounts) with the demo data. Does nothing otherwise,
 * so it can never touch a database that already has real schools or users. Returns true if it seeded. */
function seedIfEmpty(db, D = loadData()) {
  const n = t => db.prepare("SELECT COUNT(*) c FROM " + t).get().c;
  if (n("schools") || n("users") || n("students")) return false;
  seedDemo(db, D);
  return true;
}

/* Fixed demo logins, all with the password "demo". Idempotent: each piece is only created if missing, and existing
 * accounts are never changed, so it is safe to run on every start. Turn off with DEMO_ACCOUNTS=0. */
function ensureDemoAccounts(db) {
  const one = (sql, ...a) => db.prepare(sql).get(...a), run = (sql, ...a) => db.prepare(sql).run(...a);
  const pw = hashPassword("demo");
  tx(db, () => {
    if (!one("SELECT 1 FROM users WHERE email='demo@coffeebot.com'"))
      run("INSERT INTO users(role,name,email,password_hash) VALUES ('coffeebot','Demo CoffeeBot','demo@coffeebot.com',?)", pw);
    let teacher = one("SELECT id,school_id FROM users WHERE email='demo@demo.com'");
    if (!teacher) {
      run("INSERT OR IGNORE INTO cohorts(name) VALUES ('Demo')");
      const cohort = one("SELECT id FROM cohorts WHERE name='Demo'").id;
      const school = Number(run("INSERT INTO schools(name,cohort_id) VALUES ('Demo School',?)", cohort).lastInsertRowid);
      run("INSERT INTO users(role,name,email,password_hash,school_id) VALUES ('teacher','Demo Teacher','demo@demo.com',?,?)", pw, school);
      teacher = one("SELECT id,school_id FROM users WHERE email='demo@demo.com'");
    }
    let cls = one("SELECT id FROM classes WHERE code='demo'");
    if (!cls) {
      run("INSERT INTO classes(school_id,teacher_id,name,code) VALUES (?,?,'Demo Class','demo')", teacher.school_id, teacher.id);
      cls = one("SELECT id FROM classes WHERE code='demo'");
    }
    if (!one("SELECT 1 FROM students WHERE class_id=? AND name='demo'", cls.id)) {
      const sid = Number(run("INSERT INTO students(class_id,name,password_hash) VALUES (?,'demo',?)", cls.id, pw).lastInsertRowid);
      run("INSERT INTO buddies VALUES (?,0)", sid);
    }
  });
}

function createDb(file = DEFAULT_FILE, { demo = false } = {}) {
  const db = openDb(file);
  db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  syncContent(db);
  if (demo) seedDemo(db, loadData());
  return db;
}

module.exports = { openDb, assertSchema, createDb, seedIfEmpty, ensureDemoAccounts, syncContent, DEFAULT_FILE, loadData };

if (require.main === module) {
  const file = DEFAULT_FILE, demo = process.argv.includes("--demo");
  if (fs.existsSync(file)) {
    if (!process.argv.includes("--force")) { console.error(file + " already exists. Run with --force to wipe and recreate it."); process.exit(1); }
    for (const f of [file, file + "-wal", file + "-shm"]) fs.rmSync(f, { force: true });
  }
  const db = createDb(file, { demo });
  console.log("Created " + file + (demo ? " with demo data (every login uses the password \"demo\")" : " (content only: add accounts with db/admin.js)"));
  ["schools", "users", "classes", "students", "projects", "accessories", "quiz_questions"].forEach(t => console.log("  " + t.padEnd(16) + db.prepare("SELECT COUNT(*) c FROM " + t).get().c));
}
