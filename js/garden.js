/* The class garden: eight plants a student can choose from, each drawn in three growth stages, and the pixel-art
 * scene they stand in. Everything is generated from small drawing helpers, so it is easy to retune.
 * Stage 1 = sprout, 2 = growing, 3 = in bloom or fruit. */
var GARDEN = (function () {
  "use strict";
  var W = 17, H = 24, CX = 8, BASE = 23;           // each plant sprite is 17 x 24 pixels and stands on the bottom row
  var C = {
    out: "#2d3a14", stem: "#4F8024", g: "#6FA52F", G: "#A9CC3E", m: "#4d7f23",
    y: "#F4CE5B", Y: "#FFE9A0", brown: "#6a3718", B: "#9a5a2a", o: "#E8892B",
    r: "#D6453D", R: "#9C2A27", p: "#E58BAE", P: "#F9CFDD", v: "#8B4FB8", V: "#C79BE3",
    w: "#FFFFFF", k: "#8a5a2b", K: "#5e3a1e", chili: "#E03A2F"
  };
  var SPECIES = ["sunflower", "orchid", "hibiscus", "chilli", "pandan", "frangipani", "tomato", "raintree"];

  function blank() { var g = []; for (var y = 0; y < H; y++) g.push(new Array(W)); return g; }
  function put(g, x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = C[c] || c; }
  function disc(g, cx, cy, r, c) { for (var y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r + 0.3) put(g, x, y, c); }
  function line(g, x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) { put(g, x0, y0, c); if (x0 === x1 && y0 === y1) break; var e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function stem(g, h, c) { for (var i = 0; i <= h; i++) put(g, CX, BASE - i, c || "stem"); }
  /* a leaf climbing at 45 degrees from the stem, lighter on top */
  function leaf(g, y0, side, n, c1, c2) { for (var k = 1; k <= n; k++) { put(g, CX + side * k, y0 - (k - 1), k === n ? c2 : c1); if (k >= 2) put(g, CX + side * (k - 1), y0 - (k - 1), c2); } }
  function leaves(g, y0, n) { leaf(g, y0, -1, n, "g", "G"); leaf(g, y0, 1, n, "g", "G"); }
  function sprout(g) { stem(g, 3); leaves(g, BASE - 3, 2); }
  /* a 1px dark outline around everything that is drawn */
  function outline(g) {
    var add = [];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (g[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var n = (g[y + d[1]] || [])[x + d[0]]; return n && n !== C.stem; })) add.push([x, y]);
    }
    add.forEach(function (p) { g[p[1]][p[0]] = C.out; });
  }

  var DRAW = {
    sunflower: function (g, s) {
      if (s === 1) return sprout(g);
      if (s === 2) { stem(g, 11); leaves(g, BASE - 4, 3); disc(g, CX, BASE - 13, 1.6, "g"); put(g, CX, BASE - 15, "y"); put(g, CX - 1, BASE - 14, "y"); put(g, CX + 1, BASE - 14, "y"); return; }
      stem(g, 13); leaves(g, BASE - 4, 3); leaves(g, BASE - 7, 3);
      var cy = BASE - 16;
      for (var a = 0; a < 16; a++) { var t = a / 16 * Math.PI * 2; put(g, CX + Math.cos(t) * 4.6, cy + Math.sin(t) * 4.6, a % 2 ? "Y" : "y"); put(g, CX + Math.cos(t) * 3.7, cy + Math.sin(t) * 3.7, "y"); }
      disc(g, CX, cy, 2.6, "brown"); put(g, CX - 1, cy - 1, "B"); put(g, CX + 1, cy, "B"); put(g, CX, cy + 1, "B");
    },
    orchid: function (g, s) {
      if (s === 1) return sprout(g);
      line(g, CX, BASE, CX - 6, BASE - 4, "g"); line(g, CX + 1, BASE, CX - 5, BASE - 5, "G"); line(g, CX, BASE, CX + 6, BASE - 4, "g"); line(g, CX - 1, BASE, CX + 5, BASE - 5, "G"); line(g, CX, BASE, CX, BASE - 6, "g");
      line(g, CX, BASE - 1, CX + 1, BASE - 9, "stem");
      if (s === 2) { put(g, CX + 1, BASE - 10, "V"); put(g, CX + 2, BASE - 9, "v"); return; }
      line(g, CX + 1, BASE - 9, CX + 4, BASE - 13, "stem"); line(g, CX + 4, BASE - 13, CX + 6, BASE - 14, "stem");
      [[1, 9], [3, 12], [6, 15], [-1, 11], [5, 11]].forEach(function (p) {
        var x = CX + p[0], y = BASE - p[1];
        put(g, x, y - 1, "v"); put(g, x - 1, y, "V"); put(g, x, y, "w"); put(g, x + 1, y, "V"); put(g, x, y + 1, "v"); put(g, x, y + 2, "p");
      });
    },
    hibiscus: function (g, s) {
      if (s === 1) return sprout(g);
      var r = s === 2 ? 3.4 : 4.7, cy = BASE - (s === 2 ? 4 : 6);
      stem(g, 2, "k"); disc(g, CX, cy, r, "g"); disc(g, CX - 1.5, cy - 1.5, r * 0.45, "G"); disc(g, CX + 2, cy + 2, r * 0.4, "m");
      if (s === 2) { put(g, CX + 2, BASE - 9, "r"); put(g, CX + 2, BASE - 8, "R"); return; }
      [[-3, 9], [3, 8], [0, 12]].forEach(function (p) {
        var x = CX + p[0], y = BASE - p[1]; disc(g, x, y, 2, "r"); put(g, x - 1, y - 1, "p"); put(g, x, y, "y"); put(g, x + 1, y - 2, "y"); put(g, x, y + 1, "R"); put(g, x + 1, y + 1, "R");
      });
    },
    chilli: function (g, s) {
      if (s === 1) return sprout(g);
      var h = s === 2 ? 8 : 12;
      stem(g, h); leaves(g, BASE - 3, 2); leaves(g, BASE - 6, 3); if (s === 3) { leaves(g, BASE - 9, 3); leaf(g, BASE - 12, -1, 2, "g", "G"); leaf(g, BASE - 12, 1, 2, "g", "G"); }
      if (s === 2) { put(g, CX - 2, BASE - 5, "G"); put(g, CX - 2, BASE - 4, "G"); put(g, CX + 3, BASE - 8, "w"); return; }
      [[-3, 4], [4, 7], [-4, 8], [3, 3]].forEach(function (p) { var x = CX + p[0], y = BASE - p[1]; put(g, x, y, "chili"); put(g, x, y + 1, "chili"); put(g, x, y + 2, "R"); });
      put(g, CX + 2, BASE - 12, "w"); put(g, CX - 2, BASE - 13, "w");
    },
    pandan: function (g, s) {
      if (s === 1) return sprout(g);
      var tips = s === 2 ? [[-5, -8], [0, -10], [5, -8]] : [[-8, -9], [-4, -14], [0, -17], [4, -14], [8, -9]];
      tips.forEach(function (t, i) { line(g, CX, BASE, CX + t[0], BASE + t[1], i % 2 ? "G" : "g"); line(g, CX + (t[0] < 0 ? -1 : 1), BASE, CX + t[0] + (t[0] < 0 ? -1 : 1), BASE + t[1] + 1, "g"); });
      put(g, CX, BASE, "g");
    },
    frangipani: function (g, s) {
      if (s === 1) return sprout(g);
      stem(g, s === 2 ? 7 : 9, "k"); put(g, CX + 1, BASE, "K"); put(g, CX - 1, BASE, "K");
      if (s === 2) { disc(g, CX - 2, BASE - 8, 1.6, "g"); disc(g, CX + 2, BASE - 8, 1.6, "g"); disc(g, CX, BASE - 10, 1.8, "G"); return; }
      line(g, CX, BASE - 6, CX - 4, BASE - 9, "k"); line(g, CX, BASE - 7, CX + 4, BASE - 10, "k");
      disc(g, CX - 5, BASE - 11, 2.3, "g"); disc(g, CX + 5, BASE - 12, 2.3, "g"); disc(g, CX, BASE - 13, 2.8, "g");
      put(g, CX - 1, BASE - 14, "G"); put(g, CX - 6, BASE - 12, "G"); put(g, CX + 4, BASE - 13, "G");
      [[-5, 15], [5, 16], [0, 17]].forEach(function (p) { var x = CX + p[0], y = BASE - p[1]; put(g, x, y - 1, "w"); put(g, x - 1, y, "w"); put(g, x + 1, y, "w"); put(g, x, y + 1, "w"); put(g, x, y, "y"); put(g, x - 1, y - 1, "P"); put(g, x + 1, y + 1, "P"); });
    },
    tomato: function (g, s) {
      if (s === 1) return sprout(g);
      var r = s === 2 ? 3.4 : 4.6, cy = BASE - (s === 2 ? 4 : 5.5);
      stem(g, 2); disc(g, CX, cy, r, "g"); disc(g, CX - r * 0.35, cy - r * 0.35, r * 0.5, "G"); disc(g, CX + r * 0.45, cy + r * 0.4, r * 0.4, "m");
      if (s === 2) { put(g, CX - 2, BASE - 7, "y"); put(g, CX + 2, BASE - 6, "y"); put(g, CX, BASE - 8, "y"); return; }
      [[-3, 7], [3, 6], [0, 3], [-2, 11], [3, 10]].slice(0, 4).forEach(function (p) { var x = CX + p[0], y = BASE - p[1]; disc(g, x, y, 1.7, "r"); put(g, x - 1, y - 1, "P"); put(g, x, y - 2, "g"); put(g, x - 1, y - 2, "G"); put(g, x + 1, y - 2, "G"); put(g, x + 1, y + 1, "R"); });
    },
    raintree: function (g, s) {
      if (s === 1) return sprout(g);
      var th = s === 2 ? 5 : 8, r = s === 2 ? 3.4 : 5.6, cy = BASE - th - (s === 2 ? 3 : 5);
      stem(g, th, "k"); put(g, CX + 1, BASE, "K"); put(g, CX - 1, BASE, "K");
      disc(g, CX, cy, r, "g"); disc(g, CX - r * 0.35, cy - r * 0.35, r * 0.55, "G"); disc(g, CX + r * 0.45, cy + r * 0.45, r * 0.45, "m");
      if (s === 3) { put(g, CX - 3, cy + 1, "G"); put(g, CX + 2, cy - 3, "G"); put(g, CX + 4, cy, "p"); put(g, CX - 4, cy - 2, "p"); }
    }
  };

  var cache = {};
  function grid(species, stage) {
    var key = species + stage;
    if (!cache[key]) { var g = blank(); (DRAW[species] || DRAW.sunflower)(g, stage); outline(g); cache[key] = g; }
    return cache[key];
  }
  function runs(g) {
    var out = [];
    for (var y = 0; y < H; y++) { var x = 0; while (x < W) { var c = g[y][x]; if (!c) { x++; continue; } var x2 = x; while (x2 + 1 < W && g[y][x2 + 1] === c) x2++; out.push('<rect x="' + x + '" y="' + y + '" width="' + (x2 - x + 1) + '" height="1" fill="' + c + '"/>'); x = x2 + 1; } }
    return out.join("");
  }
  /* one plant on its own: for the "choose a plant" cards */
  function plantSVG(species, stage, px) {
    return '<svg class="px" role="img" aria-label="' + species + ' growth stage ' + stage + '" width="' + W * px + '" height="' + H * px + '" viewBox="0 0 ' + W + ' ' + H + '">' + runs(grid(species, stage)) + '</svg>';
  }
  /* the sprites defined once, then placed with <use>, so a garden of 300 plants stays light */
  function defs() {
    var out = '';
    SPECIES.forEach(function (s) { [1, 2, 3].forEach(function (st) { out += '<g id="gp-' + s + '-' + st + '">' + runs(grid(s, st)) + '</g>'; }); });
    return '<defs>' + out + '</defs>';
  }


  /* ---------- the scene ---------- */
  function rnd(n) { var x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); }
  function rect(x, y, w, h, c) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '"/>'; }
  function topRow(species, stage) { var g = grid(species, stage); for (var y = 0; y < H; y++) if (g[y].some(Boolean)) return y; return 0; }
  function cloud(x, y, k) {
    var w = [[0, 2, 10], [2, 0, 8], [-2, 3, 14], [0, 5, 12]];       // stacked rounded bars: a fluffy pixel cloud
    return '<g class="cloud" style="animation-delay:-' + k * 11 + 's">' + w.map(function (r) { return rect(x + r[0], y + r[1] * 1, r[2], 2, "#FFFFFF"); }).join("") + rect(x - 2, y + 7, 14, 1, "#DCEFF7") + '</g>';
  }
  function butterfly(y, color, k) {
    return '<g class="bf" style="animation-delay:-' + k * 7 + 's"><g class="bfy" style="animation-delay:-' + k + 's">' + rect(0, 1, 2, 2, color) + rect(3, 1, 2, 2, color) + rect(2, 1, 1, 3, "#3a2a14") + rect(0, 3, 2, 1, color) + rect(3, 3, 2, 1, color) + '</g></g>';
  }
  function bed(x, y, tilled) {          // a raised bed of soil: 15 x 5 pixels
    return rect(x + 2, y, 13, 1, "#9a6a3c") + rect(x + 1, y + 1, 15, 3, "#7a4f2a") + rect(x + 2, y + 4, 13, 1, "#5a381d") +
      rect(x + 4, y + 2, 1, 1, "#b5a58b") + rect(x + 11, y + 3, 1, 1, "#b5a58b") + (tilled ? rect(x + 7, y + 1, 3, 1, "#8c5e34") : "");
  }
  /* plants: [{species, stage (1-3), you:bool, title}]. opt.emptyPlots: free beds to show after the plants. */
  function scene(plants, opt) {
    opt = opt || {};
    var n = plants.length, total = Math.max(n + (opt.emptyPlots || 0), 10), CW = 20, RH = 20, PAD = 12, SKY = 56;
    var cols = Math.max(6, Math.min(22, Math.round(Math.sqrt(total * 2.1)))), rows = Math.ceil(total / cols);
    var SW = cols * CW + PAD * 2, SH = SKY + 10 + rows * RH + H - 6;
    var out = [], i, x, y;
    // sky in pixel bands, with a sun
    ["#8fd0ee", "#a3daf1", "#b6e3f3", "#c9ecf4", "#dbf3f2", "#ecf8e9"].forEach(function (c, k) { out.push(rect(0, k * (SKY / 6), SW, SKY / 6 + 1, c)); });
    out.push('<g class="sun">' + [[-6, 2, 12], [-7, -2, 14], [-7, -3, 14], [-6, -6, 12], [-4, -8, 8]].map(function () { return ""; }).join("") + '</g>');
    (function () { var cx = SW - 34, cy = 15; for (var yy = -9; yy <= 9; yy++) for (var xx = -9; xx <= 9; xx++) { var d = xx * xx + yy * yy; if (d <= 49) out.push(rect(cx + xx, cy + yy, 1, 1, d <= 30 ? "#FFE97A" : "#FFD84A")); else if (d <= 81) out.push(rect(cx + xx, cy + yy, 1, 1, "#FFF3B8")); } })();
    out.push(cloud(10, 10, 0), cloud(SW * 0.45, 5, 1), cloud(SW * 0.8, 20, 2));
    // two layers of hills, with a few small trees on the far one
    for (x = 0; x < SW; x += 2) { var h1 = 12 + 7 * Math.sin(x / 23) + 4 * Math.sin(x / 9 + 1); out.push(rect(x, SKY - 4 - h1, 2, h1 + 6, "#a5d28e")); }
    for (x = 0; x < SW; x += 2) { var h2 = 7 + 4 * Math.sin(x / 17 + 2) + 3 * Math.sin(x / 7); out.push(rect(x, SKY - 4 - h2, 2, h2 + 6, "#86bf6d")); }
    for (i = 0; i < Math.floor(SW / 46); i++) { x = 14 + i * 46 + rnd(i) * 20; var ty = SKY - 15 - 6 * Math.sin(x / 17 + 2); out.push(rect(x + 2, ty + 4, 2, 4, "#7a5a30") + rect(x, ty, 6, 5, "#5e9e4f") + rect(x + 1, ty - 1, 4, 1, "#5e9e4f") + rect(x + 1, ty + 1, 2, 2, "#7ab863")); }
    // the meadow, mown in stripes, with grass tufts and wild flowers
    out.push(rect(0, SKY + 1, SW, SH - SKY, "#79be48"));
    for (y = SKY + 1, i = 0; y < SH; y += RH, i++) if (i % 2) out.push(rect(0, y, SW, RH, "#82c650"));
    var area = SW * (SH - SKY);
    for (i = 0; i < Math.floor(area / 70); i++) { x = rnd(i * 7 + 1) * SW; y = SKY + 4 + rnd(i * 13 + 5) * (SH - SKY - 5); out.push(rect(Math.floor(x), Math.floor(y), 2, 1, i % 3 ? "#5fa436" : "#9ad66a")); }
    var FL = ["#FFFFFF", "#F9A8C9", "#FFE066", "#C79BE3"];
    for (i = 0; i < Math.floor(area / 650); i++) { x = Math.floor(rnd(i * 17 + 3) * (SW - 2)); y = Math.floor(SKY + 6 + rnd(i * 23 + 9) * (SH - SKY - 9)); out.push(rect(x, y, 1, 1, FL[i % 4]) + rect(x, y + 1, 1, 1, "#4f9a2f")); }
    // a wooden fence along the back
    for (x = 0; x < SW; x += 14) out.push(rect(x, SKY - 5, 2, 8, "#c79a63") + rect(x, SKY - 5, 2, 1, "#e0b883"));
    out.push(rect(0, SKY - 3, SW, 1, "#a87b46") + rect(0, SKY, SW, 1, "#a87b46"));
    // beds and plants, back to front
    var marks = [], items = [];
    for (i = 0; i < total; i++) {
      var col = i % cols, row = Math.floor(i / cols), bx = PAD + col * CW + 1, by = SKY + 10 + row * RH;
      var p = plants[i];
      var px = bx + (p ? Math.round((rnd(i + 3) - 0.5) * 2) : 0);
      out.push(bed(bx, by + 18, !p));
      if (p) {
        var sp = SPECIES.indexOf(p.species) < 0 ? "sunflower" : p.species, st = Math.max(1, Math.min(3, p.stage | 0 || 1));
        items.push('<g class="plant"><title>' + (p.title || sp).replace(/[<>&"]/g, "") + '</title><use href="#gp-' + sp + '-' + st + '" x="' + px + '" y="' + (by - 1) + '"/></g>');
        if (p.you) marks.push([px + CX, by - 1 + topRow(sp, st) - 7]);
        out.push(items.pop());
      }
    }
    // gold arrows over the viewer's own plants
    marks.forEach(function (m, k) {
      var ax = m[0], ay = Math.max(1, m[1]);
      out.push('<g class="you-arrow" style="animation-delay:-' + (k % 4) * 0.3 + 's">' + rect(ax - 3, ay, 7, 1, "#721F1F") + rect(ax - 2, ay + 1, 5, 1, "#721F1F") + rect(ax - 1, ay + 2, 3, 1, "#721F1F") + rect(ax, ay + 3, 1, 1, "#721F1F") +
        rect(ax - 2, ay, 5, 1, "#F4CE5B") + rect(ax - 1, ay + 1, 3, 1, "#F4CE5B") + rect(ax, ay + 2, 1, 1, "#F4CE5B") + '</g>');
    });
    out.push('<g transform="translate(0,' + (SKY + 4) + ')">' + butterfly(0, "#F9A8C9", 0) + '</g><g transform="translate(0,' + (SKY + 22) + ')">' + butterfly(0, "#FFE066", 2) + '</g>');
    return '<svg class="px garden-scene" viewBox="0 0 ' + SW + ' ' + SH + '" width="100%" style="display:block;max-width:' + Math.round(SW * 6) + 'px;--sw:' + SW + 'px" role="img" aria-label="Garden with ' + n + ' plants">' + defs() + out.join("") + '</svg>';
  }

  return { SPECIES: SPECIES, W: W, H: H, C: C, plantSVG: plantSVG, defs: defs, grid: grid, runs: runs, scene: scene };
})();
