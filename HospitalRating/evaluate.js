// Usage: node evaluate.js
// Holds out 20% of the training sentences (stratified, fixed seed) and reports
// accuracy + confusion tables for the item and outcome classifiers.
var C = require("./classifier.js");
var rows = require("./data/training.js");

// deterministic shuffle (mulberry32) so the number is reproducible for judges
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var rand = rng(42);

// stratify by item so every category appears in the test set
var byItem = {};
rows.forEach(function (r) { (byItem[r.item] = byItem[r.item] || []).push(r); });
var train = [], test = [];
Object.keys(byItem).forEach(function (k) {
  var g = byItem[k].slice().sort(function () { return rand() - 0.5; });
  var n = Math.round(g.length * 0.2);
  test = test.concat(g.slice(0, n));
  train = train.concat(g.slice(n));
});

function evaluate(labelKey) {
  // the outcome model also learns from the item-agnostic lexicon (training only)
  var model = C.train(labelKey === "outcome" ? train.concat(rows.lexicon) : train, labelKey);
  var labels = Object.keys(model.classes).sort();
  var conf = {}, correct = 0, lowConf = 0, lowConfCorrect = 0;
  labels.forEach(function (a) { conf[a] = {}; labels.forEach(function (b) { conf[a][b] = 0; }); });
  test.forEach(function (r) {
    var p = C.predict(model, r.text);
    var label = p.known === 0 ? (labelKey === "item" ? "other" : p.label) : p.label;
    conf[r[labelKey]][label]++;
    if (label === r[labelKey]) correct++;
    if (p.confidence < C.CONFIDENCE_THRESHOLD) { lowConf++; if (label === r[labelKey]) lowConfCorrect++; }
  });
  var acc = correct / test.length;
  console.log("\n=== " + labelKey.toUpperCase() + " classifier ===");
  console.log("Accuracy: " + (acc * 100).toFixed(1) + "%  (" + correct + "/" + test.length + ")");
  var hi = test.length - lowConf, hiCorrect = correct - lowConfCorrect;
  console.log("Confident (>= " + C.CONFIDENCE_THRESHOLD + "): " + hiCorrect + "/" + hi +
    " correct" + (hi ? " (" + (hiCorrect / hi * 100).toFixed(1) + "%)" : "") +
    "; " + lowConf + " sent to the user to confirm");
  var w = Math.max.apply(null, labels.map(function (l) { return l.length; })) + 1;
  function pad(s, n) { s = String(s); while (s.length < n) s = " " + s; return s; }
  var ABBR = { accessible_mammography: "mammo", accessible_restroom: "restrm", adjustable_table: "table",
    other: "other", patient_lift: "lift", staff_help: "staff", step_free_entrance: "entry",
    wheelchair_scale: "scale", worked: "worked", failed: "failed" };
  var short = labels.map(function (l) { return ABBR[l] || l.slice(0, 6); });
  console.log(pad("actual \\ predicted", w) + " " + short.map(function (s) { return pad(s, 7); }).join(""));
  labels.forEach(function (a) {
    console.log(pad(a, w) + " " + labels.map(function (b) { return pad(conf[a][b], 7); }).join(""));
  });
  return acc;
}

console.log("Training sentences: " + rows.length + "  ->  train " + train.length + " / test " + test.length +
  "  (+ " + rows.lexicon.length + " outcome-lexicon phrases, training only)");
evaluate("item");
evaluate("outcome");

// Leave-one-out over every sentence: steadier than one 20% split on a small dataset.
function leaveOneOut(labelKey) {
  var correct = 0;
  rows.forEach(function (r, i) {
    var tr = rows.filter(function (_, j) { return j !== i; });
    if (labelKey === "outcome") tr = tr.concat(rows.lexicon);
    var p = C.predict(C.train(tr, labelKey), r.text);
    var label = p.known === 0 && labelKey === "item" ? "other" : p.label;
    if (label === r[labelKey]) correct++;
  });
  return (correct / rows.length * 100).toFixed(1) + "%";
}
console.log("\nLeave-one-out (" + rows.length + " sentences): item " + leaveOneOut("item") +
  ", outcome " + leaveOneOut("outcome"));
