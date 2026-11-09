/* One-off data fixes that run automatically, once, when the server starts (and are remembered in the `migrations`
 * table so they never run twice). This is how a deployed database gets a change without anyone opening a shell.
 * Add new entries at the END. Each one must be safe to run on any database, including one that has none of the
 * data it expects: check first, change only what matches. */
const MIGRATIONS = [
  { id: "001-demo-teacher-login-and-class-code",
    // The main demo teacher and class were renamed in the sample data. Databases created before that still have the
    // old values, so rename them. Only the exact old values are touched, and only if the new ones are not taken.
    run(db) {
      const out = [];
      const t = db.prepare("SELECT id FROM users WHERE email = ? AND role = 'teacher'").get("lim_hui_ling@sungeirimba.example");
      if (t && !db.prepare("SELECT 1 FROM users WHERE email = ?").get("teacher_demo@demo.edu.sg")) {
        db.prepare("UPDATE users SET email = ? WHERE id = ?").run("teacher_demo@demo.edu.sg", t.id);
        out.push("teacher login is now teacher_demo@demo.edu.sg");
      }
      const c = db.prepare("SELECT id FROM classes WHERE code = ?").get("RIMB-1A7K");
      if (c && !db.prepare("SELECT 1 FROM classes WHERE code = ? AND id <> ?").get("demosec-1D", c.id)) {
        db.prepare("UPDATE classes SET code = ? WHERE id = ?").run("demosec-1D", c.id);
        out.push("class code is now demosec-1D");
      }
      return out.length ? out.join("; ") : "nothing to change on this database";
    } }
  ,
  { id: "002-garden-plants-table",
    // The class garden. New databases get this table from schema.sql; older ones get it here.
    run(db) {
      db.exec(`CREATE TABLE IF NOT EXISTS garden_plants (
        id INTEGER PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id),
        species TEXT NOT NULL,
        planted_day INTEGER NOT NULL,
        UNIQUE (student_id, project_id))`);
      return "garden_plants table ready";
    } },
  { id: "003-demo-garden-backfill",
    // Sample (demo) classes finished projects before the garden existed. Give them plants so the garden is not empty.
    // Only students of demo teachers (reserved .example addresses, or teacher_demo@demo.edu.sg) are touched; real
    // students choose their own plants. Every fifth student keeps their latest project unplanted, so the
    // "choose your plant" step can be tried out.
    run(db) { return plantDemoGarden(db); } }
];

/* Plants for the finished projects of demo students (see migration 003). Also used when sample data is first created. */
function plantDemoGarden(db) {
  const { loadData } = require("./init"), { dateToDay, realDay } = require("./clock");
  const species = loadData().plants.map(p => p.id);
  const rows = db.prepare(`SELECT sp.student_id sid, sp.project_id pid, sp.completed_at done FROM student_projects sp
    JOIN students s ON s.id = sp.student_id JOIN classes c ON c.id = s.class_id JOIN users u ON u.id = c.teacher_id
    WHERE sp.steps_done = 5 AND (u.email LIKE '%.example' OR u.email = 'teacher_demo@demo.edu.sg')
      AND NOT EXISTS (SELECT 1 FROM photo_submissions ps WHERE ps.student_id = sp.student_id AND ps.project_id = sp.project_id AND ps.status = 'pending')
      AND NOT EXISTS (SELECT 1 FROM garden_plants g WHERE g.student_id = sp.student_id AND g.project_id = sp.project_id)
    ORDER BY sp.student_id, sp.completed_at, sp.project_id`).all();
  const lastOf = {}; rows.forEach(r => { lastOf[r.sid] = r; });
  const hash = (a, b) => { let h = 2166136261; for (const c of a + ":" + b) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  let planted = 0;
  rows.forEach(r => {
    const h = hash(String(r.sid), r.pid);
    if (lastOf[r.sid] === r && r.sid % 5 === 2) return;                                // every fifth student keeps their latest project to plant
    const day = r.done && /^\d{4}-\d\d-\d\d/.test(r.done) ? dateToDay(r.done.slice(0, 10)) : realDay() - 10;
    db.prepare("INSERT INTO garden_plants(student_id,project_id,species,planted_day) VALUES (?,?,?,?)").run(r.sid, r.pid, species[h % species.length], day);
    planted++;
  });
  return planted ? "planted " + planted + " sample plants" : "nothing to plant on this database";
}

function runMigrations(db) {
  db.exec("CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))");
  for (const m of MIGRATIONS) {
    if (db.prepare("SELECT 1 FROM migrations WHERE id = ?").get(m.id)) continue;
    db.exec("BEGIN");
    try {
      const note = m.run(db);
      db.prepare("INSERT INTO migrations(id) VALUES (?)").run(m.id);
      db.exec("COMMIT");
      console.log("Applied migration " + m.id + ": " + note);
    } catch (e) {
      db.exec("ROLLBACK");
      console.error("Migration " + m.id + " failed and was rolled back: " + e.message);   // the server still starts
    }
  }
}

module.exports = { runMigrations, plantDemoGarden };
