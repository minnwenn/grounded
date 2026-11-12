#!/usr/bin/env node
/* Create the first accounts on a real (non-demo) database. Run from the project root:
 *
 *   node db/admin.js coffeebot  <email> <name> <password>
 *   node db/admin.js school     <cohort> <school name>                      -> prints the school id
 *   node db/admin.js teacher    <email> <name> <password> <school id>
 *   node db/admin.js class      <school id> <teacher email> <class name>    -> prints the class code
 *   node db/admin.js email      <old email> <new email>                      -> changes a teacher's or staff member's login email
 *   node db/admin.js code       <old code> <new code>                       -> renames a class code (letters, numbers, dashes)
 *   node db/admin.js list
 *
 * It uses the same database as the app: Turso when TURSO_DATABASE_URL is set (run `vercel env pull .env` first, then
 * `node --env-file=.env db/admin.js ...`), otherwise the local file db/grounded.db.
 * Example:  node --env-file=.env db/admin.js teacher a@school.sg "Ms Tan" 'a-long-password' 1
 */
const crypto = require("crypto");
const { connect } = require("./client");
const { startup } = require("./init");
const { hashPassword } = require("./auth");

const [cmd, ...a] = process.argv.slice(2);
const die = m => { console.error(m); process.exit(1); };
const need = n => a.length < n && die("Missing arguments, see the usage at the top of db/admin.js");
const strong = p => p.length >= 8 || die("Use a password of at least 8 characters.");

async function main(db) {
  await startup(db, { demoAccounts: false });
  const one = (sql, ...x) => db.get(sql, ...x), run = (sql, ...x) => db.run(sql, ...x);
  if (cmd === "coffeebot") {
    need(3); strong(a[2]);
    await run("INSERT INTO users(role,name,email,password_hash) VALUES ('coffeebot',?,?,?)", a[1], a[0], hashPassword(a[2]));
    console.log("CoffeeBot account created for " + a[0]);
  } else if (cmd === "school") {
    need(2);
    await run("INSERT OR IGNORE INTO cohorts(name) VALUES (?)", a[0]);
    const cohort = (await one("SELECT id FROM cohorts WHERE name=?", a[0])).id;
    const r = await run("INSERT INTO schools(name,cohort_id) VALUES (?,?)", a[1], cohort);
    console.log("School created, id " + r.lastInsertRowid);
  } else if (cmd === "teacher") {
    need(4); strong(a[2]);
    if (!await one("SELECT 1 x FROM schools WHERE id=?", a[3])) die("No school with id " + a[3]);
    await run("INSERT INTO users(role,name,email,password_hash,school_id) VALUES ('teacher',?,?,?,?)", a[1], a[0], hashPassword(a[2]), Number(a[3]));
    console.log("Teacher account created for " + a[0]);
  } else if (cmd === "class") {
    need(3);
    const t = await one("SELECT id FROM users WHERE email=? AND role='teacher'", a[1]);
    if (!t) die("No teacher with email " + a[1]);
    if (!await one("SELECT 1 x FROM schools WHERE id=?", a[0])) die("No school with id " + a[0]);
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";                       // no 0/O/1/I
    const part = () => Array.from(crypto.randomBytes(4), b => alphabet[b % alphabet.length]).join("");
    const code = part() + "-" + part();
    await run("INSERT INTO classes(school_id,teacher_id,name,code) VALUES (?,?,?,?)", Number(a[0]), t.id, a[2], code);
    console.log("Class created. Students join with the class code: " + code);
  } else if (cmd === "email") {
    need(2);
    const [oldEmail, newEmail] = a;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) || newEmail.length > 200) die("That does not look like an email address.");
    const u = await one("SELECT id,name,role FROM users WHERE email=?", oldEmail);
    if (!u) die("No account uses the email " + oldEmail);
    if (await one("SELECT id FROM users WHERE email=? AND id<>?", newEmail, u.id)) die(newEmail + " is already used by another account.");
    await run("UPDATE users SET email=? WHERE id=?", newEmail, u.id);
    console.log(u.name + " (" + u.role + ") now logs in with " + newEmail + ". Their password and class are unchanged.");
  } else if (cmd === "code") {
    need(2);
    const [oldCode, newCode] = a;
    if (!/^[A-Za-z0-9-]{3,40}$/.test(newCode)) die("A class code can use letters, numbers and dashes only, 3 to 40 characters.");
    const cls = await one("SELECT id,name FROM classes WHERE code=?", oldCode);
    if (!cls) die("No class has the code " + oldCode);
    if (await one("SELECT id FROM classes WHERE code=? AND id<>?", newCode, cls.id)) die(newCode + " is already used by another class.");
    await run("UPDATE classes SET code=? WHERE id=?", newCode, cls.id);
    console.log("Class " + cls.name + " now uses the code " + newCode + " (the old code " + oldCode + " no longer works). Students keep their accounts.");
  } else if (cmd === "list") {
    console.log("users:"); (await db.all("SELECT id,role,email,name,school_id FROM users")).forEach(r => console.log("  ", JSON.stringify(r)));
    console.log("schools:"); (await db.all("SELECT id,name FROM schools")).forEach(r => console.log("  ", JSON.stringify(r)));
    console.log("classes:"); (await db.all("SELECT c.id,c.name,c.code,u.email AS teacher FROM classes c LEFT JOIN users u ON u.id=c.teacher_id")).forEach(r => console.log("  ", JSON.stringify(r)));
  } else die("Usage: see the comment at the top of db/admin.js");
}

const db = connect();
main(db).catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.close());
