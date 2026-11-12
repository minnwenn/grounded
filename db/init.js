#!/usr/bin/env node
/* Creates the database from schema.sql and keeps the learning content in step with public/js/data.js.
 *
 * The database is Turso when TURSO_DATABASE_URL is set, otherwise the local file db/grounded.db (see db/client.js).
 *
 *   npm run db:init                  empty database: content only, no accounts. Create accounts with db/admin.js.
 *   npm run db:init -- --demo        also adds the demo schools, teachers, classes and students (password "demo")
 *   npm run db:reset                 wipe and recreate a LOCAL file database (add -- --demo for the demo data)
 *
 * The app calls startup() itself on a cold start, so a new deployment sets up an empty database without any command.
 */
const fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto");
const { connect, LOCAL_FILE } = require("./client");
const { hashPassword } = require("./auth");
const { seedDemo } = require("./demo-seed");
const { runMigrations } = require("./migrations");

const ROOT = path.join(__dirname, "..");
const DATA_FILE = path.join(ROOT, "public/js/data.js");
const loadData = () => vm.runInNewContext(fs.readFileSync(DATA_FILE, "utf8") + ";DATA");

/* Creates every table if the database is empty. Does nothing on a database that already has them. */
async function ensureSchema(db) {
  if (await db.get("SELECT 1 x FROM sqlite_master WHERE type='table' AND name='sessions'")) {
    // a database from before the serverless version: the content-hash table is needed before anything else (migration 004 adds the rest)
    await db.run("CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    return false;
  }
  if (await db.get("SELECT 1 x FROM sqlite_master WHERE type='table' AND name='students'"))
    throw new Error("This database was created by an older version of Grounded and has no login tables. Recreate it with: npm run db:reset:demo");
  await db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  return true;
}

/* Upserts levels, projects, weeks, accessories and the quiz bank from data.js, in ONE round trip.
 * Rows are updated in place, so student progress that points at them is never touched. */
async function syncContent(db, D = loadData()) {
  const s = [];
  D.levels.forEach(l => s.push(["INSERT INTO levels VALUES (?,?,?) ON CONFLICT(n) DO UPDATE SET name=excluded.name, at=excluded.at", l.n, l.name, l.at]));
  D.projects.forEach(p => {
    s.push(["INSERT INTO projects VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, level=excluded.level, pts=excluded.pts, description=excluded.description, photo_prompt=excluded.photo_prompt, plant=excluded.plant, color=excluded.color",
      p.id, p.name, p.level, p.pts, p.desc, p.photoPrompt, p.plant, p.color]);
    s.push(["DELETE FROM project_steps WHERE project_id=?", p.id]);
    p.steps.forEach((st, i) => s.push(["INSERT INTO project_steps VALUES (?,?,?,?)", p.id, i, st[0], st[1]]));
  });
  s.push(["DELETE FROM week_projects"]);
  D.weeks.forEach(w => {
    s.push(["INSERT INTO weeks VALUES (?,?,?) ON CONFLICT(n) DO UPDATE SET name=excluded.name, goal=excluded.goal", w.n, w.name, w.goal]);
    w.projects.forEach(pid => s.push(["INSERT INTO week_projects VALUES (?,?)", w.n, pid]));
  });
  D.accessories.forEach(a => s.push(["INSERT INTO accessories VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slot=excluded.slot, how=excluded.how, cost=excluded.cost, need=excluded.need, hint=excluded.hint",
    a.id, a.name, a.slot, a.how, a.cost ?? null, a.need ?? null, a.hint ?? null]));
  // Quiz question id = position in data.js + 1. The text lives in data.js and is reviewed there.
  D.quiz.forEach((q, i) => s.push(["INSERT INTO quiz_questions(id,question,options,answer_idx,explanation,reviewed_at) VALUES (?,?,?,?,?,datetime('now')) ON CONFLICT(id) DO UPDATE SET question=excluded.question, options=excluded.options, answer_idx=excluded.answer_idx, explanation=excluded.explanation",
    i + 1, q.q, JSON.stringify(q.o), q.a, q.why]));
  await db.batch(s);
}

/* syncContent only when data.js changed since the last time (a hash is kept in app_state), so a cold start is cheap. */
async function syncContentIfChanged(db, D = loadData()) {
  const hash = crypto.createHash("sha256").update(fs.readFileSync(DATA_FILE)).digest("hex");
  const row = await db.get("SELECT value FROM app_state WHERE key='content_hash'");
  if (row && row.value === hash) return false;
  await syncContent(db, D);
  await db.run("INSERT INTO app_state VALUES ('content_hash',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", hash);
  return true;
}

/* Fill an EMPTY database (no schools, no accounts) with the demo data. Never touches one that has real data. */
async function seedIfEmpty(db, D = loadData()) {
  const r = await db.get("SELECT (SELECT COUNT(*) FROM schools) a, (SELECT COUNT(*) FROM users) b, (SELECT COUNT(*) FROM students) c");
  if (r.a || r.b || r.c) return false;
  await seedDemo(db, D);
  return true;
}

/* Fixed demo logins, all with the password "demo". Idempotent: each piece is only created if missing, and existing
 * accounts are never changed. Turn off with DEMO_ACCOUNTS=0. */
async function ensureDemoAccounts(db) {
  const have = await db.get(`SELECT
    (SELECT COUNT(*) FROM users WHERE email IN ('demo@coffeebot.com','demo@demo.com')) u,
    (SELECT COUNT(*) FROM students s JOIN classes c ON c.id=s.class_id WHERE c.code='demo' AND s.name='demo') s`);
  if (have.u === 2 && have.s === 1) return;
  const pw = hashPassword("demo");
  await db.tx(async t => {
    if (!await t.get("SELECT 1 x FROM users WHERE email='demo@coffeebot.com'"))
      await t.run("INSERT INTO users(role,name,email,password_hash) VALUES ('coffeebot','Demo CoffeeBot','demo@coffeebot.com',?)", pw);
    let teacher = await t.get("SELECT id,school_id FROM users WHERE email='demo@demo.com'");
    if (!teacher) {
      await t.run("INSERT OR IGNORE INTO cohorts(name) VALUES ('Demo')");
      const cohort = (await t.get("SELECT id FROM cohorts WHERE name='Demo'")).id;
      const school = (await t.run("INSERT INTO schools(name,cohort_id) VALUES ('Demo School',?)", cohort)).lastInsertRowid;
      await t.run("INSERT INTO users(role,name,email,password_hash,school_id) VALUES ('teacher','Demo Teacher','demo@demo.com',?,?)", pw, school);
      teacher = await t.get("SELECT id,school_id FROM users WHERE email='demo@demo.com'");
    }
    let cls = await t.get("SELECT id FROM classes WHERE code='demo'");
    if (!cls) {
      await t.run("INSERT INTO classes(school_id,teacher_id,name,code) VALUES (?,?,'Demo Class','demo')", teacher.school_id, teacher.id);
      cls = await t.get("SELECT id FROM classes WHERE code='demo'");
    }
    if (!await t.get("SELECT 1 x FROM students WHERE class_id=? AND name='demo'", cls.id)) {
      const sid = (await t.run("INSERT INTO students(class_id,name,password_hash) VALUES (?,'demo',?)", cls.id, pw)).lastInsertRowid;
      await t.run("INSERT INTO buddies VALUES (?,0)", sid);
    }
  });
}

/* Everything the app needs before it answers its first request. Safe to run on every cold start; on a database that is
 * already up to date it costs a handful of reads. */
async function startup(db, { seedDemoData = false, demoAccounts = true } = {}) {
  const created = await ensureSchema(db);
  if (created) console.log("Created the tables in " + db.url.replace(/\?.*/, ""));
  const D = loadData();
  await syncContentIfChanged(db, D);
  await runMigrations(db);                                       // one-off data fixes, applied once per database
  if (seedDemoData && await seedIfEmpty(db, D)) console.log("Filled the empty database with the Singapore sample schools and students.");
  if (demoAccounts) await ensureDemoAccounts(db);
  return db;
}

module.exports = { ensureSchema, startup, syncContent, syncContentIfChanged, seedIfEmpty, ensureDemoAccounts, loadData };

if (require.main === module) (async () => {
  const demo = process.argv.includes("--demo");
  const db = connect();
  if (!db.isLocal && process.argv.includes("--force")) { console.error("--force only wipes a local file database. Refusing to touch " + db.url); process.exit(1); }
  if (db.isLocal && process.argv.includes("--force")) {
    await db.close();
    const file = LOCAL_FILE;
    for (const f of [file, file + "-wal", file + "-shm"]) fs.rmSync(f, { force: true });
    return main(connect(), demo);
  }
  return main(db, demo);
})().catch(e => { console.error(e.message); process.exit(1); });

async function main(db, demo) {
  const D = loadData();
  const created = await ensureSchema(db);
  if (!created && demo) { console.error(db.url + " already has tables. Use npm run db:reset:demo for a local file."); process.exit(1); }
  await syncContentIfChanged(db, D);
  await runMigrations(db);
  if (demo) await seedDemo(db, D);
  console.log((created ? "Created " : "Updated ") + db.url + (demo ? " with demo data (every login uses the password \"demo\")" : " (content only: add accounts with db/admin.js)"));
  for (const t of ["schools", "users", "classes", "students", "projects", "accessories", "quiz_questions"])
    console.log("  " + t.padEnd(16) + (await db.get("SELECT COUNT(*) c FROM " + t)).c);
  await db.close();
}
