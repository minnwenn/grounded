/* In-browser photo check with MobileCLIP-S0 (image model only, ~23 MB, downloaded once and cached).
 * The text side is precomputed in js/clip-labels.js (see tools/make-clip-labels.mjs).
 * The photo never leaves the device for this check.
 *
 * Rule: pass  = the expected project is the best match AND scores >= PASS
 *       fail  = the expected project scores < FAIL
 *       unsure (teacher reviews) = anything in between
 */
var clipCheck = (function () {
  "use strict";
  var LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.min.js";
  var PASS = 0.6, FAIL = 0.1, SCALE = 100;
  var loading = null, files = {};

  function load(onProgress) {
    if (!loading) {
      loading = import(LIB).then(function (t) {
        var opts = {
          progress_callback: function (e) {
            if (e.status !== "progress" || !e.total) return;
            files[e.file] = [e.loaded, e.total];
            var l = 0, n = 0;
            for (var k in files) { l += files[k][0]; n += files[k][1]; }
            if (onProgress) onProgress(Math.round(l / n * 100));
          }
        };
        return Promise.all([
          t.AutoProcessor.from_pretrained(CLIP_LABELS.model, opts),
          t.CLIPVisionModelWithProjection.from_pretrained(CLIP_LABELS.model, Object.assign({ dtype: "fp16", device: "wasm" }, opts))
        ]).then(function (r) { return { t: t, proc: r[0], model: r[1] }; });
      });
      loading.catch(function () { loading = null; }); // let the next photo retry
    }
    return loading;
  }

  function score(vec) {
    var n = 0, i, j;
    for (i = 0; i < vec.length; i++) n += vec[i] * vec[i];
    n = Math.sqrt(n);
    var sims = CLIP_LABELS.embeds.map(function (e) {
      var s = 0; for (j = 0; j < e.length; j++) s += e[j] * vec[j] / n; return s * SCALE;
    });
    var mx = Math.max.apply(null, sims), ex = sims.map(function (s) { return Math.exp(s - mx); });
    var tot = ex.reduce(function (a, b) { return a + b; }, 0);
    return ex.map(function (x) { return x / tot; });
  }

  function check(project, dataUrl, onProgress) {
    return load(onProgress).then(function (m) {
      return m.t.RawImage.fromURL(dataUrl)
        .then(function (img) { return m.proc(img); })
        .then(function (inp) { return m.model(inp); })
        .then(function (out) {
          var pr = score(Array.from(out.image_embeds.data));
          var L = CLIP_LABELS.labels, i = L.indexOf(project.id), top = pr.indexOf(Math.max.apply(null, pr));
          var p = i < 0 ? 0 : pr[i], name = project.name.toLowerCase();
          if (top === i && p >= PASS) return { verdict: "pass", confidence: p, feedback: "That looks like your " + name + ". Great work!", mode: "clip" };
          if (p < FAIL) return { verdict: "fail", confidence: p, feedback: "This doesn't look like your " + name + " yet. Try a clear photo of your finished project.", mode: "clip" };
          return { verdict: "unsure", confidence: p, feedback: "Not sure this shows your " + name + ". Your teacher will take a look.", mode: "clip" };
        });
    }).catch(function (e) {
      if (window.console) console.warn("photo check failed", e);
      return { verdict: "unsure", confidence: 0, feedback: "The photo checker couldn't load. Your teacher will check your photo instead.", mode: "offline" };
    });
  }

  return { check: check, warm: function (onProgress) { load(onProgress).catch(function () {}); } };
})();
