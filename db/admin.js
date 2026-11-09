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
 * On Railway, run it in the service shell, e.g.  node db/admin.js teacher a@school.sg "Ms Tan" 'a-long-password' 1
 */
const crypto = require("crypto");
const { openDb, assertSchema, createDb, DEFAULT_FILE } = require("./init");
const { hashPassword } = require("./auth");
const fs = require("fs");

const [cmd, ...a] = process.argv.slice(2);
const db = fs.existsSync(DEFAULT_FILE) ? openDb() : createDb();
assertSchema(db);
const die = m => { console.error(m); process.exit(1); };
const need = n => a.length < n && die("Missing arguments, see the usage at the top of db/admin.js");
const strong = p => p.length >= 8 || die("Use a password of at least 8 characters.");

if (cmd === "coffeebot") {
  need(3); strong(a[2]);
  db.prepare("INSERT INTO users(role,name,email,password_hash) VALUES ('coffeebot',?,?,?)").run(a[1], a[0], hashPassword(a[2]));
  console.log("CoffeeBot account created for " + a[0]);
} else if (cmd === "school") {
  need(2);
  db.prepare("INSERT OR IGNORE INTO cohorts(name) VALUES (?)").run(a[0]);
  const cohort = db.prepare("SELECT id FROM cohorts WHERE name=?").get(a[0]).id;
  const r = db.prepare("INSERT INTO schools(name,cohort_id) VALUES (?,?)").run(a[1], cohort);
  console.log("School created, id " + r.lastInsertRowid);
} else if (cmd === "teacher") {
  need(4); strong(a[2]);
  if (!db.prepare("SELECT 1 FROM schools WHERE id=?").get(a[3])) die("No school with id " + a[3]);
  db.prepare("INSERT INTO users(role,name,email,password_hash,school_id) VALUES ('teacher',?,?,?,?)").run(a[1], a[0], hashPassword(a[2]), Number(a[3]));
  console.log("Teacher account created for " + a[0]);
} else if (cmd === "class") {
  need(3);
  const t = db.prepare("SELECT id FROM users WHERE email=? AND role='teacher'").get(a[1]);
  if (!t) die("No teacher with email " + a[1]);
  if (!db.prepare("SELECT 1 FROM schools WHERE id=?").get(a[0])) die("No school with id " + a[0]);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";                       // no 0/O/1/I
  const part = () => Array.from(crypto.randomBytes(4), b => alphabet[b % alphabet.length]).join("");
  const code = part() + "-" + part();
  db.prepare("INSERT INTO classes(school_id,teacher_id,name,code) VALUES (?,?,?,?)").run(Number(a[0]), t.id, a[2], code);
  console.log("Class created. Students join with the class code: " + code);
} else if (cmd === "email") {
  need(2);
  const [oldEmail, newEmail] = a;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) || newEmail.length > 200) die("That does not look like an email address.");
  const u = db.prepare("SELECT id,name,role FROM users WHERE email=?").get(oldEmail);
  if (!u) die("No account uses the email " + oldEmail);
  const clash = db.prepare("SELECT id FROM users WHERE email=? AND id<>?").get(newEmail, u.id);
  if (clash) die(newEmail + " is already used by another account.");
  db.prepare("UPDATE users SET email=? WHERE id=?").run(newEmail, u.id);
  console.log(u.name + " (" + u.role + ") now logs in with " + newEmail + ". Their password and class are unchanged.");
} else if (cmd === "code") {
  need(2);
  const [oldCode, newCode] = a;
  if (!/^[A-Za-z0-9-]{3,40}$/.test(newCode)) die("A class code can use letters, numbers and dashes only, 3 to 40 characters.");
  const cls = db.prepare("SELECT id,name FROM classes WHERE code=?").get(oldCode);
  if (!cls) die("No class has the code " + oldCode);
  const clash = db.prepare("SELECT id FROM classes WHERE code=? AND id<>?").get(newCode, cls.id);
  if (clash) die(newCode + " is already used by another class.");
  db.prepare("UPDATE classes SET code=? WHERE id=?").run(newCode, cls.id);
  console.log("Class " + cls.name + " now uses the code " + newCode + " (the old code " + oldCode + " no longer works). Students keep their accounts.");
} else if (cmd === "list") {
  console.log("users:"); db.prepare("SELECT id,role,email,name,school_id FROM users").all().forEach(r => console.log("  ", JSON.stringify(r)));
  console.log("schools:"); db.prepare("SELECT id,name FROM schools").all().forEach(r => console.log("  ", JSON.stringify(r)));
  console.log("classes:"); db.prepare("SELECT c.id,c.name,c.code,u.email AS teacher FROM classes c LEFT JOIN users u ON u.id=c.teacher_id").all().forEach(r => console.log("  ", JSON.stringify(r)));
} else die("Usage: see the comment at the top of db/admin.js");
