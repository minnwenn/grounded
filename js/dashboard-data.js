/* Dashboard data for the CoffeeBot and teacher dashboards.
 * ALL demo numbers live here. View code only calls DASH.* functions, so this module can later
 * be switched to database queries without touching the views.
 *
 * Units: every kg is WET-EQUIVALENT kg unless the name says "dried".
 *   wet-equivalent kg = dried kg x 2.5, water removed = dried kg x 1.5
 */
var DASH = (function () {
  "use strict";

  /* ---------- config (editable rules) ---------- */
  var CONFIG = {
    wetPerDried: 2.5,
    waterPerDried: 1.5,
    // dried grams of grounds per project (editable)
    gramsDried: { p4: 50, p5: 20, p2: 30, p6: 50 },
    projectOrder: ["p4", "p5", "p2", "p6"],            // week 1..4
    projectNames: { p4: "Deodoriser sachets", p5: "Coffee watercolour", p2: "Grow a seedling", p6: "Coffee ground scrub" },
    collectedPerIssued: 1.1,                           // collected = issued x 1.1
    dryingLossShare: 0.05,                             // 5% of collected lost in drying; the rest of the gap is handling
    aiRetakeLimit: 3,                                  // still failing after 3 retakes -> teacher
    aiAttemptsPerSubmission: 1.4                       // average AI calls per submitted photo (demo)
  };

  /* ---------- assumptions the dashboard lets people edit (defaults) ---------- */
  var DEFAULTS = {
    totalGroundsPerMonth: 1000,     // kg wet, placeholder: confirm with CoffeeBot
    existingReuseLow: 10, existingReuseHigh: 20,       // % CoffeeBot already reuses
    baseline: "landfill",           // or "incineration"
    landfill: 0.627,                // kg CO2e per kg wet
    incineration: 0.02128,          // kg CO2e per kg wet
    grid: 0.402,                    // kg CO2 per kWh
    drying: "solar",                // solar (rooftop sun-drying, observed) | theoretical | practical
    dryingKwh: { theoretical: 0.628, practical: 0.889, solar: 0 },   // kWh per kg water removed
    aiGramsPerCall: 0.03,           // g CO2e per AI check
    deliveryTripKm: 20,             // km per delivery, round trip outlet -> school -> back (assumed)
    deliveryKgPerKm: 0.17,          // kg CO2e per km, average car (UK government conversion factors, rounded)
    displacedCredit: 0              // kg CO2e: not claimed until sourced
  };
  var AKEY = "beanagain.dash.v1";
  var A = (function () {
    var a = JSON.parse(JSON.stringify(DEFAULTS));
    try { var s = JSON.parse(localStorage.getItem(AKEY)); if (s) Object.keys(s).forEach(function (k) { if (k in a && k !== "dryingKwh") a[k] = s[k]; }); } catch (e) {}
    return a;
  })();
  function setAssumption(k, v) {
    if (!(k in DEFAULTS)) return;
    A[k] = v;
    var out = {}; Object.keys(A).forEach(function (x) { if (JSON.stringify(A[x]) !== JSON.stringify(DEFAULTS[x])) out[x] = A[x]; });
    try { localStorage.setItem(AKEY, JSON.stringify(out)); } catch (e) {}
  }
  function resetAssumptions() { A = JSON.parse(JSON.stringify(DEFAULTS)); try { localStorage.removeItem(AKEY); } catch (e) {} }

  /* ---------- demo facts ---------- */
  var CLIENTS = [{ id: "DBS", name: "DBS" }, { id: "SMU", name: "SMU" }];
  var OUTLETS = [
    { id: "o1", name: "DBS Asia Hub", client: "DBS" },
    { id: "o2", name: "DBS Asia Central", client: "DBS" },
    { id: "o3", name: "SMU School of Law", client: "SMU" }
  ];
  // Calendar weeks of the programme so far (Monday dates)
  var WEEKS = ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"];
  var COHORTS = [{ id: "2026 A", startWeek: 0 }, { id: "2026 B", startWeek: 3 }];

  // Per-school share of students who STARTED / VERIFIED each project (p4, p5, p2, p6).
  // dates.verified = when the batch's last project was verified; null = cohort still running.
  var SCHOOLS = [
    { id: "s1", name: "Maple Secondary", cohort: "2026 A", batch: "B-1042", outlet: "o1", students: 68, classSizes: [23, 23, 22], active: 91,
      started: [.99, .96, .92, .86], verified: [.85, .75, .55, .45], waiting: [1], aiPass: 94, streak: 6.2, lastDays: 0,
      dates: { collected: "2026-09-02", dried: "2026-09-04", delivered: "2026-09-14", issued: "2026-09-21", verified: "2026-10-23" } },
    { id: "s2", name: "Riverside Secondary", cohort: "2026 A", batch: "B-1043", outlet: "o3", students: 49, classSizes: [25, 24], active: 84,
      started: [.97, .93, .86, .78], verified: [.80, .70, .45, .30], waiting: [], aiPass: 93, streak: 4.8, lastDays: 0,
      dates: { collected: "2026-09-05", dried: "2026-09-07", delivered: "2026-09-15", issued: "2026-09-21", verified: "2026-10-23" } },
    { id: "s3", name: "St Anne's Secondary", cohort: "2026 B", batch: "B-1051", outlet: "o2", students: 97, classSizes: [25, 24, 24, 24], active: 72,
      started: [.95, .88, .80, .70], verified: [.72, .62, .54, .44], waiting: [1], aiPass: 91, streak: 3.1, lastDays: 2,
      dates: { collected: "2026-09-28", dried: "2026-09-30", delivered: "2026-10-07", issued: "2026-10-12", verified: null } },
    { id: "s4", name: "Hillcrest Secondary", cohort: "2026 B", batch: "B-1052", outlet: "o1", students: 51, classSizes: [26, 25], active: 58,
      started: [.90, .82, .72, .60], verified: [.64, .54, .46, .36], waiting: [], aiPass: 90, streak: 1.9, lastDays: 4,
      dates: { collected: "2026-09-29", dried: "2026-10-01", delivered: "2026-10-08", issued: "2026-10-12", verified: null } }
  ];
  // Week-by-week quiz accuracy (% correct), weeks 1..4 of each cohort
  var QUIZ = { s1: [64, 70, 76, 81], s2: [61, 66, 72, 77], s3: [58, 63, 69, 72], s4: [55, 58, 63, 66] };
  // Class-to-class spread around the school average (keeps the school mean the same)
  var SPREAD = { 2: [1.05, 0.95], 3: [1.08, 1.0, 0.92], 4: [1.1, 1.03, 0.97, 0.9] };
  var CLASS_NAMES = { 2: ["Sec 1A", "Sec 2A"], 3: ["Sec 1A", "Sec 1B", "Sec 2A"], 4: ["Sec 1A", "Sec 1B", "Sec 2A", "Sec 2B"] };

  /* ---------- derived facts (what a database would store as rows) ---------- */
  var CLASSES = [];
  SCHOOLS.forEach(function (s) {
    var n = s.classSizes.length;
    s.classSizes.forEach(function (size, i) {
      var m = SPREAD[n][i], c = { id: s.id + "c" + (i + 1), school: s.id, name: CLASS_NAMES[n][i], students: size, started: {}, finished: {}, verified: {} };
      CONFIG.projectOrder.forEach(function (p, k) {
        var st = Math.min(size, Math.round(size * Math.min(1, s.started[k] * m)));
        var ve = Math.min(st, Math.round(size * Math.min(1, s.verified[k] * m)));
        c.started[p] = st; c.verified[p] = ve;
        c.finished[p] = Math.min(st, ve + Math.round((st - ve) * 0.4));   // photo submitted, not yet verified
      });
      CLASSES.push(c);
    });
  });

  /* ---------- helpers ---------- */
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function school(id) { return SCHOOLS.filter(function (s) { return s.id === id; })[0]; }
  function outlet(id) { return OUTLETS.filter(function (o) { return o.id === id; })[0]; }
  function classesOf(sid) { return CLASSES.filter(function (c) { return c.school === sid; }); }
  function schoolsFor(f) {
    f = f || {};
    return SCHOOLS.filter(function (s) {
      return (!f.school || s.id === f.school) && (!f.client || outlet(s.outlet).client === f.client) && (!f.cohort || s.cohort === f.cohort);
    });
  }
  function wetKgPerProject(p) { return CONFIG.gramsDried[p] * CONFIG.wetPerDried / 1000; }
  function wetKgPerStudent() { return sum(CONFIG.projectOrder.map(wetKgPerProject)); }   // 0.375
  function countBy(sid, field, p) { return sum(classesOf(sid).map(function (c) { return c[field][p]; })); }
  function kgBy(sid, field) { return sum(CONFIG.projectOrder.map(function (p) { return countBy(sid, field, p) * wetKgPerProject(p); })); }

  /* ---------- mass ---------- */
  function issuedKg(f) { return sum(schoolsFor(f).map(function (s) { return s.students * wetKgPerStudent(); })); }
  function verifiedKg(f) { return sum(schoolsFor(f).map(function (s) { return kgBy(s.id, "verified"); })); }
  function startedKg(f) { return sum(schoolsFor(f).map(function (s) { return kgBy(s.id, "started"); })); }
  function students(f) { return sum(schoolsFor(f).map(function (s) { return s.students; })); }
  function adopters(f) { // students who started at least one project = week-1 starters (every journey starts with p4)
    return sum(schoolsFor(f).map(function (s) { return Math.max.apply(null, CONFIG.projectOrder.map(function (p) { return countBy(s.id, "started", p); })); }));
  }
  function stages(f) {
    var issued = issuedKg(f), collected = issued * CONFIG.collectedPerIssued;
    var dryLoss = collected * CONFIG.dryingLossShare, dried = collected - dryLoss;
    var handling = dried - issued, started = startedKg(f), verified = verifiedKg(f);
    return [
      { key: "collected", label: "Collected", kg: collected, lost: 0 },
      { key: "dried", label: "Dried", kg: dried, lost: dryLoss, lostLabel: "lost in drying" },
      { key: "delivered", label: "Delivered", kg: issued, lost: handling, lostLabel: "lost in handling" },
      { key: "issued", label: "Issued", kg: issued, lost: 0 },
      { key: "started", label: "Started", kg: started, lost: issued - started, lostLabel: "issued, never started" },
      { key: "verified", label: "Verified", kg: verified, lost: started - verified, lostLabel: "started, not verified" }
    ];
  }

  /* ---------- time series ---------- */
  // Verified kg per school per calendar week: 70% in the project's own cohort week, 30% the week after.
  function verifiedByWeek(sid) {
    var s = school(sid), start = COHORTS.filter(function (c) { return c.id === s.cohort; })[0].startWeek;
    var out = WEEKS.map(function () { return 0; });
    CONFIG.projectOrder.forEach(function (p, k) {
      var kg = countBy(sid, "verified", p) * wetKgPerProject(p);
      var w = start + k;
      if (w < WEEKS.length) out[w] += kg * 0.7;
      out[Math.min(WEEKS.length - 1, w + 1)] += kg * 0.3;
    });
    return out;
  }
  function cumulative(a) { var t = 0; return a.map(function (x) { return t += x; }); }
  function verifiedCumByWeek(f) {
    var per = schoolsFor(f).map(function (s) { return verifiedByWeek(s.id); });
    return cumulative(WEEKS.map(function (_, w) { return sum(per.map(function (r) { return r[w]; })); }));
  }
  function issuedCumByWeek(f) {
    return WEEKS.map(function (_, w) {
      return sum(schoolsFor(f).filter(function (s) { return cohortStart(s) <= w; }).map(function (s) { return s.students * wetKgPerStudent(); }));
    });
  }
  function cohortStart(s) { return COHORTS.filter(function (c) { return c.id === s.cohort; })[0].startWeek; }
  function adoptersByWeek(f) {
    return WEEKS.map(function (_, w) {
      return sum(schoolsFor(f).filter(function (s) { return cohortStart(s) <= w; }).map(function (s) { return adopters({ school: s.id }); }));
    });
  }
  function activeSchoolsByWeek(f) { return WEEKS.map(function (_, w) { return schoolsFor(f).filter(function (s) { return cohortStart(s) <= w; }).length; }); }
  function monthOf(d) { return d.slice(0, 7); }
  function verifiedByMonth(f) {
    var per = WEEKS.map(function (_, w) { return sum(schoolsFor(f).map(function (s) { return verifiedByWeek(s.id)[w]; })); });
    var m = {};
    WEEKS.forEach(function (d, w) { m[monthOf(d)] = (m[monthOf(d)] || 0) + per[w]; });
    return Object.keys(m).map(function (k) { return { month: k, kg: m[k] }; });
  }

  /* ---------- carbon & cost ---------- */
  function aiCalls(f) {
    return Math.round(sum(schoolsFor(f).map(function (s) { return sum(CONFIG.projectOrder.map(function (p) { return countBy(s.id, "finished", p); })); })) * CONFIG.aiAttemptsPerSubmission);
  }
  function deliveryTrips(f) { return schoolsFor(f).length; }   // one delivery per batch (one batch per school)
  function carbon(f, opt) {
    var o = Object.assign({}, A, opt || {});
    var verified = opt && opt.verified != null ? opt.verified : verifiedKg(f);
    var issued = opt && opt.issued != null ? opt.issued : issuedKg(f);
    var water = issued / CONFIG.wetPerDried * CONFIG.waterPerDried;
    var kwh = water * o.dryingKwh[o.drying];
    var factor = o.baseline === "incineration" ? o.incineration : o.landfill;
    var rows = {
      avoided: verified * factor,
      drying: -kwh * o.grid,
      delivery: -(opt && opt.trips != null ? opt.trips : deliveryTrips(f)) * (+o.deliveryTripKm || 0) * (+o.deliveryKgPerKm || 0),
      ai: -(opt && opt.calls != null ? opt.calls : aiCalls(f)) * o.aiGramsPerCall / 1000,
      displaced: +o.displacedCredit || 0
    };
    rows.net = rows.avoided + rows.drying + rows.delivery + rows.ai + rows.displaced;
    rows.trips = opt && opt.trips != null ? opt.trips : deliveryTrips(f);
    rows.kwh = kwh; rows.water = water; rows.factor = factor; rows.verified = verified; rows.issued = issued;
    return rows;
  }
  function netCumByWeek(f) {
    var v = verifiedCumByWeek(f), iss = issuedCumByWeek(f), total = aiCalls(f), vt = verifiedKg(f) || 1;
    return WEEKS.map(function (_, w) {
      var trips = schoolsFor(f).filter(function (s) { return cohortStart(s) <= w; }).length;
      return carbon(f, { verified: v[w], issued: iss[w], calls: total * v[w] / vt, trips: trips }).net;
    });
  }
  /* ---------- routes and adoption ---------- */
  // Outlet -> school: kg collected at the outlet for that school's batch
  function routes(f) {
    return schoolsFor(f).map(function (s) {
      return { outlet: s.outlet, school: s.id, batch: s.batch, kg: s.students * wetKgPerStudent() * CONFIG.collectedPerIssued };
    });
  }
  // % of a class's students who started each week's project
  function adoptionGrid(f) {
    var rows = [];
    schoolsFor(f).forEach(function (s) {
      classesOf(s.id).forEach(function (c) {
        rows.push({ school: s.id, cls: c.name, students: c.students, pct: CONFIG.projectOrder.map(function (p) { return c.started[p] / c.students * 100; }) });
      });
    });
    return rows;
  }
  /* ---------- sponsor report ---------- */
  // Students who started / finished (photo sent) / got verified on each project
  function projectAdoption(f) {
    var list = schoolsFor(f);
    return CONFIG.projectOrder.map(function (p) {
      var c = function (field) { return sum(list.map(function (s) { return countBy(s.id, field, p); })); };
      return { project: p, name: CONFIG.projectNames[p], started: c("started"), finished: c("finished"), verified: c("verified") };
    });
  }
  // Quiz accuracy (% correct) by week of the journey, weighted by students
  function quizByWeek(f) {
    var list = schoolsFor(f), n = students(f) || 1;
    return [0, 1, 2, 3].map(function (w) { return sum(list.map(function (s) { return QUIZ[s.id][w] * s.students; })) / n; });
  }

  /* ---------- batches: one per school ---------- */
  function batches(f) {
    return schoolsFor(f).map(function (s) {
      var st = stages({ school: s.id }), by = {}; st.forEach(function (x) { by[x.key] = x; });
      var issued = by.issued.kg, verified = by.verified.kg;
      return {
        id: s.batch, school: s.id, outlet: s.outlet, cohort: s.cohort,
        steps: [
          { key: "collected", label: "Collected", date: s.dates.collected, kg: by.collected.kg, lost: 0 },
          { key: "dried", label: "Dried", date: s.dates.dried, kg: by.dried.kg, lost: by.dried.lost, lostLabel: "lost in drying" },
          { key: "delivered", label: "Delivered", date: s.dates.delivered, kg: by.delivered.kg, lost: by.delivered.lost, lostLabel: "lost in handling" },
          { key: "issued", label: "Issued", date: s.dates.issued, kg: issued, lost: 0 },
          { key: "verified", label: "Verified", date: s.dates.verified, kg: verified, lost: issued - verified, lostLabel: s.dates.verified ? "not verified" : "not verified yet", pending: !s.dates.verified }
        ]
      };
    });
  }
  function batch(id) { return batches().filter(function (b) { return b.id === id; })[0] || null; }

  /* ---------- per-school card ---------- */
  function schoolStats(sid) {
    var s = school(sid), P = CONFIG.projectOrder;
    var started = sum(P.map(function (p) { return countBy(sid, "started", p); }));
    var verified = sum(P.map(function (p) { return countBy(sid, "verified", p); }));
    return {
      id: sid, name: s.name, cohort: s.cohort, classes: s.classSizes.length, students: s.students,
      activePct: s.active,
      verifiedRate: started ? verified / started * 100 : 0, verifiedProjects: verified, startedProjects: started,
      startedPerStudent: started / s.students,
      aiPassRate: s.aiPass,
      waiting: s.waiting.length, oldestWait: s.waiting.length ? Math.max.apply(null, s.waiting) : 0,
      avgStreak: s.streak, lastDays: s.lastDays,
      verifiedKg: kgBy(sid, "verified"), issuedKg: s.students * wetKgPerStudent()
    };
  }

  /* ---------- teacher dashboard: one class (Maple Secondary, Sec 1A) ---------- */
  var TEACHER_CLASS = "s1c1";
  // Roster in engagement order (most engaged first). The last slot is the live demo student, filled in by the app.
  var ROSTER = ["Chloe", "Aiko", "Grace", "Li Wei", "Elif", "Priya", "Ines", "Ben", "Mei", "Farid", "Nur", "Jonas", "Omar",
    "Siti", "Kai", "Rahul", "Wei Ling", "Qing", "Zara", "Dev", "Tan Jun", "Hugo"];
  var CLASS_QUIZ = [62, 70, 66, 74, 78, 75, 82];   // % correct, last 7 days
  var STATUS = ["none", "started", "sent", "verified"];
  // Class missions, measured from the roster: kg = class verified kg, students = students with a verified project
  var CLASS_MISSIONS = [
    { id: "m1", name: "Reuse 5 kg of grounds together", goal: 5, unit: "kg" },
    { id: "m2", name: "Every student gets a project verified", goal: null, unit: "students" }   // goal = class size
  ];
  // Each student's furthest stage per project, consistent with the class counts above.
  function roster(cid) {
    var c = CLASSES.filter(function (x) { return x.id === cid; })[0];
    var names = ROSTER.slice(0, c.students - 1);
    return names.map(function (n, i) {
      var st = {};
      CONFIG.projectOrder.forEach(function (p) { st[p] = i < c.verified[p] ? "verified" : i < c.finished[p] ? "sent" : i < c.started[p] ? "started" : "none"; });
      return { name: n, status: st, streak: Math.max(0, Math.round(14 - i * 0.6 - (i % 3))), lastDays: i < 15 ? 0 : i < 19 ? 1 : 3 + (i % 3) };
    });
  }
  // Photos the AI could not verify (unsure, or still failing after the retakes), waiting for this teacher.
  function waitingPhotos(cid) {
    var sid = CLASSES.filter(function (x) { return x.id === cid; })[0].school, n = school(sid).waiting.length, out = [];
    roster(cid).forEach(function (r) {
      CONFIG.projectOrder.forEach(function (p) {
        if (out.length < n && r.status[p] === "sent") out.push({ id: "w-" + r.name + "-" + p, student: r.name, pid: p, project: CONFIG.projectNames[p], note: "AI unsure (confidence 0.42)" });
      });
    });
    return out;
  }

  /* ---------- public API (swap these bodies for DB queries later) ---------- */
  return {
    CONFIG: CONFIG, DEFAULTS: DEFAULTS,
    assumptions: function () { return A; }, setAssumption: setAssumption, resetAssumptions: resetAssumptions,
    weeks: function () { return WEEKS.slice(); },
    clients: function () { return CLIENTS.slice(); },
    outlets: function () { return OUTLETS.slice(); },
    outlet: outlet,
    schools: schoolsFor, school: school, classes: classesOf,
    quiz: function (sid) { return QUIZ[sid].slice(); },
    wetKgPerProject: wetKgPerProject, wetKgPerStudent: wetKgPerStudent,
    issuedKg: issuedKg, verifiedKg: verifiedKg, startedKg: startedKg, stages: stages,
    students: students, adopters: adopters, countBy: countBy, kgBy: kgBy,
    verifiedByWeek: verifiedByWeek, cohortStartWeek: function (sid) { return cohortStart(school(sid)); }, verifiedCumByWeek: verifiedCumByWeek, issuedCumByWeek: issuedCumByWeek,
    adoptersByWeek: adoptersByWeek, activeSchoolsByWeek: activeSchoolsByWeek, verifiedByMonth: verifiedByMonth,
    teacherClass: function () { var c = CLASSES.filter(function (x) { return x.id === TEACHER_CLASS; })[0]; return { id: c.id, name: c.name, school: c.school, students: c.students }; },
    roster: roster, waitingPhotos: waitingPhotos, classMissions: function () { return CLASS_MISSIONS.map(function (m) { return Object.assign({}, m); }); }, classQuiz: function () { return CLASS_QUIZ.slice(); }, STATUS: STATUS,
    routes: routes, adoptionGrid: adoptionGrid, schoolStats: schoolStats, batches: batches, batch: batch, projectAdoption: projectAdoption, quizByWeek: quizByWeek,
    aiCalls: aiCalls, deliveryTrips: deliveryTrips, carbon: carbon, netCumByWeek: netCumByWeek
  };
})();
