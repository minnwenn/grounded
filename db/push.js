#!/usr/bin/env node
/* Copy a local database file (default db/grounded.db) into the EMPTY Turso database named by TURSO_DATABASE_URL.
 * This is how the demo data you made locally gets onto Vercel. It refuses to touch a database that already has accounts.
 *
 *   vercel env pull .env                                   (gets TURSO_DATABASE_URL and TURSO_AUTH_TOKEN)
 *   node --env-file=.env db/push.js [path/to/local.db]     or:  npm run db:push
 *
 * Only student/school data is copied. Content (projects, quiz...) comes from public/js/data.js, and logins/rate limits are not copied.
 */
const path = require("path");
const { connect, LOCAL_FILE } = require("./client");
const { ensureSchema, syncContentIfChanged } = require("./init");
const { runMigrations } = require("./migrations");

const TABLES = ["cohorts", "schools", "users", "classes", "students", "student_projects", "photo_submissions", "photo_images", "ledger",
  "quiz_answers", "buddies", "student_accessories", "garden_plants", "missions", "batches", "batch_events"];
const CHUNK = 100;

(async () => {
  const file = path.resolve(process.argv[2] || LOCAL_FILE);
  if (!process.env.TURSO_DATABASE_URL) { console.error("TURSO_DATABASE_URL is not set. Run: vercel env pull .env, then npm run db:push"); process.exit(1); }
  const src = connect({ url: "file:" + file }), dst = connect();
  try {
    await ensureSchema(dst); await syncContentIfChanged(dst); await runMigrations(dst);
    const used = await dst.get("SELECT (SELECT COUNT(*) FROM users) u, (SELECT COUNT(*) FROM students) s, (SELECT COUNT(*) FROM schools) c");
    if (used.u || used.s || used.c) { console.error("The Turso database already has accounts or schools. Refusing to copy into it."); process.exit(1); }
    for (const t of TABLES) {
      const rows = await src.all("SELECT * FROM " + t);
      if (!rows.length) { console.log(t.padEnd(20) + 0); continue; }
      const cols = Object.keys(rows[0]), sql = "INSERT INTO " + t + "(" + cols.join(",") + ") VALUES (" + cols.map(() => "?").join(",") + ")";
      for (let i = 0; i < rows.length; i += CHUNK)
        await dst.batch(rows.slice(i, i + CHUNK).map(r => [sql, ...cols.map(c => (r[c] instanceof ArrayBuffer ? Buffer.from(r[c]) : r[c]))]));
      console.log(t.padEnd(20) + rows.length);
    }
    console.log("Done. " + file + " is now in " + dst.url.replace(/\?.*/, ""));
  } finally { src.close(); dst.close(); }
})().catch(e => { console.error(e.message); process.exit(1); });
