/* CoffeeBot dashboard views. Numbers come only from DASH (js/dashboard-data.js); charts from CH (js/charts.js). */
var CB = (function () {
  "use strict";
  var esc = CH.esc, num = CH.num;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var TODAY = "2026-11-07"; // demo "today"
  var last = null;           // last rendered view, so edits re-render in place without scrolling
  function view(fn) { return function (app) { last = { fn: fn, app: app }; fn(app); }; }
  function rerender() { if (last && /^#\/coffeebot/.test(location.hash)) { var y = window.scrollY; last.fn(last.app); window.scrollTo(0, y); } }

  // chart width = main width minus its padding (32) and the card's padding + border (38)
  function width(el) { return Math.max(280, Math.min(1040, (el.clientWidth || 900) - 72)); }
  function wkLabel(d) { return +d.slice(8, 10) + " " + MONTHS[+d.slice(5, 7) - 1]; }
  function kg(v, d) { return num(v, d == null ? 1 : d) + " kg"; }
  function signed(v, d) { return (v > 0 ? "+" : v < 0 ? "−" : "") + num(Math.abs(v), d == null ? 1 : d); }
  function demoTag() { return '<span class="demo-tag" title="All numbers on this page are simulated">demo data</span>'; }
  function head(title, sub) {
    return '<div class="dash-head"><div><h1 class="dash-title">' + esc(title) + "</h1>" + (sub ? '<p class="muted">' + sub + "</p>" : "") + "</div>" + demoTag() + "</div>";
  }
  function input(key, label, opts) {
    opts = opts || {};
    var v = DASH.assumptions()[key];
    return '<label class="assume"><span>' + label + '</span><input type="number" inputmode="decimal" step="' + (opts.step || "any") + '" min="0" data-assume="' + key + '" value="' + (v == null ? "" : v) + '" placeholder="' + (opts.placeholder || "") + '">' +
      (opts.note ? '<em class="note">' + opts.note + "</em>" : "") + "</label>";
  }

  /* ---------- overview ---------- */
  function kpi(label, value, sub, series, color) {
    return '<div class="card kpi"><div class="kpi-label">' + label + '</div><div class="kpi-val">' + value + "</div>" +
      CH.spark(series, color) + '<div class="kpi-sub">' + sub + "</div></div>";
  }
  function overview(app) {
    var A = DASH.assumptions(), W = width(app), weeks = DASH.weeks();
    var ver = DASH.verifiedKg(), iss = DASH.issuedKg(), stu = DASH.students(), ad = DASH.adopters();
    var c = DASH.carbon(), schools = DASH.schools();
    var activeNow = schools.filter(function (s) { return s.lastDays <= 7; }).length;
    var adoptSeries = DASH.adoptersByWeek().map(function (x) { return x / stu * 100; });
    var kpis = '<div class="kpis">' +
      kpi("Verified grounds", kg(ver), "of " + kg(iss) + " issued (wet-equivalent)", DASH.verifiedCumByWeek(), CH.SERIES[0]) +
      kpi("Adoption rate", num(ad / stu * 100) + "%", num(ad) + " of " + num(stu) + " students started a project", adoptSeries, CH.SERIES[1]) +
      kpi("Active schools", activeNow + " of " + schools.length, "activity in the last 7 days", DASH.activeSchoolsByWeek(), CH.SERIES[2]) +
      kpi("Net CO₂e", signed(c.net) + " kg", A.baseline + " baseline · " + (A.drying === "solar" ? "sun" : A.drying) + " drying", DASH.netCumByWeek(), CH.SERIES[0]) +
      "</div>";

    var months = DASH.verifiedByMonth().map(function (m) {
      var label = MONTHS[+m.month.slice(5, 7) - 1] + (m.month === TODAY.slice(0, 7) ? " (to date)" : "");
      return { label: label, kg: m.kg, share: A.totalGroundsPerMonth > 0 ? m.kg / A.totalGroundsPerMonth * 100 : 0 };
    });
    var reuse = '<section class="card"><div class="row between"><h2>Reuse rate by month</h2></div>' +
      '<p class="muted">Bean Again\'s share = verified kg ÷ total grounds that month, stacked on top of what CoffeeBot already reuses.</p>' +
      '<div class="assumes">' + input("totalGroundsPerMonth", "Total grounds per month (kg wet)", { step: 50, note: "placeholder, confirm with CoffeeBot" }) + "</div>" +
      CH.reuse({ width: W, months: months, low: A.existingReuseLow, high: A.existingReuseHigh }) + "</section>";

    var series = schools.map(function (s) {
      var st = DASH.cohortStartWeek(s.id);
      return { name: s.name, values: DASH.verifiedByWeek(s.id).map(function (v, w) { return w < st ? null : v; }) };
    });
    var line = '<section class="card"><h2>Verified kg by week</h2><p class="muted">Wet-equivalent kg verified each week, one line per school. Cohort 2026 B started on 12 Oct.</p>' +
      CH.lines({ width: W, label: "Verified kg by week per school", labels: weeks.map(wkLabel), xName: "Week of", series: series, fmt: function (v) { return v == null ? "not started yet" : kg(v); }, tipTitle: function (i) { return "Week of " + wkLabel(weeks[i]); } }) + "</section>";

    app.innerHTML = head("CoffeeBot overview", "Where the grounds go, and whether reuse is rising.") + kpis + '<div class="stack" style="margin-top:16px">' + reuse + line + "</div>";
  }

  /* ---------- grounds journey ---------- */
  var HEAT = ["#F6E7C9", "#E8C3A2", "#D0937E", "#AD5D5E", "#7A2630"];   // one hue, light -> dark (0-20-40-60-80-100%)
  function heatCell(p) {
    var i = Math.min(4, Math.floor(p / 20)), c = HEAT[i];
    return '<td class="hm" style="background:' + c + ";color:" + (i >= 3 ? "#FFF7DA" : "#3a1010") + '">' + num(p) + "%</td>";
  }
  function journey(app) {
    var W = width(app), st = DASH.stages().filter(function (x) { return x.key !== "verified"; }), schools = DASH.schools();
    var flow = '<section class="card"><h2>Where the grounds go</h2>' +
      '<p class="muted">Every kg is wet-equivalent (dried kg × 2.5). Collected = issued × 1.1, 5% of collected is lost in drying, the rest of the gap in handling. Started = grounds in projects students have begun, using ' +
      DASH.CONFIG.projectOrder.map(function (p) { return DASH.CONFIG.gramsDried[p] + " g"; }).join(" / ") + " dried grounds per project.</p>" +
      CH.flow({ width: W, stages: st, label: "Flow of grounds from collection to verified reuse", fmt: function (v) { return kg(v); } }) +
      '<p class="callout">' + num(st[st.length - 1].kg / st[0].kg * 100) + "% of collected grounds reach a student project. The biggest drop is <b>" +
      st.slice(1).sort(function (a, b) { return b.lost - a.lost; })[0].lostLabel + "</b>.</p></section>";

    var outlets = DASH.outlets(), links = DASH.routes();
    var routes = '<section class="card"><h2>Outlet to school</h2><p class="muted">kg collected at each CoffeeBot outlet for each school\'s batch.</p>' +
      CH.bipartite({ width: W, label: "Grounds from outlets to schools", fmt: function (v) { return kg(v); },
        left: outlets.map(function (o) { return { id: o.id, name: o.name }; }),
        right: schools.map(function (s, i) { return { id: s.id, name: s.name, color: CH.SERIES[i] }; }),
        links: links.map(function (l) {
          var i = schools.map(function (s) { return s.id; }).indexOf(l.school);
          return { from: l.outlet, to: l.school, kg: l.kg, color: CH.SERIES[i], tip: DASH.outlet(l.outlet).name + " → " + DASH.school(l.school).name + "\n" + kg(l.kg) + " · batch " + l.batch };
        }) }) + "</section>";

    var grid = DASH.adoptionGrid(), order = DASH.CONFIG.projectOrder, lastSchool = null;
    var heat = '<section class="card"><h2>Adoption by class and week</h2><p class="muted">Share of each class\'s students who started that week\'s project.</p>' +
      '<div class="scroll"><table class="tbl heat"><thead><tr><th>School</th><th>Class</th>' + order.map(function (p, i) { return "<th>Week " + (i + 1) + "<br><span class=\"muted\">" + esc(DASH.CONFIG.projectNames[p]) + "</span></th>"; }).join("") + "</tr></thead><tbody>" +
      grid.map(function (r) {
        var name = r.school === lastSchool ? "" : DASH.school(r.school).name; lastSchool = r.school;
        return '<tr' + (name ? ' class="grp"' : "") + "><td><b>" + esc(name) + "</b></td><td>" + esc(r.cls) + ' <span class="muted">(' + r.students + ")</span></td>" + r.pct.map(heatCell).join("") + "</tr>";
      }).join("") + "</tbody></table></div>" +
      '<div class="legend heat-key">' + HEAT.map(function (c, i) { return '<span><i class="sw" style="background:' + c + '"></i>' + (i * 20) + "–" + (i * 20 + 20) + "%</span>"; }).join("") + "</div></section>";

    app.innerHTML = head("Grounds journey", "From the CoffeeBot machine to a student project, and what gets lost on the way.") + '<div class="stack">' + flow + routes + heat + "</div>";
  }

  /* ---------- schools ---------- */
  function ring(pct, color, label) {
    var r = 36, c = 2 * Math.PI * r, d = Math.max(0, Math.min(100, pct)) / 100 * c;
    return '<svg class="ring" viewBox="0 0 96 96" width="96" height="96" role="img" aria-label="' + esc(label + ": " + num(pct) + "%") + '"' + CH.tip(label + "\n" + num(pct) + "%") + ">" +
      '<circle cx="48" cy="48" r="' + r + '" fill="none" stroke="' + CH.GRID + '" stroke-width="10"/>' +
      '<circle cx="48" cy="48" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + d + " " + c + '" transform="rotate(-90 48 48)"/>' +
      '<text x="48" y="54" text-anchor="middle" class="ring-val">' + num(pct) + "%</text></svg>";
  }
  function hbar(pct, color, tipText) {
    return '<svg class="hbar" viewBox="0 0 200 14" preserveAspectRatio="none" width="100%" height="14"' + CH.tip(tipText) + ">" +
      '<rect x="0" y="0" width="200" height="14" rx="4" fill="' + CH.GRID + '"/><path d="' + CH.barPath(0, 0, Math.max(0, Math.min(100, pct)) * 2, 14) + '" fill="' + color + '"/></svg>';
  }
  function ago(d) { return d === 0 ? "today" : d === 1 ? "yesterday" : d + " days ago"; }
  function schools(app) {
    var list = DASH.schools();
    var cards = list.map(function (sc, i) {
      var t = DASH.schoolStats(sc.id), color = CH.SERIES[i];
      return '<section class="card school-card">' +
        '<h2>' + esc(t.name) + '</h2><p class="muted">Cohort ' + esc(t.cohort) + " · " + t.classes + " classes · " + t.students + " students</p>" +
        '<div class="sc-top"><figure class="ring-fig">' + ring(t.activePct, color, "Active students") + "<figcaption>active students</figcaption></figure>" +
          '<div class="sc-main"><div class="sc-k">Verified rate</div><div class="sc-big">' + num(t.verifiedRate) + "%</div>" +
          hbar(t.verifiedRate, color, "Verified rate\n" + t.verifiedProjects + " of " + t.startedProjects + " started projects verified") +
          '<div class="muted">' + t.verifiedProjects + " of " + t.startedProjects + " started projects</div></div></div>" +
        '<dl class="sc-stats">' +
          "<div><dt>Projects started per student</dt><dd>" + num(t.startedPerStudent, 1) + ' <span class="muted">of 4</span></dd></div>' +
          "<div><dt>AI pass rate</dt><dd>" + num(t.aiPassRate) + "%</dd></div>" +
          "<div><dt>Photos waiting for teacher</dt><dd>" + t.waiting + (t.waiting ? ' <span class="muted">oldest ' + t.oldestWait + " " + (t.oldestWait === 1 ? "day" : "days") + "</span>" : "") + "</dd></div>" +
          "<div><dt>Average quiz streak</dt><dd>" + num(t.avgStreak, 1) + ' <span class="muted">days</span></dd></div>' +
          "<div><dt>Last activity</dt><dd>" + ago(t.lastDays) + "</dd></div>" +
        "</dl></section>";
    }).join("");
    app.innerHTML = head("Schools", "How each school is doing with its projects, photo checks and daily quiz.") +
      '<div class="school-grid">' + cards + "</div>";
  }

  /* ---------- batches ---------- */
  function timeline(b, color) {
    var html = '<ol class="btl">';
    b.steps.forEach(function (st, i) {
      if (i > 0) {
        html += '<li class="btl-gap" aria-hidden="' + (st.lost > 0.05 ? "false" : "true") + '">' +
          (st.lost > 0.05 ? '<span class="btl-loss"' + CH.tip(st.label + "\n" + kg(st.lost) + " " + st.lostLabel) + ">−" + kg(st.lost) + "<small>" + esc(st.lostLabel) + "</small></span>" : "") + "</li>";
      }
      html += '<li class="btl-step' + (st.pending ? " pending" : "") + '"><span class="btl-dot" style="' + (st.pending ? "border-color:" + color : "background:" + color + ";border-color:" + color) + '"></span>' +
        '<b class="btl-label">' + esc(st.label) + '</b><span class="btl-date">' + (st.date ? wkLabel(st.date) : "in progress") + "</span>" +
        '<span class="btl-kg">' + kg(st.kg) + (st.pending ? ' <small class="muted">so far</small>' : "") + "</span></li>";
    });
    return html + "</ol>";
  }
  function batchHead(b, linked) {
    var sc = DASH.school(b.school), done = !b.steps[b.steps.length - 1].pending;
    return '<div class="row between"><div><h2 class="batch-id">' + (linked ? '<a href="#/batch/' + encodeURIComponent(b.id) + '">' + esc(b.id) + "</a>" : esc(b.id)) + "</h2>" +
      '<p class="muted">' + esc(DASH.outlet(b.outlet).name) + " → " + esc(sc.name) + " · cohort " + esc(b.cohort) + "</p></div>" +
      '<span class="chip ' + (done ? "ok" : "") + '">' + (done ? "✓ complete" : "◔ in progress") + "</span></div>";
  }
  function batchSummary(b) {
    var c = b.steps[0].kg, v = b.steps[b.steps.length - 1].kg;
    return '<p class="callout">' + num(v / c * 100) + "% of the " + kg(c) + " collected has been verified" + (b.steps[b.steps.length - 1].pending ? " so far" : "") + ".</p>";
  }
  function batches(app) {
    var list = DASH.batches(), ids = DASH.schools().map(function (s) { return s.id; });
    app.innerHTML = head("Batches", "Each batch from CoffeeBot machine to verified projects. Open a batch ID for its own page.") +
      '<div class="stack">' + list.map(function (b) {
        return '<section class="card">' + batchHead(b, true) + timeline(b, CH.SERIES[ids.indexOf(b.school)]) + batchSummary(b) + "</section>";
      }).join("") + "</div>";
  }
  function batchPage(app, id) {
    var b = DASH.batch(id);
    if (!b) { app.innerHTML = head("Batch not found") + '<section class="card"><p>No batch called ' + esc(id) + '.</p><a class="btn" href="#/coffeebot/batches">All batches</a></section>'; return; }
    var color = CH.SERIES[DASH.schools().map(function (s) { return s.id; }).indexOf(b.school)];
    app.innerHTML = '<p class="no-print"><a href="#/coffeebot/batches">← All batches</a></p>' + head("Batch " + b.id, "Every kg is wet-equivalent (dried kg × 2.5).") +
      '<section class="card">' + batchHead(b, false) + timeline(b, color) + batchSummary(b) +
      CH.table(["Step", "Date", "kg", "Lost at this step"], b.steps.map(function (st) { return [st.label, st.date || "in progress", kg(st.kg), st.lost > 0.05 ? kg(st.lost) + " " + st.lostLabel : "–"]; }), "Show as table") +
      "</section>";
  }

  /* ---------- carbon ---------- */
  function select(key, label, options, note) {
    var v = DASH.assumptions()[key];
    return '<label class="assume"><span>' + label + '</span><select data-assume="' + key + '">' +
      options.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>" +
      (note ? '<em class="note">' + note + "</em>" : "") + "</label>";
  }
  function co2(v, d) { return v == null ? "TBC" : signed(v, d == null ? 1 : d) + " kg"; }
  function carbon(app) {
    var A = DASH.assumptions(), W = width(app), c = DASH.carbon(), K = A.dryingKwh, calls = DASH.aiCalls();
    var factorName = A.baseline === "incineration" ? "incineration" : "landfill";

    var wf = '<section class="card"><h2>Net carbon, step by step</h2>' +
      '<p class="muted">kg CO₂e for all schools to date: ' + A.baseline + " baseline, " + (A.drying === "solar" ? "sun-dried (no electricity)" : A.drying + " electric drying") + ".</p>" +
      CH.waterfall({ width: W, label: "Carbon waterfall", fmt: function (v) { return v === 0 ? "0 kg" : co2(v, Math.abs(v) < 1 ? 2 : 1); },
        items: [
          { label: "Avoided disposal", v: c.avoided, tip: "Avoided disposal\n" + kg(c.verified) + " verified × " + c.factor + " (" + factorName + ")" },
          { label: "Drying", v: c.drying, tip: "Drying\n" + num(c.kwh, 1) + " kWh × " + A.grid + " kg/kWh" },
          { label: "Delivery", v: c.delivery, tip: "Delivery\n" + c.trips + " trips × " + A.deliveryTripKm + " km × " + A.deliveryKgPerKm + " kg/km" },
          { label: "AI calls", v: c.ai, tip: "AI calls\n" + num(calls) + " checks × " + A.aiGramsPerCall + " g" },
          { label: "Displaced products", v: c.displaced, tip: "Displaced products\nnot claimed until sourced" },
          { label: "NET", v: c.net, total: true, tip: "Net\n" + co2(c.net) }
        ] }) + "</section>";

    var panel = '<section class="card"><div class="row between"><h2>Assumptions</h2><button class="btn btn-ghost small" data-cb="reset">Reset to defaults</button></div>' +
      '<p class="muted">Change any value and every chart on this page updates.</p><div class="assumes">' +
      select("baseline", "Baseline route", [["landfill", "Landfill"], ["incineration", "Incineration"]]) +
      input("landfill", "Landfill (kg CO₂e per kg wet)", { step: 0.001 }) +
      input("incineration", "Incineration (kg CO₂e per kg wet)", { step: 0.0001 }) +
      input("grid", "Grid (kg CO₂ per kWh)", { step: 0.001 }) +
      select("drying", "Drying method", [["theoretical", "Theoretical (" + K.theoretical + " kWh/kg water)"], ["practical", "Practical (" + K.practical + " kWh/kg water)"], ["solar", "Sun-dried on the roof (0 kWh)"]]) +
      input("aiGramsPerCall", "AI check (g CO₂e per call)", { step: 0.01 }) +
      input("deliveryTripKm", "Delivery round trip (km)", { step: 1, note: "assumed, one trip per batch" }) +
      input("deliveryKgPerKm", "Vehicle (kg CO₂e per km)", { step: 0.01, note: "average car, UK gov. factors" }) +
      input("displacedCredit", "Displaced-product credit (kg CO₂e)", { step: 0.1, note: "not claimed until sourced" }) +
      "</div></section>";

    var water = c.water, eq = '<section class="card"><h2>What counts, and the sum</h2>' +
      '<p class="boundary"><b>Boundary rule.</b> Avoided disposal counts <b>verified</b> kg only (' + kg(c.verified) + "). Drying counts <b>all issued</b> kg (" + kg(c.issued) + "), because grounds that are never used still cost drying energy.</p>" +
      '<pre class="eq">Net = verified kg × ' + factorName + ' factor\n    − (issued kg ÷ 2.5 × 1.5) × kWh per kg water × grid\n    − trips × km × kg per km − AI calls × g per call ÷ 1000\n    + displaced credit\n\n' +
      "    = " + num(c.verified, 1) + " × " + c.factor + "\n    − (" + num(c.issued, 1) + " ÷ 2.5 × 1.5 = " + num(water, 1) + " kg water) × " + K[A.drying] + " × " + A.grid + "\n    − " + c.trips + " × " + A.deliveryTripKm + " × " + A.deliveryKgPerKm + " − " + num(calls) + " × " + A.aiGramsPerCall + " ÷ 1000\n    + " + num(c.displaced, 1) +
      "\n\n    = " + co2(c.net) + " CO₂e</pre></section>";

    app.innerHTML = head("Carbon", "Is the carbon claim honest? Every number here is shown with the assumption behind it.") + '<div class="stack">' + wf + panel + eq + "</div>";
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest('[data-cb="reset"]');
    if (el) { DASH.resetAssumptions(); rerender(); }
  });

  /* ---------- sponsor report ---------- */
  var reportClient = "DBS";
  var FUNNEL = ["#E2B6A6", "#C27D72", "#8E2B2B"]; // one hue, light -> dark: started, photo sent, verified
  function longDate(d) { return +d.slice(8, 10) + " " + MONTHS[+d.slice(5, 7) - 1] + " " + d.slice(0, 4); }
  function report(app) {
    var A = DASH.assumptions(), W = Math.min(width(app), 900), f = { client: reportClient };
    var schools = DASH.schools(f), outlets = DASH.outlets().filter(function (o) { return o.client === reportClient; });
    var stu = DASH.students(f), ad = DASH.adopters(f), ver = DASH.verifiedKg(f), iss = DASH.issuedKg(f), c = DASH.carbon(f);
    var allIds = DASH.schools().map(function (s) { return s.id; });
    var cohorts = schools.map(function (s) { return s.cohort; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
    var dryName = A.drying === "solar" ? "sun-dried on a rooftop (no electricity)" : A.drying + " electric drying (" + A.dryingKwh[A.drying] + " kWh per kg water)";

    var controls = '<div class="row between no-print report-bar"><div class="tabs" role="tablist" style="margin:0">' +
      DASH.clients().map(function (cl) { return '<button role="tab" class="' + (cl.id === reportClient ? "on" : "") + '" data-cb="client" data-v="' + cl.id + '">' + esc(cl.name) + "</button>"; }).join("") +
      '</div><button class="btn" data-act="print">Print / save as PDF</button></div>';

    var stats = '<div class="rep-stats">' +
      '<div><div class="sc-k">Grounds verified as reused</div><div class="sc-big">' + kg(ver) + '</div><div class="muted">of ' + kg(iss) + " issued to schools</div></div>" +
      '<div><div class="sc-k">Students</div><div class="sc-big">' + num(stu) + '</div><div class="muted">in ' + schools.length + " " + (schools.length === 1 ? "school" : "schools") + "</div></div>" +
      '<div><div class="sc-k">Started a project</div><div class="sc-big">' + num(ad / stu * 100) + '%</div><div class="muted">' + num(ad) + " of " + num(stu) + " students</div></div>" +
      '<div><div class="sc-k">Net CO₂e avoided</div><div class="sc-big">' + signed(c.net) + ' kg</div><div class="muted">assumptions below</div></div></div>';

    var flowSec = '<section class="rep-sec"><h3>Where your grounds went</h3><p class="muted">kg collected at your CoffeeBot outlets for each school.</p>' +
      CH.bipartite({ width: W, label: "Grounds from your outlets to schools", fmt: function (v) { return kg(v); },
        left: outlets.map(function (o) { return { id: o.id, name: o.name }; }),
        right: schools.map(function (s) { return { id: s.id, name: s.name, color: CH.SERIES[allIds.indexOf(s.id)] }; }),
        links: DASH.routes(f).map(function (l) { return { from: l.outlet, to: l.school, kg: l.kg, color: CH.SERIES[allIds.indexOf(l.school)], tip: DASH.outlet(l.outlet).name + " → " + DASH.school(l.school).name + "\n" + kg(l.kg) + " · batch " + l.batch }; }) }) + "</section>";

    var pa = DASH.projectAdoption(f);
    var adoptSec = '<section class="rep-sec"><h3>Adoption by project</h3><p class="muted">Share of the ' + num(stu) + " students who started each project, sent their final photo, and had it verified.</p>" +
      CH.groupedBars({ width: W, label: "Adoption by project", total: stu, series: ["Started", "Photo sent", "Verified"], colors: FUNNEL,
        groups: pa.map(function (p, i) { return { label: p.name, sub: "Week " + (i + 1), values: [p.started, p.finished, p.verified] }; }) }) + "</section>";

    var q = DASH.quizByWeek(f);
    var quizSec = '<section class="rep-sec"><h3>What students learned</h3><p class="muted">Average daily quiz accuracy, week 1 to week 4: ' + num(q[0]) + "% → " + num(q[3]) + "%.</p>" +
      CH.lines({ width: W, height: 240, label: "Quiz accuracy by week", labels: ["Week 1", "Week 2", "Week 3", "Week 4"], xName: "Week",
        series: [{ name: "% correct", values: q, color: CH.SERIES[1] }], fmt: function (v) { return num(v) + "%"; } }) + "</section>";

    var co2Sec = '<section class="rep-sec"><h3>Carbon</h3>' +
      '<table class="tbl rep-co2"><tbody>' +
      "<tr><td>Avoided disposal: " + kg(ver) + " verified × " + c.factor + " kg CO₂e/kg (" + A.baseline + ")</td><td>" + signed(c.avoided, 1) + " kg</td></tr>" +
      "<tr><td>Drying: " + (A.drying === "solar" ? "sun-dried, no electricity" : num(c.kwh, 1) + " kWh × " + A.grid + " kg CO₂/kWh") + "</td><td>" + signed(c.drying, 1) + " kg</td></tr>" +
      "<tr><td>Delivery: " + c.trips + " " + (c.trips === 1 ? "trip" : "trips") + " × " + A.deliveryTripKm + " km × " + A.deliveryKgPerKm + " kg CO₂e/km</td><td>" + signed(c.delivery, 1) + " kg</td></tr>" +
      "<tr><td>Photo checks: " + num(DASH.aiCalls(f)) + " AI calls × " + A.aiGramsPerCall + " g</td><td>" + signed(c.ai, 2) + " kg</td></tr>" +
      "<tr><td>Products replaced by student-made ones</td><td>not claimed</td></tr>" +
      '<tr class="tot"><td>Net CO₂e avoided</td><td>' + signed(c.net, 1) + " kg</td></tr></tbody></table>" +
      '<h4>Assumptions</h4><ul class="rep-list">' +
      "<li>Baseline: without Bean Again these grounds would go to " + A.baseline + " (" + c.factor + " kg CO₂e per kg wet grounds).</li>" +
      "<li>Drying: " + dryName + ".</li>" +
      "<li>Only <b>verified</b> grounds count as avoided disposal. Drying counts all " + kg(iss) + " issued, used or not.</li>" +
      "<li>Delivery: one car trip per school batch, about " + A.deliveryTripKm + " km there and back, at " + A.deliveryKgPerKm + " kg CO₂e per km. No credit is taken for products the students' items replace.</li>" +
      "<li>All kg are wet-equivalent (dried kg × 2.5). Each student's kit holds " + DASH.CONFIG.projectOrder.map(function (p) { return DASH.CONFIG.gramsDried[p]; }).reduce(function (a, b) { return a + b; }, 0) + " g of dried grounds across four projects.</li>" +
      "<li>A project is verified when its final photo passes the AI check, or a teacher approves it.</li></ul></section>";

    app.innerHTML = '<div class="report-page">' + controls + head("Bean Again impact report: " + reportClient,
        "Grounds from " + outlets.map(function (o) { return o.name; }).join(" and ") + " · cohort " + cohorts.join(", ") + " · generated " + longDate(new Date().toISOString().slice(0, 10))) +
      '<section class="card report">' + stats + flowSec + adoptSec + quizSec + co2Sec + "</section></div>";
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest('[data-cb="client"]');
    if (el) { reportClient = el.dataset.v; rerender(); }
  });

  /* assumptions inputs: save and re-render the current page */
  document.addEventListener("change", function (e) {
    var el = e.target.closest && e.target.closest("[data-assume]");
    if (!el) return;
    var v = el.type === "number" ? (el.value === "" ? null : +el.value) : el.value;   // selects pass strings
    DASH.setAssumption(el.dataset.assume, v);
    rerender();
  });
  CH.bindTips();
  var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(rerender, 200); });

  return {
    overview: view(overview),
    journey: view(journey), schools: view(schools), batches: view(batches), batchPage: batchPage,
    carbon: view(carbon), report: view(report)
  };
})();
