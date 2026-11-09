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
];

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

module.exports = { runMigrations };
