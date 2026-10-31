// Multinomial Naive Bayes, written from scratch.
// Runs in the browser (window.Classifier) and in Node (module.exports).
(function (root) {
  // Negations ("no", "not", "didnt"...) are deliberately NOT stopwords:
  // they carry most of the worked/failed signal.
  var STOPWORDS = {};
  ("a an the and or of to in on at for with my me i im i'm it its is was were be been " +
   "am are this that these those so just very really there their they them we our you your " +
   "he she his her him from by as had has have do did does got get also then than when while " +
   "about into out up over all some any one which who what where how")
    .split(" ").forEach(function (w) { STOPWORDS[w] = true; });
  var NEGATIONS = {};
  "no not never nobody nothing none cant cannot couldnt didnt doesnt dont wasnt werent isnt wont without refused"
    .split(" ").forEach(function (w) { NEGATIONS[w] = true; });

  function tokenize(text) {
    var words = String(text).toLowerCase()
      .replace(/[’']/g, "")            // didn't -> didnt
      .replace(/[^a-z0-9\s]/g, " ")
      // "no problem", "no stairs" are GOOD news: stop them triggering negation
      .replace(/\b(no|without|not any|never had any)\s+(problems?|issues?|trouble|hassle|stairs|steps?|wait)\b/g, " goodnews_$2 ")
      .replace(/\bout of order\b/g, " outoforder ")
      .split(/\s+/)
      .filter(function (w) { return w && !STOPWORDS[w]; });
    // negation marking: "couldnt lower" -> also emits "NOT_lower"
    var feats = words.slice();
    for (var j = 0; j < words.length; j++) {
      if (NEGATIONS[words[j]]) {
        for (var k = j + 1; k < Math.min(j + 3, words.length); k++) feats.push("NOT_" + words[k]);
        feats.push("HAS_NEGATION");
      }
    }
    for (var i = 0; i < words.length - 1; i++) feats.push(words[i] + "_" + words[i + 1]);
    // concept tokens: spelling variants share one feature ("mamogram", "mammo" -> C_MAMMO)
    words.forEach(function (w) {
      for (var c = 0; c < CONCEPTS.length; c++) if (CONCEPTS[c][0].test(w)) feats.push(CONCEPTS[c][1]);
    });
    return feats;
  }

  var CONCEPTS = [
    [/^(mam+o|breast)/, "C_MAMMO"],
    [/^(weigh|scale)/, "C_WEIGH"],
    [/^(restroom|bathro+m|toilet|washroom|lavatory)/, "C_RESTROOM"],
    [/^(hoyer|hoist|lift|sling)/, "C_LIFT"],
    [/^(ramp|entrance|enterance|entry|doors?$|elevator|stairs?$|steps?$)/, "C_ENTRY"],
    [/^(table|tabel|bed$|exam)/, "C_TABLE"],
    [/^(nurse|staff|doctor|aide|tech$|receptionist|interpreter|help)/, "C_STAFF"],
    [/^(parking|park$|valet|bill|insurance|copay|wait|food|cafeteria|coffee|wifi|appointment)/, "C_OTHER"]
  ];

  function train(rows, labelKey) {
    var m = { classes: {}, vocab: {}, vocabSize: 0, total: 0 };
    rows.forEach(function (r) {
      var c = r[labelKey];
      if (!m.classes[c]) m.classes[c] = { docs: 0, words: 0, counts: {} };
      var cl = m.classes[c];
      cl.docs++; m.total++;
      tokenize(r.text).forEach(function (f) {
        cl.counts[f] = (cl.counts[f] || 0) + 1;
        cl.words++;
        if (!m.vocab[f]) { m.vocab[f] = true; m.vocabSize++; }
      });
    });
    return m;
  }

  function predict(m, text) {
    var feats = tokenize(text).filter(function (f) { return m.vocab[f]; });
    var logs = {}, best = null;
    Object.keys(m.classes).forEach(function (c) {
      var cl = m.classes[c];
      var lp = Math.log(cl.docs / m.total);
      var denom = cl.words + m.vocabSize;           // Laplace smoothing (alpha = 1)
      feats.forEach(function (f) { lp += Math.log(((cl.counts[f] || 0) + 1) / denom); });
      logs[c] = lp;
      if (best === null || lp > logs[best]) best = c;
    });
    // softmax over log-probabilities -> posterior confidence
    var maxL = logs[best], sum = 0, probs = {};
    Object.keys(logs).forEach(function (c) { sum += Math.exp(logs[c] - maxL); });
    Object.keys(logs).forEach(function (c) { probs[c] = Math.exp(logs[c] - maxL) / sum; });
    return { label: best, confidence: probs[best], probs: probs, known: feats.length };
  }

  // Split on sentence punctuation and on contrast words ("but", "however"),
  // because patients often write one run-on sentence about several things.
  function splitSentences(text) {
    return String(text)
      .split(/[.!?;\n]+|,?\s+\bbut\b\s+|,?\s+\bhowever\b\s+|,?\s+\bthough\b\s+|,?\s+\balthough\b\s+/i)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.replace(/[^a-z]/gi, "").length > 2; });
  }

  function buildModels(rows, lexicon) {
    return { item: train(rows, "item"), outcome: train(rows.concat(lexicon || []), "outcome") };
  }

  function analyze(models, text) {
    return splitSentences(text).map(function (s) {
      var it = predict(models.item, s);
      var oc = predict(models.outcome, s);
      // nothing recognisable -> treat as "other" with zero confidence
      if (it.known === 0) it = { label: "other", confidence: 0 };
      return {
        sentence: s,
        item: it.label, itemConf: it.confidence,
        outcome: oc.label, outcomeConf: oc.confidence
      };
    });
  }

  var api = { tokenize: tokenize, train: train, predict: predict,
    splitSentences: splitSentences, buildModels: buildModels, analyze: analyze,
    CONFIDENCE_THRESHOLD: 0.6 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Classifier = api;
})(this);
