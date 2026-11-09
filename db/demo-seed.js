/* Demo data: four invented Singapore secondary schools with teachers, classes and students (all names are made up,
 * and the schools are invented, not real ones). Class sizes and per-project progress come from js/dashboard-data.js,
 * so the database and the CoffeeBot dashboards tell the same story. Every account's password is "demo".
 * Deterministic: the same names and numbers every time. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const { hashPassword } = require("./auth");
const { realDay, dayToDate } = require("./clock");

const DEMO_PHOTOS = {};   // project id -> placeholder JPEG (db/demo-photos/<id>.jpg), so the teacher's gallery is not empty in the demo
try { fs.readdirSync(path.join(__dirname, "demo-photos")).forEach(f => { DEMO_PHOTOS[f.replace(/\.jpg$/, "")] = fs.readFileSync(path.join(__dirname, "demo-photos", f)); }); } catch (e) {}
const loadDash = () => vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/dashboard-data.js"), "utf8") + ";DASH", { localStorage: { getItem() { return null; } } });

function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ----- names: a mix that looks like a Singapore Secondary 1 cohort (roughly 74% Chinese, 13% Malay, 9% Indian, 4% other) ----- */
const CN_SURNAME = ["Tan","Lim","Lee","Ng","Ong","Wong","Goh","Chua","Chan","Koh","Teo","Yeo","Ho","Low","Sim","Toh","Chew","Foo","Tay","Lau","Chong","Yap","Soh","Phua","Heng","Seah","Quek","Leong","Liew","Wee"];
const CN_GIVEN = ["Wei Jie","Jun Hao","Zhi Hao","Kai Xiang","Jia Hao","Yu Xuan","Xin Yi","Jia Min","Hui Ling","En Ting","Rui En","Shi Min","Jing Yi","Yi Xuan","Si Yu","Wen Hao","Zhe Yu","Ming Hui","Jia Hui","Yan Ting","Zi Xuan","Jun Jie","Yong Sheng","Xiao Ming","Li Ying","Pei Shan","Ke Xin","Hong Wei","Jian Wen","Yu Ting","Zi Yi","Chen Yu","Hao Ran","Yi Ning","Xuan Yi","Zheng Xi"];
const WESTERN = ["Ethan","Joshua","Isaac","Chloe","Rachel","Natalie","Amelia","Dylan","Caleb","Joel","Megan","Hannah","Gabriel","Nathan","Ryan","Jayden","Chelsea","Zachary","Olivia","Aiden"];
const MY_M = ["Muhammad Haziq","Muhammad Irfan","Muhammad Danish","Ahmad Firdaus","Mohamed Aqil","Muhammad Hakim","Aiman","Imran","Harith","Muhammad Iqbal","Adam","Zaki"];
const MY_F = ["Nur Aisyah","Nurul Izzah","Siti Nur Aina","Nur Sabrina","Nur Alya","Nurul Huda","Aaliyah","Nur Farhana","Siti Aminah","Nur Damia","Nur Batrisyah","Insyirah"];
const MY_FATHER = ["Ismail","Abdullah","Rahman","Hassan","Osman","Yusof","Ibrahim","Salleh","Jaafar","Ahmad","Hamid","Rashid"];
const IN_M = ["Arjun","Rohan","Vikram","Karthik","Aravind","Surya","Dinesh","Naveen","Hari","Kishore","Pranav","Ashwin"];
const IN_F = ["Priya","Kavitha","Dharshini","Ananya","Divya","Meera","Lakshmi","Sangeetha","Nivetha","Harini","Keerthana","Shalini"];
const IN_FATHER = ["Rajan","Kumar","Krishnan","Subramaniam","Ganesan","Nair","Pillai","Raj","Muthu","Selvam"];
const OTHER = ["Daniel Pereira","Sarah Rozario","Marcus De Souza","Isabelle Sng","Aidan Shepherd","Natasha Gomes","Lucas Fernandez","Emily Oliveiro"];

function makeName(r) {
  const pick = a => a[Math.floor(r() * a.length)], x = r();
  let n;
  if (x < 0.74) n = r() < 0.18 ? pick(WESTERN) + " " + pick(CN_SURNAME) : pick(CN_SURNAME) + " " + pick(CN_GIVEN);
  else if (x < 0.87) n = r() < 0.5 ? pick(MY_M) + " Bin " + pick(MY_FATHER) : pick(MY_F) + " Binte " + pick(MY_FATHER);
  else if (x < 0.96) n = r() < 0.5 ? pick(IN_M) + " S/O " + pick(IN_FATHER) : pick(IN_F) + " D/O " + pick(IN_FATHER);
  else n = pick(OTHER);
  return n.length <= 30 ? n : makeName(r);
}

/* ----- teachers (one per class) ----- */
const TEACHERS = [
  ["Mrs Lim Hui Ling", "lim_hui_ling"], ["Mr Tan Boon Kiat", "tan_boon_kiat"], ["Mdm Rahimah Binte Yusof", "rahimah_yusof"],
  ["Ms Kavitha D/O Subramaniam", "kavitha_subramaniam"], ["Mr Ng Kok Wei", "ng_kok_wei"], ["Mrs Wong Mei Fen", "wong_mei_fen"],
  ["Mr Muhammad Faizal Bin Osman", "faizal_osman"], ["Ms Chua Pei Shan", "chua_pei_shan"], ["Mr Ravi S/O Krishnan", "ravi_krishnan"],
  ["Mrs Goh Siew Chin", "goh_siew_chin"], ["Ms Nurul Aini Binte Hamid", "nurul_aini"], ["Mr Daniel Koh", "daniel_koh"]
];
const SCHOOL_NAMES = { s1: "Sungei Rimba Secondary School", s2: "Pelita Hills Secondary School", s3: "Bukit Teratai Secondary School", s4: "Tanjong Merlin Secondary School" };
const SCHOOL_TAG = { s1: ["RIMB", "sungeirimba"], s2: ["PELI", "pelitahills"], s3: ["TERA", "bukitteratai"], s4: ["MERL", "tanjongmerlin"] };
const FEEDBACK = {
  p4: ["That looks like your deodoriser sachets. Great work!", "Nice sachets! The dried grounds are easy to see.", "Clear photo of the finished sachets. Well done!"],
  p5: ["That looks like your coffee watercolour. Lovely colours!", "Great painting! You can see the coffee tones clearly.", "Nice work, the coffee wash looks good."],
  p2: ["Your seedling looks healthy. Great job feeding it!", "Nice seedling with the grounds mixed into the soil.", "Good photo of your plant and its pot."],
  p6: ["That looks like your coffee ground scrub. Well done!", "Nice scrub in a clean container.", "Clear photo of the finished scrub. Great work!"]
};

function seedDemo(db, D) {
  const DASH = loadDash(), r = rng(20260921), today = realDay(), pw = hashPassword("demo");
  const run = (sql, ...a) => db.prepare(sql).run(...a), id = x => Number(x.lastInsertRowid), pick = a => a[Math.floor(r() * a.length)];
  const order = D.weeks.map(w => w.projects[0]), pts = Object.fromEntries(D.projects.map(p => [p.id, p.pts]));
  const buyable = D.accessories.filter(a => a.how === "buy");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const stamp = (day, h = 12) => dayToDate(day) + " " + String(h).padStart(2, "0") + ":" + String(Math.floor(r() * 60)).padStart(2, "0") + ":00";

  db.exec("BEGIN");
  try {
    const cohort = {}, school = {};
    [...new Set(D.schools.map(s => s.cohort))].forEach(c => cohort[c] = id(run("INSERT INTO cohorts(name) VALUES (?)", c)));
    D.schools.forEach(s => school[s.id] = id(run("INSERT INTO schools(name,cohort_id) VALUES (?,?)", SCHOOL_NAMES[s.id] || s.name, cohort[s.cohort])));
    run("INSERT INTO users(role,name,email,password_hash) VALUES ('coffeebot','CoffeeBot team','team@coffeebot.example',?)", pw);

    let teacherNo = 0, firstTeacher = null;
    D.schools.forEach(sc => {
      const sid = sc.id, dash = DASH.school(sid), classes = DASH.classes(sid), [abbr, domain] = SCHOOL_TAG[sid];
      const startDay = today - 48 + DASH.cohortStartWeek(sid) * 7;   // cohort A started about 7 weeks ago, cohort B about 4
      classes.forEach((c, ci) => {
        const [tname, local] = TEACHERS[teacherNo++ % TEACHERS.length];
        const email = sid === "s1" && ci === 0 ? "teacher_demo@demo.edu.sg" : local + "@" + domain + ".example";   // the main demo teacher has a short, memorable login
        const teacher = id(run("INSERT INTO users(role,name,email,password_hash,school_id) VALUES ('teacher',?,?,?,?)", tname, email, pw, school[sid]));
        if (!firstTeacher) firstTeacher = email;
        const code = sid === "s1" && ci === 0 ? "demosec-1D" : abbr + "-" + c.name.replace("Sec ", "") + Array.from({ length: 2 }, () => alphabet[Math.floor(r() * alphabet.length)]).join("");
        const cls = id(run("INSERT INTO classes(school_id,teacher_id,name,code) VALUES (?,?,?,?)", school[sid], teacher, c.name, code));

        const used = new Set(); let steps = 0, verifiedCount = 0, pendingLeft = (ci === 0 ? dash.waiting.length + (sid === "s1" ? 1 : 0) : 0), approvedByTeacher = sid === "s1" && ci === 0;
        for (let i = 0; i < c.students; i++) {
          let name; do name = makeName(r); while (used.has(name.toLowerCase())); used.add(name.toLowerCase());
          const v = order.filter(p => i < c.verified[p]).length;                       // verified prefix (nested by construction)
          const inprog = v < 4 && i < c.started[order[v]] ? v : -1;
          const recent = r() < dash.active / 100, engaged = v > 0 || inprog >= 0;
          const lastDays = !engaged && r() < 0.5 ? null : recent ? (r() < 0.7 ? 0 : 1) : 2 + Math.floor(r() * 9);
          const streak = lastDays === null ? 0 : recent ? Math.min(20, 1 + Math.floor(-Math.log(1 - r()) * dash.streak)) : 0;
          const joined = startDay + Math.floor(r() * 2);
          const stu = id(run("INSERT INTO students(class_id,name,password_hash,created_at,last_active) VALUES (?,?,?,?,?)", cls, name, pw, stamp(joined, 8), lastDays === null ? null : dayToDate(today - lastDays)));
          run("INSERT INTO buddies VALUES (?,?)", stu, streak);

          let beans = 0, points = 0;
          const earn = (kind, delta, reason, pid, day) => { run("INSERT INTO ledger(student_id,kind,delta,reason,project_id,created_at) VALUES (?,?,?,?,?,?)", stu, kind, delta, reason, pid, stamp(Math.min(day, today), 15)); if (kind === "beans") beans += delta; else points += delta; };

          for (let k = 0; k < v; k++) {                                                // verified projects
            const pid = order[k], done = Math.min(today - 1, startDay + 6 + k * 7 + Math.floor(r() * 5));
            run("INSERT INTO student_projects(student_id,project_id,steps_done,started_at,completed_at) VALUES (?,?,5,?,?)", stu, pid, dayToDate(done - 5), dayToDate(done));
            earn("beans", 20, "step", pid, done - 3);
            const teacherCase = approvedByTeacher && k === 0 && i > 2;                   // one photo the AI was unsure about and the teacher approved
            if (teacherCase) {
              approvedByTeacher = false;
              run("INSERT INTO photo_submissions(student_id,project_id,verdict,confidence,feedback,note,mode,status,reviewed_by,reviewed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                stu, pid, "unsure", 0.58, "Not sure this shows your " + D.projects.find(p => p.id === pid).name.toLowerCase() + ". Your teacher will take a look.", "AI unsure (confidence 0.58)", "ai", "approved", teacher, stamp(done + 1, 9), stamp(done, 14));
              earn("points", pts[pid], "teacher_approved", pid, done + 1);
            } else {
              run("INSERT INTO photo_submissions(student_id,project_id,verdict,confidence,feedback,mode,status,created_at) VALUES (?,?,?,?,?,?,?,?)",
                stu, pid, "pass", Math.round((0.8 + r() * 0.17) * 100) / 100, pick(FEEDBACK[pid]), "ai", "approved", stamp(done, 14));
              earn("points", pts[pid], "photo_verified", pid, done);
            }
            earn("beans", 10, "photo_verified", pid, done);
            steps += 5; verifiedCount++;
          }
          if (inprog >= 0) {                                                           // the project they are working on now
            const pid = order[inprog];
            let n = r() < 0.25 ? 4 : Math.floor(r() * 4), pending = false;
            if (pendingLeft > 0) { pending = true; pendingLeft--; n = 5; }   // the first few in-progress students have a photo waiting for the teacher
            run("INSERT INTO student_projects(student_id,project_id,steps_done,started_at) VALUES (?,?,?,?)", stu, pid, n, dayToDate(today - 1 - Math.floor(r() * 6)));
            earn("beans", Math.min(n, 4) * 5, "step", pid, today - 1);
            if (pending) {
              const conf = pick([0.42, 0.55, 0.47]), retakes = r() < 0.3;
              run("INSERT INTO photo_submissions(student_id,project_id,verdict,confidence,feedback,note,mode,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                stu, pid, "unsure", conf, "Not sure this shows your project. Your teacher will take a look.", retakes ? "Failed the photo check 4 times" : "AI unsure (confidence " + conf.toFixed(2) + ")", "ai", "pending", stamp(today - 1, 16));
              earn("beans", 10, "photo_verified", pid, today - 1);
            }
            steps += n === 5 ? 5 : n;
          }

          if (lastDays !== null) {                                                     // daily quiz history, one answer per streak day
            const acc = DASH.quiz(sid)[3] / 100, last = today - lastDays;
            for (let k = 0; k < Math.max(1, streak); k++) {
              const day = last - k, qi = ((day % D.quiz.length) + D.quiz.length) % D.quiz.length, q = D.quiz[qi], ok = r() < acc;
              run("INSERT OR IGNORE INTO quiz_answers VALUES (?,?,?,?,?)", stu, dayToDate(day), qi + 1, ok ? Math.max(0, q.a) : (Math.max(0, q.a) + 1) % q.o.length, q.a < 0 || ok ? 1 : 0);
              earn("beans", q.a < 0 || ok ? 5 : 1, "quiz", null, day);
            }
          }
          if (beans >= 25 && r() < 0.4) {                                              // some students have spent beans on their buddy
            const a = pick(buyable.filter(x => x.cost <= beans));
            if (a) { earn("beans", -a.cost, "purchase", null, today - 1 - Math.floor(r() * 5)); run("INSERT INTO student_accessories VALUES (?,?,1)", stu, a.id); }
          }
        }
        // class missions: partly done, so the progress bars have something to show
        const g = (n, step, cap) => Math.min(Math.ceil(n * 1.35 / step) * step, Math.round(cap / step) * step);
        run("INSERT INTO missions(class_id,name,goal,unit,created_by) VALUES (?,?,?,?,?)", cls, "Complete " + g(steps, 10, c.students * 17) + " project steps as a class", g(steps, 10, c.students * 17), "steps", teacher);
        run("INSERT INTO missions(class_id,name,goal,unit,created_by) VALUES (?,?,?,?,?)", cls, "Get " + g(verifiedCount, 5, c.students * 3.4) + " projects verified together", g(verifiedCount, 5, c.students * 3.4), "projects", teacher);
      });
    });

    D.batches.forEach(b => {
      run("INSERT INTO batches VALUES (?,?,?,?,?,?)", b.id, school[b.school], cohort[b.cohort], b.outlet, b.kg, b.events.some(e => e[2] === "wait") ? 0 : 1);
      b.events.forEach(e => run("INSERT INTO batch_events(batch_id,happened,text,done) VALUES (?,?,?,?)", b.id, e[0] === "pending" ? null : e[0], e[1], e[2] === "ok" ? 1 : 0));
    });
    // give every demo submission its sample image
    db.prepare("SELECT id, project_id FROM photo_submissions").all().forEach(r => { if (DEMO_PHOTOS[r.project_id]) run("INSERT OR IGNORE INTO photo_images(submission_id,jpeg) VALUES (?,?)", r.id, DEMO_PHOTOS[r.project_id]); });
    db.exec("COMMIT");
    return { teacher: firstTeacher };
  } catch (e) { db.exec("ROLLBACK"); throw e; }
}

module.exports = { seedDemo, SCHOOL_NAMES };
