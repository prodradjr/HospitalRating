(function () {
  "use strict";

  var ALL_ITEMS = window.ALL_ITEMS, LABELS = window.ITEM_LABELS, ICONS = window.ITEM_ICONS;
  var TYPES = window.PLACE_TYPES, SPECIALTIES = window.SPECIALTIES, itemsFor = window.itemsFor;
  var C = window.Classifier;
  var LS = { needs: "hr_needs", reviews: "hr_reviews", corrections: "hr_corrections", size: "hr_size", list: "hr_list" };

  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pct(x) { return Math.round(x * 100) + "%"; }

  // ---------- state ----------
  var needs = load(LS.needs, null);           // null = not chosen yet
  var userReviews = load(LS.reviews, []);     // {id, clinicId, text, stars, overrides:{idx:{item,outcome}}}
  var corrections = load(LS.corrections, []); // user-confirmed sentences, fed back into training
  var models;

  function retrain() {
    models = C.buildModels(window.TRAINING.concat(corrections), window.OUTCOME_LEXICON);
  }
  retrain();

  var seedReviews = window.SEED_REVIEWS.map(function (r, i) {
    return { id: "seed-" + i, clinicId: r.clinicId, text: r.text, stars: r.stars, demo: true, overrides: {} };
  });
  function allReviews() { return seedReviews.concat(userReviews); }

  // Run the ML on a review, then apply anything the user confirmed/corrected.
  function analyzeReview(r) {
    return C.analyze(models, r.text).map(function (res, i) {
      var o = r.overrides && r.overrides[i];
      if (o) {
        if (o.item) { res.item = o.item; res.itemConf = 1; res.confirmed = true; }
        if (o.outcome) { res.outcome = o.outcome; res.outcomeConf = 1; res.confirmed = true; }
      }
      return res;
    });
  }

  // Per-item patient evidence for one place. One vote per review per item
  // (a review that mentions a failure counts as failed).
  function evidence(place) {
    var ev = {};
    itemsFor(place).forEach(function (k) { ev[k] = { worked: 0, failed: 0, quotes: [] }; });
    allReviews().forEach(function (r) {
      if (r.clinicId !== place.id) return;
      var perItem = {};
      analyzeReview(r).forEach(function (res) {
        if (res.item === "other" || !ev[res.item]) return;
        // never publish a guess: unsure sentences count only once a person confirms them
        if (!res.confirmed && res.itemConf < C.CONFIDENCE_THRESHOLD) return;
        if (perItem[res.item] !== "failed") perItem[res.item] = res.outcome;
        ev[res.item].quotes.push({ text: res.sentence, outcome: res.outcome, demo: r.demo });
      });
      Object.keys(perItem).forEach(function (k) { ev[k][perItem[k]]++; });
    });
    return ev;
  }

  // Compare the place's claim with what patients say.
  function compare(claim, e, noun) {
    var total = e.worked + e.failed;
    var patients = total === 0 ? "none" : (e.worked >= e.failed ? "worked" : "failed");
    var mismatch = null;
    if (claim.status === "available" && e.failed > 0)
      mismatch = noun + " says it's available, but " + e.failed + " patient" + (e.failed > 1 ? "s say" : " says") + " it failed";
    else if (claim.status === "not_available" && e.worked > 0)
      mismatch = noun + " says it's not available, but patients say it worked";
    else if (claim.status === "unknown" && e.failed > 0)
      mismatch = noun + " publishes nothing, but " + e.failed + " patient" + (e.failed > 1 ? "s report" : " reports") + " it failed";
    return { total: total, patients: patients, mismatch: mismatch };
  }

  function claimText(claim) {
    if (claim.status === "available") return '<span class="status-ok">✅ Says available</span>';
    if (claim.status === "not_available") return '<span class="status-bad">❌ Says not available</span>';
    return '<span class="status-unknown">❓ Not published</span>';
  }

  // The needs that apply at this place (all of its items if none chosen).
  function activeNeeds(place) {
    var items = itemsFor(place);
    if (!needs || !needs.length) return items;
    return needs.filter(function (k) { return items.indexOf(k) !== -1; });
  }
  function noun(place) {
    var n = TYPES[place.type].one;
    return n.charAt(0).toUpperCase() + n.slice(1);
  }

  // ---------- routing ----------
  var SCREENS = ["needs", "list", "clinic", "review"];
  function route() {
    var parts = (location.hash || "").replace(/^#/, "").split("/");
    var name = parts[0];
    if (SCREENS.indexOf(name) === -1) name = needs ? "list" : "needs";
    SCREENS.forEach(function (s) { $("screen-" + s).hidden = s !== name; });
    document.querySelectorAll("[data-nav]").forEach(function (a) {
      if (a.getAttribute("data-nav") === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (name === "needs") renderNeeds();
    if (name === "list") renderList();
    if (name === "clinic") renderClinic(parts[1]);
    if (name === "review") renderReview(parts[1]);
    var h = document.querySelector("#screen-" + name + " h1");
    if (h) h.focus();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  function clinicById(id) {
    return window.CLINICS.filter(function (c) { return c.id === id; })[0] || window.CLINICS[0];
  }

  // ---------- screen 1: needs ----------
  function renderNeeds() {
    var chosen = needs || [];
    $("needs-buttons").innerHTML = ALL_ITEMS.map(function (k) {
      var on = chosen.indexOf(k) !== -1;
      return '<button type="button" class="toggle" data-item="' + k + '" aria-pressed="' + on + '">' +
        '<span class="check" aria-hidden="true">' + (on ? "☑" : "☐") + '</span>' +
        '<span aria-hidden="true">' + ICONS[k] + '</span> ' + esc(LABELS[k]) + '</button>';
    }).join("");
  }
  $("needs-buttons").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-item]");
    if (!b) return;
    var k = b.getAttribute("data-item");
    var chosen = (needs || []).slice();
    var i = chosen.indexOf(k);
    if (i === -1) chosen.push(k); else chosen.splice(i, 1);
    needs = chosen; save(LS.needs, needs);
    var on = i === -1;
    b.setAttribute("aria-pressed", String(on));
    b.querySelector(".check").textContent = on ? "☑" : "☐";
  });
  $("needs-done").addEventListener("click", function () {
    if (!needs) { needs = []; save(LS.needs, needs); }
    location.hash = "#list";
  });

  // ---------- screen 2: list ----------
  var listState = load(LS.list, { type: "hospital", specialty: null, place: "" });

  function renderList() {
    var t = TYPES[listState.type];
    $("list-title").textContent = t.label + " near Atlanta";
    $("type-buttons").innerHTML = Object.keys(TYPES).map(function (k) {
      return '<button type="button" class="tab-btn" data-type="' + k + '" aria-pressed="' + (k === listState.type) + '">' +
        '<span aria-hidden="true">' + TYPES[k].icon + '</span> ' + esc(TYPES[k].label) + '</button>';
    }).join("");

    var showSpecs = listState.type === "specialist";
    $("specialty-group").hidden = !showSpecs;
    if (showSpecs) {
      $("specialty-buttons").innerHTML = Object.keys(SPECIALTIES).map(function (k) {
        return '<button type="button" class="toggle" data-specialty="' + k + '" aria-pressed="' + (k === listState.specialty) + '">' +
          '<span aria-hidden="true">' + SPECIALTIES[k].icon + '</span> ' + esc(SPECIALTIES[k].label) + '</button>';
      }).join("");
    }
    $("place-filter").value = listState.place;

    var picked = needs && needs.length;
    $("list-needs-summary").textContent = picked
      ? "Your needs: " + needs.map(function (k) { return LABELS[k]; }).join(", ") + "."
      : "You haven't picked specific needs, so we're checking all equipment.";

    var q = listState.place.trim().toLowerCase();
    var places = window.CLINICS.filter(function (c) {
      if (c.type !== listState.type) return false;
      if (showSpecs && listState.specialty && c.specialty !== listState.specialty) return false;
      if (q && (c.city + " " + c.zip + " " + c.address).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    var what = showSpecs && listState.specialty ? SPECIALTIES[listState.specialty].label + " clinics" : t.many;
    $("list-count").textContent = "Showing " + places.length + " " + what + (q ? " matching “" + listState.place.trim() + "”" : "") + ".";

    $("clinic-list").innerHTML = places.length ? places.map(function (c) {
      var ev = evidence(c), want = activeNeeds(c);
      var confirmed = 0, anyMismatch = false;
      want.forEach(function (k) { if (compare(c.equipment[k], ev[k], noun(c)).patients === "worked") confirmed++; });
      itemsFor(c).forEach(function (k) { if (compare(c.equipment[k], ev[k], noun(c)).mismatch) anyMismatch = true; });
      var score = want.length
        ? "Patients confirm " + confirmed + " of " + want.length + " of your needs"
        : "None of your needs apply to this kind of place";
      return '<li class="card">' +
        '<h2><a href="#clinic/' + c.id + '">' + esc(c.name) + '</a>' +
        (c.verified ? "" : '<span class="tag tag-unverified">unverified</span>') + '</h2>' +
        (c.specialty ? '<p><span class="tag tag-need"><span aria-hidden="true">' + SPECIALTIES[c.specialty].icon + '</span> ' + esc(SPECIALTIES[c.specialty].label) + '</span></p>' : "") +
        '<p>' + esc(c.address) + '</p>' +
        '<p class="score">' + score + '</p>' +
        (anyMismatch ? '<p><span class="mismatch"><span aria-hidden="true">⚠️</span> Mismatch: patients report a problem</span></p>' : "") +
        '</li>';
    }).join("") : '<li class="card"><p>No places match. Try another city or ZIP code, or clear the filter.</p></li>';
  }

  function saveList() { save(LS.list, listState); renderList(); }
  $("type-buttons").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-type]");
    if (!b) return;
    listState.type = b.getAttribute("data-type");
    if (listState.type !== "specialist") listState.specialty = null;
    saveList();
    $("type-buttons").querySelector('[data-type="' + listState.type + '"]').focus();
  });
  $("specialty-buttons").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-specialty]");
    if (!b) return;
    var k = b.getAttribute("data-specialty");
    listState.specialty = listState.specialty === k ? null : k;   // tap again = show all
    saveList();
    $("specialty-buttons").querySelector('[data-specialty="' + k + '"]').focus();
  });
  var filterTimer;
  $("place-filter").addEventListener("input", function () {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(function () {
      listState.place = $("place-filter").value;
      save(LS.list, listState);
      renderList();
    }, 250);
  });
  $("place-filter-clear").addEventListener("click", function () {
    listState.place = ""; saveList(); $("place-filter").focus();
  });

  // ---------- screen 3: place page ----------
  function renderClinic(id) {
    var c = clinicById(id);
    $("clinic-title").innerHTML = esc(c.name) + (c.verified ? "" : '<span class="tag tag-unverified">unverified</span>');
    $("clinic-back").setAttribute("href", "#list");
    $("clinic-back-label").textContent = "All " + TYPES[c.type].many;
    $("clinic-compare-title").textContent = "Equipment: what the " + TYPES[c.type].one + " says vs. what patients say";
    var dest = encodeURIComponent(c.name + ", " + c.address);
    $("clinic-info").innerHTML =
      '<p><span class="tag tag-need"><span aria-hidden="true">' + TYPES[c.type].icon + '</span> ' +
        esc(c.specialty ? SPECIALTIES[c.specialty].label : noun(c)) + '</span></p>' +
      '<p>' + esc(c.address) + '<br>Phone: ' + esc(c.phone) + '</p>' +
      (c.verified ? "" : '<p class="hint">Address and phone could not be checked automatically. Please confirm before you travel.</p>') +
      '<div class="contact">' +
      '<a class="btn btn-primary" href="tel:+1' + c.phone.replace(/\D/g, "") + '"><span aria-hidden="true">📞</span> Call ' + esc(c.phone) + '</a>' +
      '<a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=' + dest + '" target="_blank" rel="noopener">Google Maps directions<span class="visually-hidden"> (opens in new tab)</span></a>' +
      '<a class="btn" href="https://maps.apple.com/?daddr=' + dest + '" target="_blank" rel="noopener">Apple Maps directions<span class="visually-hidden"> (opens in new tab)</span></a>' +
      '<a class="btn" href="#review/' + c.id + '"><span aria-hidden="true">✍️</span> Write a review</a>' +
      '</div>';

    var ev = evidence(c);
    var want = needs && needs.length ? activeNeeds(c) : [];
    var order = want.concat(itemsFor(c).filter(function (k) { return want.indexOf(k) === -1; }));
    var rows = order.map(function (k) {
      var e = ev[k], cmp = compare(c.equipment[k], e, noun(c));
      var isNeed = needs && needs.indexOf(k) !== -1;
      var patients = cmp.total === 0
        ? '<span class="status-unknown">No reports yet</span>'
        : '<span class="' + (cmp.patients === "worked" ? "status-ok" : "status-bad") + '">' +
          (cmp.patients === "worked" ? "✅ " : "❌ ") + e.worked + ' of ' + cmp.total + ' say it worked</span>';
      var quotes = e.quotes.slice(-2).map(function (q) {
        return '<p class="quote">' + (q.outcome === "worked" ? "✅" : "❌") + ' “' + esc(q.sentence || q.text) + '”' +
          (q.demo ? ' <span class="tag tag-demo">DEMO</span>' : "") + '</p>';
      }).join("");
      return '<tr class="' + (isNeed ? "is-need " : "") + (cmp.mismatch ? "has-mismatch" : "") + '">' +
        '<th scope="row"><span aria-hidden="true">' + ICONS[k] + '</span> ' + esc(LABELS[k]) +
        (isNeed ? ' <span class="tag tag-need">Your need</span>' : "") + '</th>' +
        '<td>' + claimText(c.equipment[k]) + '</td>' +
        '<td>' + patients + quotes + '</td>' +
        '<td>' + (cmp.mismatch ? '<span class="mismatch"><span aria-hidden="true">⚠️</span> ' + esc(cmp.mismatch) + '</span>' : '<span class="status-unknown">No conflict</span>') + '</td>' +
        '</tr>';
    }).join("");
    $("clinic-table-wrap").innerHTML =
      '<div class="table-wrap"><table class="compare">' +
      '<caption class="visually-hidden">Equipment at ' + esc(c.name) + '</caption>' +
      '<thead><tr><th scope="col">Equipment</th><th scope="col">What the ' + esc(TYPES[c.type].one) + ' says</th>' +
      '<th scope="col">What patients say</th><th scope="col">Mismatch?</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';

    var revs = allReviews().filter(function (r) { return r.clinicId === c.id; });
    $("clinic-reviews").innerHTML = revs.length ? revs.map(function (r) {
      return '<li class="card"><p>“' + esc(r.text) + '”</p>' +
        (r.demo ? '<p><span class="tag tag-demo">DEMO – not a real patient</span></p>' : '<p class="hint">Your review (saved on this device)</p>') +
        '</li>';
    }).reverse().join("") : '<li class="hint">No reviews yet. Be the first.</li>';
  }

  // ---------- screen 4: write a review ----------
  var currentClinic = null, lastSaved = null;

  $("star-options").innerHTML = ['<label><input type="radio" name="stars" value="" checked> No rating</label>']
    .concat([1, 2, 3, 4, 5].map(function (n) {
      return '<label><input type="radio" name="stars" value="' + n + '"> ' + n + ' <span aria-hidden="true">★</span><span class="visually-hidden"> star' + (n > 1 ? "s" : "") + '</span></label>';
    })).join("");

  function renderReview(id) {
    var c = clinicById(id);
    if (currentClinic !== c.id) {
      $("review-text").value = ""; lastSaved = null;
      var none = document.querySelector('input[name="stars"][value=""]'); if (none) none.checked = true;
    }
    currentClinic = c.id;
    $("review-title").textContent = "Write a review: " + c.name;
    $("review-back").setAttribute("href", "#clinic/" + c.id);
    $("review-error").textContent = "";
    renderUnderstood();
  }

  function chosenStars() {
    var r = document.querySelector('input[name="stars"]:checked');
    return r && r.value ? Number(r.value) : null;
  }

  function verdictHtml(res) {
    if (res.item === "other")
      return '<p class="verdict"><span aria-hidden="true">💬</span> Not about equipment (e.g. parking, waiting, billing) – ignored ' +
        '<span class="confidence">(' + pct(res.itemConf) + ' sure)</span></p>';
    return '<p class="verdict"><span aria-hidden="true">' + ICONS[res.item] + '</span> ' + esc(LABELS[res.item]) +
      ' <span class="confidence">(' + (res.confirmed ? "confirmed by you" : pct(res.itemConf) + " sure") + ')</span></p>' +
      '<p class="verdict ' + (res.outcome === "worked" ? "status-ok" : "status-bad") + '">' +
      (res.outcome === "worked" ? "✅ Worked" : "❌ Failed") +
      ' <span class="confidence">(' + (res.confirmed ? "confirmed" : pct(res.outcomeConf) + " sure") + ')</span></p>';
  }

  function choiceButtons(idx, current) {
    return '<div class="choices" role="group" aria-label="What was this sentence about?">' +
      ALL_ITEMS.concat(["other"]).map(function (k) {
        return '<button type="button" class="choice" data-fix-item="' + k + '" data-idx="' + idx + '" aria-pressed="' + (k === current) + '">' +
          '<span aria-hidden="true">' + ICONS[k] + '</span> ' + esc(k === "other" ? "Something else" : LABELS[k]) + '</button>';
      }).join("") + '</div>';
  }

  function renderUnderstood() {
    var text = $("review-text").value;
    var saved = lastSaved && lastSaved.text === text ? lastSaved : null;
    var results = saved ? analyzeReview(saved) : C.analyze(models, text);
    $("understood-hint").textContent = saved
      ? "Saved. Tap a button below if we got something wrong – the app learns from your fix."
      : "This preview updates as you type. Submit to save it.";
    if (!results.length) { $("understood").innerHTML = '<p class="hint">Nothing yet.</p>'; return; }

    var html = results.map(function (res, i) {
      var cls = res.item === "other" ? "ignored" : res.outcome;
      var out = '<div class="result ' + cls + '"><p class="sentence">“' + esc(res.sentence) + '”</p>' + verdictHtml(res);
      if (saved) {
        var unsure = !res.confirmed && res.itemConf < C.CONFIDENCE_THRESHOLD;
        if (unsure) {
          out += '<div class="confirm-box"><p><strong><span aria-hidden="true">🤔</span> We\'re not sure. What was this about?</strong></p>' +
            choiceButtons(i, res.item) + '</div>';
        } else {
          out += '<details><summary class="btn btn-small">Wrong? Fix it</summary>' + choiceButtons(i, res.item) + '</details>';
        }
        if (res.item !== "other") {
          var flip = res.outcome === "worked" ? "failed" : "worked";
          out += '<div class="row"><button type="button" class="btn btn-small" data-fix-outcome="' + flip + '" data-idx="' + i + '">' +
            'Actually it ' + (flip === "worked" ? "✅ worked" : "❌ failed") + '</button></div>';
        }
      }
      return out + '</div>';
    }).join("");

    // Stars vs text: show the disagreement, never use stars for results.
    var stars = saved ? saved.stars : chosenStars();
    var eq = results.filter(function (r) { return r.item !== "other"; });
    if (stars && eq.length) {
      var good = eq.filter(function (r) { return r.outcome === "worked"; }).length;
      if (stars <= 2 && good > eq.length / 2)
        html = '<p class="stars-note"><span aria-hidden="true">⭐</span> Rated ' + stars + '★ but positive about the equipment. That\'s why we read the words, not the stars.</p>' + html;
      else if (stars >= 4 && good < eq.length / 2)
        html = '<p class="stars-note"><span aria-hidden="true">⭐</span> Rated ' + stars + '★ but reported equipment problems. That\'s why we read the words, not the stars.</p>' + html;
    }
    $("understood").innerHTML = html;
  }

  var typingTimer;
  $("review-text").addEventListener("input", function () {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(renderUnderstood, 250);
  });
  $("star-options").addEventListener("change", renderUnderstood);

  function announce(msg) {
    $("announcer").textContent = "";
    setTimeout(function () { $("announcer").textContent = msg; }, 50);
  }

  function summarize(results) {
    var eq = results.filter(function (r) { return r.item !== "other"; });
    if (!eq.length) return "We didn't find anything about equipment.";
    return "We understood " + eq.length + " equipment point" + (eq.length > 1 ? "s" : "") + ": " +
      eq.map(function (r) { return LABELS[r.item] + " " + r.outcome; }).join("; ") + ".";
  }

  $("review-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var text = $("review-text").value.trim();
    if (!text) { $("review-error").textContent = "Please describe your visit first."; $("review-text").focus(); return; }
    $("review-error").textContent = "";
    var r = { id: "u-" + Date.now(), clinicId: currentClinic, text: text, stars: chosenStars(), overrides: {} };
    userReviews.push(r); save(LS.reviews, userReviews);
    $("review-text").value = text;
    lastSaved = r;
    renderUnderstood();
    var results = analyzeReview(r);
    var unsure = results.filter(function (x) { return x.itemConf < C.CONFIDENCE_THRESHOLD; }).length;
    announce("Review saved. " + summarize(results) + (unsure ? " " + unsure + " sentence" + (unsure > 1 ? "s need" : " needs") + " your confirmation." : ""));
    $("understood-title").scrollIntoView();
  });

  // One-tap corrections. Saved on the review AND added to training data.
  $("understood").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-idx]");
    if (!b || !lastSaved) return;
    var idx = Number(b.getAttribute("data-idx"));
    var results = analyzeReview(lastSaved);
    var res = results[idx];
    var o = lastSaved.overrides[idx] || {};
    if (b.hasAttribute("data-fix-item")) { o.item = b.getAttribute("data-fix-item"); o.outcome = o.outcome || res.outcome; }
    if (b.hasAttribute("data-fix-outcome")) { o.outcome = b.getAttribute("data-fix-outcome"); o.item = o.item || res.item; }
    lastSaved.overrides[idx] = o;
    corrections.push({ text: res.sentence, item: o.item, outcome: o.outcome });
    save(LS.corrections, corrections);
    save(LS.reviews, userReviews);
    retrain();
    renderUnderstood();
    announce("Thanks. Saved as " + (o.item === "other" ? "not about equipment" : LABELS[o.item] + ", " + o.outcome) +
      ". The app has learned from this.");
    var next = $("understood").querySelector('[data-idx="' + idx + '"]');
    if (next) next.focus();
  });

  // ---------- mic (Web Speech API) ----------
  // Speech recognition only works in Chrome/Edge/Safari, on https:// or
  // http://localhost, and (Chrome) needs internet: audio goes to Google's servers.
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var VOICE_ERRORS = {
    "not-allowed": "Microphone blocked. Click the lock icon in the address bar and allow the microphone.",
    "service-not-allowed": "Microphone blocked. Click the lock icon in the address bar and allow the microphone.",
    "network": "Voice needs an internet connection.",
    "no-speech": "I didn't hear anything. Try again.",
    "audio-capture": "No microphone found. Plug one in, or type instead."
  };
  var UNSUPPORTED_MSG = "Voice works in Chrome or Edge. You can type instead.";

  function browserName() {
    var ua = navigator.userAgent;
    if (/Electron|Code\//.test(ua)) return "VS Code / Electron built-in browser";
    if (/Edg\//.test(ua)) return "Edge";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/Chrome\//.test(ua)) return "Chrome";
    if (/Safari\//.test(ua)) return "Safari";
    return "Unknown";
  }

  var voiceDiag = {
    browser: browserName(),
    protocol: location.protocol,
    isSecureContext: window.isSecureContext,
    SpeechRecognition: !!window.SpeechRecognition,
    webkitSpeechRecognition: !!window.webkitSpeechRecognition,
    online: navigator.onLine
  };
  console.info("[voice] diagnostics", voiceDiag);
  $("voice-diag-list").innerHTML = Object.keys(voiceDiag).map(function (k) {
    return "<li><strong>" + esc(k) + ":</strong> " + esc(voiceDiag[k]) + "</li>";
  }).join("");

  function voiceStatus(kind, msg) {
    var el = $("voice-status");
    var icon = { listening: "🎙️", error: "⚠️", info: "ℹ️", done: "✅" }[kind] || "";
    el.hidden = !msg;
    el.className = "voice-status voice-" + kind;
    el.innerHTML = msg ? '<span aria-hidden="true">' + icon + "</span> " + esc(msg) : "";
  }

  var mic = $("mic-btn");
  if (!SR) {
    mic.hidden = true;
    voiceStatus("info", UNSUPPORTED_MSG);
  } else if (!window.isSecureContext || location.protocol === "file:") {
    // Chrome can't keep mic permission for file:// pages, and http:// on a
    // non-localhost host is blocked outright.
    mic.hidden = true;
    voiceStatus("info", "Voice needs a secure page: open http://localhost:8000 (run serve.sh) or an https:// address, not a file. You can type instead.");
  } else {
    var rec = null, base = "", lastError = null;
    mic.hidden = false;
    if (voiceDiag.browser.indexOf("VS Code") === 0)
      voiceStatus("info", "VS Code's built-in browser usually can't do voice. Open this page in Chrome or Edge for voice.");

    function setListening(on) {
      mic.setAttribute("aria-pressed", String(on));
      mic.classList.toggle("listening", on);
      $("mic-icon").textContent = on ? "⏹️" : "🎤";
      $("mic-label").textContent = on ? "Listening… tap to stop" : "Speak instead";
    }

    mic.addEventListener("click", function () {
      if (rec) { rec.stop(); return; }
      rec = new SR();
      rec.lang = "en-US"; rec.interimResults = true; rec.continuous = true;
      lastError = null;
      base = $("review-text").value ? $("review-text").value.replace(/\s*$/, " ") : "";
      rec.onstart = function () {
        setListening(true);
        voiceStatus("listening", "Listening… speak now. Your words appear in the box above.");
        announce("Listening. Speak now.");
      };
      rec.onresult = function (ev) {
        var t = "";
        for (var i = 0; i < ev.results.length; i++) {
          var piece = ev.results[i][0].transcript.trim();
          if (piece) t += piece.charAt(0).toUpperCase() + piece.slice(1) + (ev.results[i].isFinal ? ". " : " ");
        }
        $("review-text").value = base + t;
        renderUnderstood();
      };
      rec.onerror = function (ev) {
        lastError = ev.error;
        console.warn("[voice] error:", ev.error, ev.message || "");
        if (ev.error === "aborted") return;
        var msg = VOICE_ERRORS[ev.error] || ("Voice problem (" + ev.error + "). You can type instead.");
        voiceStatus("error", msg);
        announce(msg);
      };
      rec.onend = function () {
        rec = null;
        setListening(false);
        if (!lastError || lastError === "aborted") {
          voiceStatus("done", "Done listening. Check and edit the text, then press Submit review.");
          announce("Stopped listening. You can edit the text before submitting.");
        }
        $("review-text").focus();
      };
      try {
        rec.start();
      } catch (err) {
        console.warn("[voice] start failed:", err);
        rec = null;
        setListening(false);
        voiceStatus("error", "Couldn't start the microphone. Reload the page and try again, or type instead.");
      }
    });
  }

  // ---------- text size ----------
  function setSize(n) {
    document.documentElement.classList.remove("size-1", "size-2");
    if (n > 0) document.documentElement.classList.add("size-" + n);
    document.querySelectorAll("[data-size]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-size")) === n));
    });
    save(LS.size, n);
  }
  document.querySelectorAll("[data-size]").forEach(function (b) {
    b.addEventListener("click", function () { setSize(Number(b.getAttribute("data-size"))); });
  });
  setSize(load(LS.size, 0));

  $("reset-btn").addEventListener("click", function () {
    if (!confirm("Delete your reviews, corrections and needs from this device?")) return;
    Object.keys(LS).forEach(function (k) { if (k !== "size") localStorage.removeItem(LS[k]); });
    needs = null; userReviews = []; corrections = []; lastSaved = null; currentClinic = null;
    $("review-text").value = "";
    retrain();
    location.hash = "#needs";
    route();
  });

  route();
})();
