/* Small SVG chart helpers for the dashboards (no libraries). Each returns an HTML string.
 * Marks: 2px lines, >=8px end dots with a surface ring, <=24px bars with 4px rounded data-ends,
 * hairline solid gridlines. Text uses ink tokens, never the series colour.
 * Hover: any element with data-tip shows a tooltip (see bindTips).
 */
var CH = (function () {
  "use strict";
  var INK = "#3a1010", MUTED = "#7a5a50", GRID = "#e8dcb8", SURF = "#FFF7DA", LOSS = "#b9ad9a";
  // Validated categorical order (dataviz validator, surface #FFF7DA): maroon, olive, mauve, amber
  var SERIES = ["#9B3030", "#8C8420", "#B8577A", "#BC7A10"];

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(v, d) { return v == null || isNaN(v) ? "–" : (+v).toLocaleString(undefined, { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  // clean axis: step is 1/2/5 x 10^n, max is a whole number of steps
  function scale(v, n) { n = n || 4; if (v <= 0) return { max: 1, step: 0.25, n: 4 }; var raw = v / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    var step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; var k = Math.ceil(v / step); return { max: k * step, step: step, n: k }; }
  function niceMax(v) { if (v <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  function tip(t) { return ' data-tip="' + esc(t) + '" tabindex="0"'; }
  // bar/column with a 4px rounded data-end, square at the baseline (vertical: top rounded)
  function colPath(x, y, w, h) {
    if (h <= 0) return "";
    var r = Math.min(4, h, w / 2);
    return "M" + x + "," + (y + h) + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y + "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + h) + "Z";
  }
  function barPath(x, y, w, h) { // horizontal bar, right end rounded
    if (w <= 0) return "";
    var r = Math.min(4, w, h / 2);
    return "M" + x + "," + y + "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + h - r) + "Q" + (x + w) + "," + (y + h) + " " + (x + w - r) + "," + (y + h) + "H" + x + "Z";
  }
  function legend(items) {
    return '<div class="legend">' + items.map(function (it) {
      return '<span><i class="sw' + (it.hatch ? " hatch" : "") + '" style="background:' + it.color + '"></i>' + esc(it.name) + "</span>";
    }).join("") + "</div>";
  }
  function table(head, rows, label) {
    return '<details class="tview"><summary>' + esc(label || "Show as table") + '</summary><div class="scroll"><table class="tbl"><thead><tr>' +
      head.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div></details>";
  }

  /* sparkline: one series, end dot, no axes */
  function spark(values, color) {
    var w = 120, h = 34, pad = 5, v = values.map(function (x) { return x == null ? null : x; }).filter(function (x) { return x != null; });
    if (v.length < 2) return "";
    var mn = Math.min.apply(null, v), mx = Math.max.apply(null, v); if (mx === mn) { mx += 1; mn -= 1; }
    var pts = [], i0 = values.length - v.length;
    v.forEach(function (y, i) { pts.push([pad + (i + i0) / (values.length - 1) * (w - 2 * pad), h - pad - (y - mn) / (mx - mn) * (h - 2 * pad)]); });
    var last = pts[pts.length - 1], zero = mn < 0 && mx > 0 ? h - pad - (0 - mn) / (mx - mn) * (h - 2 * pad) : null;
    return '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">' +
      (zero != null ? '<line x1="0" x2="' + w + '" y1="' + zero + '" y2="' + zero + '" stroke="' + GRID + '" stroke-width="1"/>' : "") +
      '<polyline fill="none" stroke="' + (color || SERIES[0]) + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="' + pts.map(function (p) { return p.join(","); }).join(" ") + '"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4" fill="' + (color || SERIES[0]) + '" stroke="' + SURF + '" stroke-width="2"/></svg>';
  }

  /* multi-series line chart with hover columns, end labels (<=4 series), legend and table */
  function lines(o) {
    var W = o.width, H = o.height || 280, L = 48, R = o.series.length <= 4 ? 150 : 16, T = 14, B = 34;
    if (W < 520) R = 16;
    var all = []; o.series.forEach(function (s) { all = all.concat(s.values.filter(function (v) { return v != null; })); });
    var sc = scale(Math.max.apply(null, all) * 1.05), ymax = sc.max, n = o.labels.length;
    var x = function (i) { return L + (n === 1 ? 0 : i / (n - 1) * (W - L - R)); }, y = function (v) { return T + (1 - v / ymax) * (H - T - B); };
    var g = "", ticks = sc.n;
    for (var k = 0; k <= ticks; k++) {
      var tv = sc.step * k;
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(tv) + '" y2="' + y(tv) + '" stroke="' + GRID + '" stroke-width="1"/>' +
        '<text x="' + (L - 8) + '" y="' + (y(tv) + 4) + '" text-anchor="end" class="ax">' + num(tv, sc.step < 1 ? 1 : 0) + "</text>";
    }
    o.labels.forEach(function (lb, i) { g += '<text x="' + x(i) + '" y="' + (H - 10) + '" text-anchor="middle" class="ax">' + esc(lb) + "</text>"; });
    var ends = [];
    o.series.forEach(function (s, si) {
      var c = s.color || SERIES[si];
      var pts = []; s.values.forEach(function (v, i) { if (v != null) pts.push(x(i) + "," + y(v)); });   // null = no data yet (not drawn)
      g += '<polyline fill="none" stroke="' + c + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="' + pts.join(" ") + '"/>';
      var li = s.values.length - 1; while (li > 0 && s.values[li] == null) li--;
      g += '<circle cx="' + x(li) + '" cy="' + y(s.values[li]) + '" r="4" fill="' + c + '" stroke="' + SURF + '" stroke-width="2"/>';
      ends.push({ y: y(s.values[li]), name: s.name, v: s.values[li] });
    });
    if (R > 100) { // direct end labels, nudged apart so they never collide
      ends.sort(function (a, b) { return a.y - b.y; });
      for (var e = 1; e < ends.length; e++) if (ends[e].y - ends[e - 1].y < 16) ends[e].y = ends[e - 1].y + 16;
      var floor = H - B - 6;   // keep the stack inside the plot: push up from the bottom if it overflows
      if (ends.length && ends[ends.length - 1].y > floor) { ends[ends.length - 1].y = floor; for (e = ends.length - 2; e >= 0; e--) if (ends[e + 1].y - ends[e].y < 16) ends[e].y = ends[e + 1].y - 16; }
      ends.forEach(function (en) { g += '<text x="' + (W - R + 10) + '" y="' + (en.y + 4) + '" class="lbl">' + esc(en.name) + "</text>"; });
    }
    // hover columns (crosshair + tooltip with every series at that x)
    o.labels.forEach(function (lb, i) {
      var cw = (W - L - R) / Math.max(1, n - 1), x0 = Math.max(L, x(i) - cw / 2), x1 = Math.min(W - R, x(i) + cw / 2);
      var t = (o.tipTitle ? o.tipTitle(i) : lb) + "\n" + o.series.map(function (s) { return s.name + ": " + o.fmt(s.values[i]); }).join("\n");
      g += '<g class="hov"><rect x="' + x0 + '" y="' + T + '" width="' + (x1 - x0) + '" height="' + (H - T - B) + '" fill="transparent"' + tip(t) + '/>' +
        '<line x1="' + x(i) + '" x2="' + x(i) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="' + MUTED + '" stroke-width="1" pointer-events="none"/></g>';
    });
    return (o.series.length > 1 ? legend(o.series.map(function (s, i) { return { name: s.name, color: s.color || SERIES[i] }; })) : "") +
      '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(o.label) + '">' + g + "</svg>" +
      table([o.xName || ""].concat(o.series.map(function (s) { return s.name; })), o.labels.map(function (lb, i) { return [lb].concat(o.series.map(function (s) { return o.fmt(s.values[i]); })); }));
  }

  /* stacked reuse-rate columns: existing solid (0..low), existing range band (low..high), Bean Again on top */
  function reuse(o) {
    var W = o.width, H = 260, L = 48, R = 16, T = 26, B = 34, n = o.months.length;
    var top = Math.max.apply(null, o.months.map(function (m) { return o.high + m.share; }));
    var sc = scale(top * 1.05), ymax = sc.max, y = function (v) { return T + (1 - v / ymax) * (H - T - B); };
    var slot = (W - L - R) / n, bw = Math.min(24 * 2, slot * 0.5), g = "";
    g += '<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#efe3bd"/><line x1="0" y1="0" x2="0" y2="6" stroke="' + LOSS + '" stroke-width="2"/></pattern></defs>';
    for (var k = 0; k <= sc.n; k++) {
      var tv = sc.step * k;
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(tv) + '" y2="' + y(tv) + '" stroke="' + GRID + '" stroke-width="1"/><text x="' + (L - 8) + '" y="' + (y(tv) + 4) + '" text-anchor="end" class="ax">' + num(tv, 0) + "%</text>";
    }
    o.months.forEach(function (m, i) {
      var x = L + slot * i + (slot - bw) / 2, gap = 2;
      var y0 = y(0), yl = y(o.low), yh = y(o.high), yb = y(o.high + m.share);
      g += '<rect x="' + x + '" y="' + yl + '" width="' + bw + '" height="' + (y0 - yl) + '" fill="#d9c9a0"' + tip(m.label + "\nCoffeeBot existing reuse: at least " + o.low + "%") + "/>";
      g += '<rect x="' + x + '" y="' + yh + '" width="' + bw + '" height="' + Math.max(0, yl - yh - gap) + '" fill="url(#hatch)"' + tip(m.label + "\nCoffeeBot existing reuse: " + o.low + "–" + o.high + "% (range)") + "/>";
      var ph = Math.max(0, yh - yb - gap);
      g += '<path d="' + colPath(x, yb, bw, ph) + '" fill="' + SERIES[0] + '"' + tip(m.label + "\nBean Again verified: " + num(m.kg, 1) + " kg\n= +" + num(m.share, 2) + " percentage points") + "/>";
      g += '<text x="' + (x + bw / 2) + '" y="' + (yb - 8) + '" text-anchor="middle" class="lbl">+' + num(m.share, 1) + "%</text>";
      g += '<text x="' + (x + bw / 2) + '" y="' + (H - 10) + '" text-anchor="middle" class="ax">' + esc(m.label) + "</text>";
    });
    return legend([{ name: "CoffeeBot existing (lower bound)", color: "#d9c9a0" }, { name: "Existing range (" + o.low + "–" + o.high + "%)", color: "#efe3bd", hatch: true }, { name: "Bean Again verified", color: SERIES[0] }]) +
      '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Reuse rate by month">' + g + "</svg>" +
      table(["Month", "Bean Again verified kg", "Added share", "Total reuse"], o.months.map(function (m) { return [m.label, num(m.kg, 1), "+" + num(m.share, 2) + " pts", num(o.low + m.share, 1) + "–" + num(o.high + m.share, 1) + "%"]; }));
  }

  function ribbon(x0, a0, b0, x1, a1, b1) { // filled band from [a0,b0] at x0 to [a1,b1] at x1
    var m = (x0 + x1) / 2;
    return "M" + x0 + "," + a0 + "C" + m + "," + a0 + " " + m + "," + a1 + " " + x1 + "," + a1 + "L" + x1 + "," + b1 + "C" + m + "," + b1 + " " + m + "," + b0 + " " + x0 + "," + b0 + "Z";
  }

  /* linear flow (Sankey-style): stages left to right, the main band narrows, losses branch down in grey */
  function flow(o) {
    var st = o.stages, W = Math.max(o.width, 640), n = st.length, nw = 12, T = 58, maxH = 150, lossGap = 70;
    var k = maxH / Math.max.apply(null, st.map(function (s) { return s.kg; }));
    var L = 10, R = 10, x = function (i) { return L + i * (W - L - R - nw) / (n - 1); };
    var H = T + maxH + lossGap + 64, g = "", fmt = o.fmt;
    st.forEach(function (s, i) {
      var h = s.kg * k, cx = x(i) + nw / 2, anchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle", tx = i === 0 ? x(i) : i === n - 1 ? x(i) + nw : cx;
      if (i < n - 1) {
        var nx = st[i + 1], h2 = nx.kg * k, lost = nx.lost * k;
        g += '<path d="' + ribbon(x(i) + nw, T, T + h2, x(i + 1), T, T + h2) + '" fill="' + SERIES[0] + '" fill-opacity=".28"' + tip(s.label + " → " + nx.label + "\n" + fmt(nx.kg)) + "/>";
        if (nx.lost > 0.05) {
          var lx = (x(i) + nw + x(i + 1)) / 2, ly = T + maxH + lossGap, lw = Math.max(2, lost);
          // loss branch: from the bottom of this node, curving down to a grey end
          var p = "M" + (x(i) + nw) + "," + (T + h2 + 2) + "C" + lx + "," + (T + h2 + 2) + " " + (lx - lw / 2) + "," + (ly - 40) + " " + (lx - lw / 2) + "," + ly +
            "H" + (lx + lw / 2) + "C" + (lx + lw / 2) + "," + (ly - 40) + " " + lx + "," + (T + h2 + 2 + lost) + " " + (x(i) + nw) + "," + (T + h2 + 2 + lost) + "Z";
          g += '<path d="' + p + '" fill="' + LOSS + '" fill-opacity=".75"' + tip(fmt(nx.lost) + " " + nx.lostLabel) + "/>";
          g += '<text x="' + lx + '" y="' + (ly + 20) + '" text-anchor="middle" class="lbl">' + esc(fmt(nx.lost)) + '</text><text x="' + lx + '" y="' + (ly + 38) + '" text-anchor="middle" class="ax">' + esc(nx.lostLabel) + "</text>";
        }
      }
      g += '<rect x="' + x(i) + '" y="' + T + '" width="' + nw + '" height="' + Math.max(2, h) + '" rx="2" fill="' + SERIES[0] + '"' + tip(s.label + "\n" + fmt(s.kg) + (st[0].kg ? "\n" + num(s.kg / st[0].kg * 100) + "% of collected" : "")) + "/>";
      g += '<text x="' + tx + '" y="' + (T - 30) + '" text-anchor="' + anchor + '" class="lbl">' + esc(s.label) + '</text><text x="' + tx + '" y="' + (T - 12) + '" text-anchor="' + anchor + '" class="ax">' + esc(fmt(s.kg)) + "</text>";
    });
    return '<div class="scroll"><svg class="chart fixed" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(o.label) + '">' + g + "</svg></div>" +
      table(["Stage", "kg (wet-equivalent)", "Lost before this stage", "Why"], st.map(function (s) { return [s.label, fmt(s.kg), s.lost ? fmt(s.lost) : "–", s.lostLabel || ""]; }));
  }

  /* two-column flow: sources (left) to targets (right), ribbon width = kg */
  function bipartite(o) {
    var W = Math.max(o.width, 600), gap = 18, T = 10, nw = 12, maxH = 220;
    var total = o.links.reduce(function (a, l) { return a + l.kg; }, 0);
    var nL = o.left.length, nR = o.right.length, k = maxH / total;
    var H = T + maxH + gap * Math.max(nL, nR) + 10, lw = Math.min(190, W * 0.3), rw = Math.min(200, W * 0.32);
    var xL = lw, xR = W - rw - nw, g = "";
    function place(nodes, key) {
      var y = T, pos = {};
      nodes.forEach(function (nd) { var kg = o.links.filter(function (l) { return l[key] === nd.id; }).reduce(function (a, l) { return a + l.kg; }, 0); pos[nd.id] = { y: y, h: kg * k, kg: kg, off: 0 }; y += kg * k + gap; });
      return pos;
    }
    var PL = place(o.left, "from"), PR = place(o.right, "to");
    o.links.forEach(function (l) {
      var a = PL[l.from], b = PR[l.to], h = l.kg * k, c = l.color || SERIES[0];
      g += '<path d="' + ribbon(xL + nw, a.y + a.off, a.y + a.off + h, xR, b.y + b.off, b.y + b.off + h) + '" fill="' + c + '" fill-opacity=".38"' + tip(l.tip) + "/>";
      a.off += h; b.off += h;
    });
    o.left.forEach(function (nd) { var p = PL[nd.id];
      g += '<rect x="' + xL + '" y="' + p.y + '" width="' + nw + '" height="' + p.h + '" rx="2" fill="' + INK + '"/><text x="' + (xL - 10) + '" y="' + (p.y + p.h / 2 - 2) + '" text-anchor="end" class="lbl">' + esc(nd.name) + '</text><text x="' + (xL - 10) + '" y="' + (p.y + p.h / 2 + 16) + '" text-anchor="end" class="ax">' + esc(o.fmt(p.kg)) + "</text>"; });
    o.right.forEach(function (nd, i) { var p = PR[nd.id];
      g += '<rect x="' + xR + '" y="' + p.y + '" width="' + nw + '" height="' + p.h + '" rx="2" fill="' + (nd.color || SERIES[i]) + '"/><text x="' + (xR + nw + 10) + '" y="' + (p.y + p.h / 2 - 2) + '" class="lbl">' + esc(nd.name) + '</text><text x="' + (xR + nw + 10) + '" y="' + (p.y + p.h / 2 + 16) + '" class="ax">' + esc(o.fmt(p.kg)) + "</text>"; });
    return '<div class="scroll"><svg class="chart fixed" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(o.label) + '">' + g + "</svg></div>" +
      table(["From", "To", "kg"], o.links.map(function (l) { return [o.left.filter(function (n) { return n.id === l.from; })[0].name, o.right.filter(function (n) { return n.id === l.to; })[0].name, o.fmt(l.kg)]; }));
  }

  /* waterfall: running total; gains and costs float, the final bar is the net from zero.
   * items: [{label, v (number or null = TBC), tip}], last item is the total (total:true) */
  function waterfall(o) {
    var W = Math.max(o.width, 560), H = 300, L = 56, R = 16, T = 30, B = 46, n = o.items.length, run = 0, pts = [];
    o.items.forEach(function (it) {
      if (it.total) { pts.push({ a: 0, b: it.v }); return; }
      var v = it.v == null ? 0 : it.v; pts.push({ a: run, b: run + v }); run += v;
    });
    var lo = Math.min(0, Math.min.apply(null, pts.map(function (p) { return Math.min(p.a, p.b); })));
    var hi = Math.max(0, Math.max.apply(null, pts.map(function (p) { return Math.max(p.a, p.b); })));
    var sc = scale(Math.max(Math.abs(lo), Math.abs(hi)) * 1.1), step = sc.step;
    var top = Math.ceil(hi * 1.08 / step) * step || step, bot = Math.floor(lo * 1.08 / step) * step;
    var y = function (v) { return T + (top - v) / (top - bot) * (H - T - B); };
    var slot = (W - L - R) / n, bw = Math.min(64, slot * 0.56), g = "";
    for (var t = bot; t <= top + 1e-9; t += step) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="' + GRID + '" stroke-width="1"/><text x="' + (L - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end" class="ax">' + num(t) + "</text>";
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="' + INK + '" stroke-width="1.5"/>';
    o.items.forEach(function (it, i) {
      var p = pts[i], x = L + slot * i + (slot - bw) / 2, y1 = y(Math.max(p.a, p.b)), y2 = y(Math.min(p.a, p.b)), h = Math.max(0, y2 - y1);
      var col = it.total ? INK : it.v == null ? "none" : it.v >= 0 ? SERIES[1] : SERIES[0];
      if (it.v == null) {
        g += '<rect x="' + x + '" y="' + (y(p.a) - 14) + '" width="' + bw + '" height="28" fill="transparent" stroke="' + MUTED + '" stroke-width="1.5" stroke-dasharray="4 3"' + tip(it.tip || it.label + "\nTBC") + '/><text x="' + (x + bw / 2) + '" y="' + (y(p.a) + 5) + '" text-anchor="middle" class="ax">TBC</text>';
      } else {
        g += '<rect x="' + x + '" y="' + y1 + '" width="' + bw + '" height="' + Math.max(1.5, h) + '" rx="3" fill="' + col + '"' + tip(it.tip || it.label) + "/>";
        var above = it.v >= 0, ly = above ? y1 - 8 : y2 + 18;
        g += '<text x="' + (x + bw / 2) + '" y="' + ly + '" text-anchor="middle" class="lbl">' + esc(o.fmt(it.v)) + "</text>";
      }
      if (i < n - 1 && !o.items[i + 1].total) { var xn = L + slot * (i + 1) + (slot - bw) / 2; g += '<line x1="' + (x + bw) + '" x2="' + xn + '" y1="' + y(p.b) + '" y2="' + y(p.b) + '" stroke="' + MUTED + '" stroke-width="1"/>'; }
      var words = it.label.split(" "), l1 = [], l2 = [];
      words.forEach(function (w) { (l1.join(" ").length + w.length < 13 && !l2.length ? l1 : l2).push(w); });
      g += '<text x="' + (x + bw / 2) + '" y="' + (H - 26) + '" text-anchor="middle" class="ax">' + esc(l1.join(" ")) + "</text>" + (l2.length ? '<text x="' + (x + bw / 2) + '" y="' + (H - 10) + '" text-anchor="middle" class="ax">' + esc(l2.join(" ")) + "</text>" : "");
    });
    return legend([{ name: "Adds to the claim", color: SERIES[1] }, { name: "Takes away", color: SERIES[0] }, { name: "Net", color: INK }]) +
      '<div class="scroll"><svg class="chart fixed" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(o.label) + '">' + g + "</svg></div>" +
      table(["Item", "kg CO₂e"], o.items.map(function (it) { return [it.label, it.v == null ? "TBC" : o.fmt(it.v)]; }));
  }

  /* grouped horizontal bars: one group per row, one bar per series (values as % of a total) */
  function groupedBars(o) {
    var W = Math.max(o.width, 520), lw = 190, R = 110, bh = 14, gap = 2, groupGap = 18, T = 6;
    var ns = o.series.length, gh = ns * bh + (ns - 1) * gap, H = T + o.groups.length * (gh + groupGap);
    var x = function (p) { return lw + p / 100 * (W - lw - R); }, g = "";
    [0, 25, 50, 75, 100].forEach(function (t) { g += '<line x1="' + x(t) + '" x2="' + x(t) + '" y1="' + T + '" y2="' + (H - groupGap + 4) + '" stroke="' + GRID + '" stroke-width="1"/><text x="' + x(t) + '" y="' + (H + 8) + '" text-anchor="middle" class="ax">' + t + "%</text>"; });
    o.groups.forEach(function (gr, gi) {
      var y0 = T + gi * (gh + groupGap);
      g += '<text x="' + (lw - 12) + '" y="' + (y0 + gh / 2 - 2) + '" text-anchor="end" class="lbl">' + esc(gr.label) + "</text>" +
        (gr.sub ? '<text x="' + (lw - 12) + '" y="' + (y0 + gh / 2 + 15) + '" text-anchor="end" class="ax">' + esc(gr.sub) + "</text>" : "");
      gr.values.forEach(function (v, si) {
        var p = o.total ? v / o.total * 100 : 0, y = y0 + si * (bh + gap);
        g += '<path d="' + barPath(lw, y, Math.max(1, x(p) - lw), bh) + '" fill="' + o.colors[si] + '"' + tip(gr.label + "\n" + o.series[si] + ": " + num(v) + " of " + num(o.total) + " (" + num(p) + "%)") + "/>";
        g += '<text x="' + (x(p) + 6) + '" y="' + (y + bh - 2) + '" class="ax">' + num(v) + " (" + num(p) + "%)</text>";
      });
    });
    return legend(o.series.map(function (n, i) { return { name: n, color: o.colors[i] }; })) +
      '<div class="scroll"><svg class="chart fixed" viewBox="0 0 ' + W + " " + (H + 14) + '" width="' + W + '" height="' + (H + 14) + '" role="img" aria-label="' + esc(o.label) + '">' + g + "</svg></div>" +
      table(["Project"].concat(o.series), o.groups.map(function (gr) { return [gr.label].concat(gr.values.map(function (v) { return num(v) + " (" + num(v / o.total * 100) + "%)"; })); }));
  }

  /* tooltip binding (call once) */
  function bindTips() {
    var box = document.createElement("div"); box.className = "tip"; box.setAttribute("role", "tooltip"); document.body.appendChild(box);
    function show(el, x, y) {
      box.innerHTML = esc(el.getAttribute("data-tip")).split("\n").map(function (l, i) { return i ? l : "<b>" + l + "</b>"; }).join("<br>");
      box.style.display = "block";
      var bw = box.offsetWidth, bh = box.offsetHeight;
      box.style.left = Math.max(8, Math.min(window.innerWidth - bw - 8, x + 14)) + "px";
      box.style.top = Math.max(8, y - bh - 12) + "px";
      var h = el.closest(".hov"); document.querySelectorAll(".hov.on").forEach(function (n) { n.classList.remove("on"); }); if (h) h.classList.add("on");
    }
    function hide() { box.style.display = "none"; document.querySelectorAll(".hov.on").forEach(function (n) { n.classList.remove("on"); }); }
    document.addEventListener("mousemove", function (e) { var el = e.target.closest && e.target.closest("[data-tip]"); if (el) show(el, e.clientX, e.clientY); else hide(); });
    document.addEventListener("focusin", function (e) { var el = e.target.closest && e.target.closest("[data-tip]"); if (el) { var r = el.getBoundingClientRect(); show(el, r.left + r.width / 2, r.top); } });
    document.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, { passive: true });
  }

  return { SERIES: SERIES, LOSS: LOSS, GRID: GRID, esc: esc, num: num, niceMax: niceMax, tip: tip, colPath: colPath, barPath: barPath,
    scale: scale, legend: legend, table: table, spark: spark, lines: lines, reuse: reuse, flow: flow, bipartite: bipartite, waterfall: waterfall, groupedBars: groupedBars, bindTips: bindTips };
})();
