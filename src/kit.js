/* Shared kit: storage, MathML helpers, spaced decks, practice records, shared database sync, report, tabs.
   Usage in a page script:
     Kit.init({ prefix, items, ... });   // 1. config (see init below)
     ... build decks with Kit.deck(), build the page ...
     Kit.start();                        // 2. wires tabs, shows the first view, connects the shared record
*/
var Kit = (function () {
  'use strict';
  var C = null, P = 'kit', view = '', VIEWS = [];

  function $(id) { return document.getElementById(id); }
  function load(k, d) { try { var s = localStorage.getItem(P + '.' + k); return s == null ? d : JSON.parse(s); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(P + '.' + k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* MathML. math(inner) is display style (full-size fractions); math(inner, true) is inline. */
  function math(inner, inline) { return '<math' + (inline ? '' : ' displaystyle="true"') + '>' + inner + '</math>'; }
  var M = {
    n: function (s) { return '<mn>' + s + '</mn>'; },
    i: function (s) { return '<mi>' + s + '</mi>'; },          /* variable or function name: x, θ, π, sin */
    o: function (s) { return '<mo>' + s + '</mo>'; },          /* operator: + − = ± ( ) */
    t: function (s) { return '<mtext>' + s + '</mtext>'; },
    row: function (a) { return '<mrow>' + a + '</mrow>'; },
    frac: function (a, b) { return '<mfrac><mrow>' + a + '</mrow><mrow>' + b + '</mrow></mfrac>'; },
    sqrt: function (a) { return '<msqrt>' + a + '</msqrt>'; },
    sup: function (a, b) { return '<msup><mrow>' + a + '</mrow><mrow>' + b + '</mrow></msup>'; },
    sp: '<mspace width="0.3em"></mspace>',
    fn: function (name, arg) { return '<mi>' + name + '</mi><mspace width="0.25em"></mspace>' + arg; }   /* sin x */
  };

  /*PURE-START*/
  function fmt(ms) {
    var t = Math.floor(ms / 100), m = Math.floor(t / 600), s = Math.floor((t % 600) / 10), d = t % 10;
    return m + ':' + (s < 10 ? '0' : '') + s + '.' + d;
  }
  function num(x) { return (typeof x === 'number' && isFinite(x) && x > 0) ? x : 0; }
  /* msOut(d): the day's time on right answers, scaled so untimed right answers (plots) do not pull the average down. */
  function msOut(d) { var c = num(d.correct), t = c - num(d.untimed); return t > 0 ? Math.round(num(d.msCorrect) * c / t) : 0; }
  function dayNum(s) { var p = s.split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000); }
  function fmtDate(s) {
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function secs(ms) { return (ms / 1000).toFixed(1) + ' s'; }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function listOf(items, max) {
    var shown = items.slice(0, max).join(', ');
    return items.length > max ? shown + ', and ' + (items.length - max) + ' more' : shown;
  }

  /* Turns saved day records into the report. cfg: { items:[{key,name,group}], slowMs, planDays, planMinutes, test } */
  function summarize(docs, todayStr, cfg) {
    var items = cfg.items || [], t0 = dayNum(todayStr), byDate = {}, per = {}, latest = null, T = cfg.test || null;
    var pass = T ? (T.passScore || T.total) : 0, bestMs = null, bestScore = null;
    items.forEach(function (it) { per[it.key] = { n: 0, n7: 0, w7: 0, ok7: 0, ms7: 0, st: 'none', avg: 0 }; });

    docs.forEach(function (d) {
      if (!d || typeof d.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return;
      var age = Math.max(0, t0 - dayNum(d.date));
      var day = byDate[d.date] || (byDate[d.date] = { date: d.date, age: age, answered: 0, correct: 0, msCorrect: 0, activeMs: 0, tests: [] });
      day.answered += num(d.answered); day.correct += num(d.correct);
      day.msCorrect += msOut(d); day.activeMs += num(d.activeMs);
      (Array.isArray(d.tests) ? d.tests : []).forEach(function (t) {
        if (!t) return;
        var total = num(t.t), s = Math.min(num(t.s), total), ms = num(t.ms);
        if (!total) return;
        day.tests.push({ s: s, t: total, ms: ms });
        if (bestScore === null || s > bestScore) bestScore = s;
        if (s >= pass && ms && (bestMs === null || ms < bestMs)) bestMs = ms;
      });
      var rec = (d.items && typeof d.items === 'object') ? d.items : {};
      items.forEach(function (it) {
        var a = rec[it.key];
        if (!Array.isArray(a)) return;
        var n = num(a[0]), w = Math.min(num(a[1]), n), p = per[it.key];
        p.n += n;
        if (age < 7) { p.n7 += n; p.w7 += w; p.ok7 += n - w; p.ms7 += num(a[2]); }
      });
      if (typeof d.last === 'string' && (!latest || d.last > latest.last)) latest = d;
    });

    var log = Object.keys(byDate).sort().reverse().map(function (k) { return byDate[k]; })
      .filter(function (d) { return d.answered > 0 || d.tests.length > 0; });
    var out = { empty: !log.length, days7: 0, ms7: 0, done: latest ? num(latest.done) : 0, total: latest ? num(latest.total) : 0,
      bestMs: bestMs, bestScore: bestScore, flags: [], per: per, log: log.slice(0, 14) };
    if (out.empty) return out;

    var tests7 = 0, lastTest = null, firstAge = 0, lastAge = log[0].age;
    log.forEach(function (d) {
      if (d.age > firstAge) firstAge = d.age;
      if (d.age < 7) { out.days7++; out.ms7 += d.activeMs; tests7 += d.tests.length; }
      if (!lastTest && d.tests.length) lastTest = d.tests[d.tests.length - 1];
    });
    var F = out.flags, planDays = cfg.planDays || 5, planMin = cfg.planMinutes || 5;

    /* Usage */
    if (lastAge >= 3) F.push({ lv: 'bad', text: 'No practice for ' + lastAge + ' days. The last session was ' + fmtDate(log[0].date) + '.' });
    else if (out.days7 >= planDays) F.push({ lv: 'ok', text: out.days7 + ' practice days in the last 7. That is on plan.' });
    else if (firstAge >= 6) F.push({ lv: 'warn', text: out.days7 + ' practice ' + (out.days7 === 1 ? 'day' : 'days') + ' in the last 7. The plan calls for ' + planDays + '.' });

    /* Time */
    var perDay = out.days7 ? out.ms7 / out.days7 : 0;
    if (out.days7 && perDay < planMin * 48000) {
      var mins = Math.round(perDay / 60000);
      F.push({ lv: 'warn', text: 'Sessions are short: ' + (mins < 1 ? 'under a minute' : 'about ' + mins + ' min') + ' on practice days. The plan calls for ' + planMin + ' minutes a day here.' });
    }

    /* Weak items, last 7 days */
    var missed = [], slow = [], untested = [];
    items.forEach(function (it) {
      var p = per[it.key];
      if (p.n === 0) untested.push(it);
      if (p.n7 === 0) return;
      p.avg = p.ok7 ? p.ms7 / p.ok7 : 0;
      if (p.w7 / p.n7 >= 0.25) { p.st = 'miss'; if (p.n7 >= 2) missed.push(it); }
      else if (cfg.slowMs && p.avg > cfg.slowMs) { p.st = 'slow'; if (p.ok7 >= 2) slow.push(it); }
      else p.st = 'ok';
    });
    missed.sort(function (x, y) { return per[y.key].w7 / per[y.key].n7 - per[x.key].w7 / per[x.key].n7; });
    slow.sort(function (x, y) { return per[y.key].avg - per[x.key].avg; });
    if (missed.length) F.push({ lv: 'bad', text: 'Missed most: ' + listOf(missed.map(function (it) { return it.name + ' (' + per[it.key].w7 + ' of ' + per[it.key].n7 + ' wrong)'; }), 5) + '.' });
    if (slow.length) F.push({ lv: 'warn', text: 'Right but slow: ' + listOf(slow.map(function (it) { return it.name + ' (' + secs(per[it.key].avg) + ')'; }), 5) + '. The target is under ' + (cfg.slowMs / 1000) + ' seconds.' });

    /* One group weaker than the others */
    var gmap = {}, groups = [];
    items.forEach(function (it) {
      var g = it.group || '';
      if (!g) return;
      if (!gmap[g]) { gmap[g] = { g: g, n: 0, w: 0 }; groups.push(gmap[g]); }
      gmap[g].n += per[it.key].n7; gmap[g].w += per[it.key].w7;
    });
    groups = groups.filter(function (x) { return x.n >= 6; });
    groups.forEach(function (x) { x.acc = 1 - x.w / x.n; });
    if (groups.length >= 2) {
      groups.sort(function (x, y) { return x.acc - y.acc; });
      var lo = groups[0], hi = groups[groups.length - 1];
      if (hi.acc - lo.acc >= 0.15) F.push({ lv: 'warn', text: 'Weakest area: ' + lo.g + ', at ' + pct(lo.acc) + ' right. The strongest is ' + hi.g + ', at ' + pct(hi.acc) + '.' });
    }
    if (untested.length) F.push({ lv: 'warn', text: 'Not practiced yet: ' + listOf(untested.map(function (it) { return it.name; }), 6) + '.' });

    /* Timed or scored test */
    if (T) {
      if (!tests7) F.push({ lv: 'warn', text: 'No ' + T.name + ' in the last 7 days.' });
      else if (bestScore === null || bestScore < pass) F.push({ lv: 'warn', text: 'No passing ' + T.name + ' yet (needs ' + pass + ' of ' + T.total + '). The latest was ' + lastTest.s + ' of ' + lastTest.t + '.' });
      else if (T.goalMs && bestMs !== null && bestMs >= T.goalMs) F.push({ lv: 'warn', text: 'The best passing ' + T.name + ' took ' + fmt(bestMs) + '. The goal is under ' + fmt(T.goalMs).replace(/\.\d$/, '') + '.' });
      else F.push({ lv: 'ok', text: 'The ' + T.name + ' goal is met' + (bestMs ? ', best time ' + fmt(bestMs) : '') + '.' });
    }
    if (out.total && out.done >= out.total) F.push({ lv: 'ok', text: 'Everything here is at the top level (' + out.done + ' of ' + out.total + ').' });
    return out;
  }
  /*PURE-END*/

  /* ---------- Spaced deck: levels 0..3 per card, misses come back two cards later ---------- */
  function deck(o) {
    var key = 'deck.' + o.id, n = o.n, fast = o.fastMs === undefined ? 3000 : o.fastMs;
    var lv = load(key, null), st = { last: -1, count: 0, queue: [] };
    if (!Array.isArray(lv) || lv.length !== n) lv = [];
    for (var i = 0; i < n; i++) lv[i] = (lv[i] === 1 || lv[i] === 2 || lv[i] === 3) ? lv[i] : 0;
    function queued(c) { for (var q = 0; q < st.queue.length; q++) if (st.queue[q].c === c) return true; return false; }
    return {
      levels: lv,
      /* next(filter, all): index of the next card; filter(i) optionally limits the pool */
      /* all = true: any queued miss counts as due now (used when a whole round is dealt at once) */
      next: function (filter, all) {
        var okf = function (c) { return !filter || filter(c); };
        for (var q = 0; q < st.queue.length; q++) {
          var it = st.queue[q];
          if ((all || (it.due <= st.count && it.c !== st.last)) && okf(it.c)) return st.queue.splice(q, 1)[0].c;
        }
        var w = [8, 4, 2, 1], pool = [], total = 0, c;
        for (c = 0; c < n; c++) { if (c === st.last || queued(c) || !okf(c)) continue; total += w[lv[c]]; pool.push([c, total]); }
        if (!pool.length) { for (c = 0; c < n; c++) if (okf(c) && c !== st.last) pool.push([c, ++total]); }
        if (!pool.length) { for (c = 0; c < n; c++) if (okf(c)) pool.push([c, ++total]); }
        if (!pool.length) return 0;
        var r = Math.random() * total;
        for (var j = 0; j < pool.length; j++) if (r < pool[j][1]) return pool[j][0];
        return pool[pool.length - 1][0];
      },
      /* mark(i, ok, dtMs): returns the card's new level. Level 3 needs a right answer faster than fastMs. */
      mark: function (c, ok, dt) {
        st.count++; st.last = c;
        if (ok) { var nb = Math.min(lv[c] + 1, 3); if (nb === 3 && fast && dt > fast) nb = 2; lv[c] = nb; }
        else { lv[c] = 0; st.queue = st.queue.filter(function (x) { return x.c !== c; }); st.queue.push({ c: c, due: st.count + 2 }); }
        save(key, lv);
        return lv[c];
      },
      auto: function () { var a = 0; for (var c = 0; c < n; c++) if (lv[c] === 3) a++; return a; },
      reset: function () { for (var c = 0; c < n; c++) lv[c] = 0; st.queue = []; st.last = -1; save(key, lv); }
    };
  }

  /* ---------- Practice records (local first, then synced) ---------- */
  var DEV = '', days = {}, dirty = {}, norec = false, lastAct = Date.now();
  function todayStr() {
    var d = new Date(), m = d.getMonth() + 1, x = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (x < 10 ? '0' : '') + x;
  }
  function dayDoc() {
    var k = todayStr(), d = days[k];
    if (!d || typeof d !== 'object' || d.date !== k) {
      d = days[k] = { v: 2, date: k, device: DEV, answered: 0, correct: 0, msCorrect: 0, activeMs: 0, items: {}, tests: [], first: new Date().toISOString() };
      var keys = Object.keys(days).sort();
      while (keys.length > 90) { var old = keys.shift(); delete days[old]; delete dirty[old]; }
    }
    if (!d.items || typeof d.items !== 'object') d.items = {};
    if (!Array.isArray(d.tests)) d.tests = [];
    return d;
  }
  function stamp(d, addMs) {
    d.activeMs = num(d.activeMs) + Math.round(addMs);
    d.last = new Date().toISOString();
    if (C.mastery) { try { var m = C.mastery(); d.done = num(m.done); d.total = num(m.total); } catch (e) {} }
    lastAct = Date.now();
    dirty[d.date] = 1;
    save('days', days); save('dirty', dirty);
    scheduleSync();
    paintSend();
    autoSoon(15000);
  }

  /* ---------- Finish session: a real link that carries this device's unsent days to the practice log ----------
     Used only where the shared record cannot save (a visitor on an open link). The link holds counts and times, no names. */
  var SEND_URL = '__SEND_URL__', sent = {};
  function sendReady() { return /^https:\/\/script\.google\.com\/|^http:\/\/127\.0\.0\.1:/.test(SEND_URL); }
  function sendOn() { return sendReady() && (dbState === 'off' || dbState === 'readonly'); }
  function hasWork(d) { return !!d && typeof d.last === 'string' && (num(d.answered) > 0 || (Array.isArray(d.tests) && d.tests.length > 0)); }
  /* encodeDay: one day record -> { x: compact numbers, m: "missed most" text, s: "right but slow" text } */
  function encodeDay(d, items, slowMs, maxItems) {
    var names = {}, list = [], missed = [], slow = [];
    (items || []).forEach(function (it) { names[it.key] = it.name; });
    Object.keys(d.items || {}).forEach(function (k) {
      var a = d.items[k];
      if (!Array.isArray(a) || !/^[A-Za-z0-9_]{1,40}$/.test(k)) return;
      var n = num(a[0]), w = Math.min(num(a[1]), n), ms = Math.round(num(a[2])), ok = n - w, name = names[k] || k;
      if (!n) return;
      list.push({ k: k, n: n, w: w, ms: ms });
      if (n >= 2 && w / n >= 0.25) missed.push([w / n, name + ' ' + w + '/' + n]);
      else if (slowMs && ok >= 2 && ms / ok > slowMs) slow.push([ms / ok, name + ' ' + (ms / ok / 1000).toFixed(1) + 's']);
    });
    list.sort(function (x, y) { return y.w - x.w || y.n - x.n; });
    function top(arr) { return arr.sort(function (x, y) { return y[0] - x[0]; }).slice(0, 4).map(function (x) { return x[1]; }).join(', '); }
    var tests = (Array.isArray(d.tests) ? d.tests : []).slice(-10).map(function (t) { return num(t.s) + '.' + num(t.t) + '.' + Math.round(num(t.ms)); }).join('*');
    var x = [String(d.date).replace(/-/g, ''), num(d.answered), num(d.correct), msOut(d), Math.round(num(d.activeMs)), num(d.done), num(d.total), tests,
      list.slice(0, maxItems).map(function (i) { return i.k + '.' + i.n + '.' + i.w + '.' + i.ms; }).join('*')].join('~');
    return { x: x, m: top(missed), s: top(slow) };
  }
  /* sendPlan: which days go in the link (today, plus up to two unsent earlier days), kept under a safe link length */
  function sendPlan() {
    var keys = Object.keys(days).filter(function (k) { return hasWork(days[k]); }).sort().reverse(), today = todayStr();
    var unsent = keys.filter(function (k) { return sent[k] !== days[k].last; });
    var pick = keys.filter(function (k) { return k === today || sent[k] !== days[k].last; }).slice(0, 3);
    var url = SEND_URL + '?v=1&p=' + encodeURIComponent(document.title || 'Practice page') + '&d=' + DEV, used = [];
    pick.forEach(function (k, i) {
      var cap = 60, part = '', n = i + 1;
      do {
        var e = encodeDay(days[k], C.items, C.slowMs, cap);
        part = '&x' + n + '=' + encodeURIComponent(e.x) + '&m' + n + '=' + encodeURIComponent(e.m) + '&s' + n + '=' + encodeURIComponent(e.s);
        cap -= 10;
      } while (url.length + part.length > 1900 && cap >= 0);
      if (url.length + part.length > 1900) return;
      url += part; used.push(k);
    });
    return { url: url, used: used, unsent: unsent };
  }
  function paintSend() {
    var bar = $('kit-send');
    if (!bar) return;
    if (!sendOn() || autoOn()) { bar.hidden = true; return; }
    var plan = sendPlan(), link = $('kit-send-link'), msg = $('kit-send-msg');
    if (!plan.used.length) { bar.hidden = true; return; }
    bar.hidden = false;
    link.href = plan.url;
    if (plan.unsent.length) {
      msg.textContent = plan.unsent.length === 1 ? 'This practice is not sent yet. Tap Finish session when you are done.' : 'Practice from ' + plan.unsent.length + ' days is not sent yet.';
      link.textContent = 'Finish session';
    } else {
      var at = load('sentAt', 0), when = at ? new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
      msg.textContent = 'Sent' + (when ? ' at ' + when : '') + '. If the new tab did not say Saved, send it again.';
      link.textContent = 'Send again';
    }
  }
  function mountSend() {
    var nav = document.querySelector('.tabs');
    if (!nav || !sendReady()) return;
    sent = load('sent', {});
    if (!sent || typeof sent !== 'object' || Array.isArray(sent)) sent = {};
    var bar = document.createElement('div');
    bar.className = 'sendbar'; bar.id = 'kit-send'; bar.hidden = true;
    bar.innerHTML = '<span id="kit-send-msg"></span><a class="sendlink" id="kit-send-link" target="_blank" rel="noopener" href="#">Finish session</a>';
    nav.parentNode.insertBefore(bar, nav.nextSibling);
    $('kit-send-link').addEventListener('click', function () {
      var plan = sendPlan();
      plan.used.forEach(function (k) { sent[k] = days[k].last; });
      save('sent', sent); save('sentAt', Date.now());
      setTimeout(paintSend, 600);
    });
  }
  /* ---------- Automatic sending ----------
     On a plain web page (not inside a Claude artifact) the same numbers go to the practice log by themselves:
     about 15 seconds after practice, when the page is hidden or closed, and on the next visit if a send was missed.
     A day counts as sent only when the log answers ok, so a failed send is tried again. */
  var AUTO = !window.claude && typeof fetch === 'function', autoTimer = null, autoBusy = false, autoFails = 0;
  function autoOn() { return AUTO && sendReady() && dbState === 'off'; }
  function autoSoon(ms) {
    if (!autoOn() || autoTimer) return;
    autoTimer = setTimeout(function () { autoTimer = null; autoSend(); }, ms);
  }
  function autoSend() {
    if (!autoOn() || autoBusy) return;
    var plan = sendPlan(), marks = {};
    if (!plan.unsent.length || !plan.used.length) return;
    plan.used.forEach(function (k) { marks[k] = days[k].last; });
    autoBusy = true;
    function done(ok) {
      autoBusy = false;
      if (ok) {
        autoFails = 0;
        Object.keys(marks).forEach(function (k) { sent[k] = marks[k]; });
        save('sent', sent); save('sentAt', Date.now());
        if (sendPlan().unsent.length) autoSoon(15000);
      } else {
        autoFails++;
        autoSoon(Math.min(300000, 30000 * autoFails));
      }
      paintSource();
    }
    try {
      fetch(plan.url + '&f=json', { mode: 'cors', credentials: 'omit', cache: 'no-store', keepalive: true })
        .then(function (r) { return r.json(); })
        .then(function (j) { done(!!(j && j.ok)); }, function () { done(false); });
    } catch (e) { done(false); }
  }
  function autoNow() {
    if (!autoOn()) return;
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    autoSend();
  }
  /* recAnswer(key, ok, dtMs): one graded answer on one item. key must be an item key from init. dtMs null = untimed. */
  function recAnswer(key, ok, dt) {
    if (norec) return;
    var d = dayDoc(), a = d.items[key];
    if (!Array.isArray(a)) a = [0, 0, 0];
    var ms = Math.min(Math.round(num(dt)), C.dtCapMs);
    if (ok && dt === null) d.untimed = num(d.untimed) + 1;
    d.items[key] = [num(a[0]) + 1, num(a[1]) + (ok ? 0 : 1), num(a[2]) + (ok ? ms : 0)];
    d.answered = num(d.answered) + 1;
    if (ok) { d.correct = num(d.correct) + 1; d.msCorrect = num(d.msCorrect) + ms; }
    stamp(d, Math.min(Date.now() - lastAct, C.idleCapMs));
  }
  /* recTest(score, total, ms, countTime): one finished test. countTime=false when its answers were already recorded with recAnswer. */
  function recTest(score, total, ms, countTime) {
    if (norec) return;
    var d = dayDoc();
    if (d.tests.length < 40) d.tests.push({ s: score, t: total, ms: Math.round(num(ms)) });
    stamp(d, countTime === false ? 0 : Math.min(num(ms), 900000));
  }

  /* ---------- Shared record: one document per day per device ---------- */
  var db = null, dbState = 'pending', remote = {}, remoteLoaded = false, remoteSlow = false;
  var syncing = false, syncTimer = null, loadTimer = null, sharedResolve = null;
  var sharedPromise = new Promise(function (res) { sharedResolve = res; });
  function scheduleSync() {
    if (!db || dbState !== 'on' || syncTimer) return;
    syncTimer = setTimeout(flush, 12000);
  }
  function flush() {
    clearTimeout(syncTimer); syncTimer = null;
    if (!db || dbState !== 'on' || syncing) return;
    var list = Object.keys(dirty).filter(function (k) { return days[k]; });
    if (!list.length) return;
    syncing = true;
    var i = 0;
    (function nextDoc() {
      if (i >= list.length) { syncing = false; save('dirty', dirty); return; }
      var k = list[i++], body;
      try { body = JSON.parse(JSON.stringify(days[k])); } catch (e) { nextDoc(); return; }
      delete dirty[k];
      var done;
      try { done = db.doc('days/' + k + '_' + DEV).set(body); } catch (e) { done = Promise.reject(e); }
      done.then(nextDoc, function (e) {
        dirty[k] = 1; syncing = false; save('dirty', dirty);
        var code = e && e.code;
        if (code === 'invalid_argument' || code === 'not_granted' || code === 'revoked' || code === 'transform_error') { dbState = 'readonly'; paintSource(); }
      });
    })();
  }
  function initShared() {
    var c = window.claude;
    if (!c || typeof c.use !== 'function') { dbState = 'off'; paintSource(); sharedResolve({ db: null, canWrite: false }); return; }
    var userDone = c.use('user').then(function (u) {
      if (!u || typeof u.can !== 'function') return null;
      return u.can('data.write');
    }).catch(function () { return null; }).then(function (ok) { if (ok === false) dbState = 'readonly'; return ok; });
    c.use('db').then(function (ns) {
      if (!ns) { dbState = 'off'; paintSource(); sharedResolve({ db: null, canWrite: false }); return; }
      db = ns; if (dbState === 'pending') dbState = 'on';
      loadTimer = setTimeout(function () { if (!remoteLoaded) { remoteSlow = true; paintSource(); } }, 10000);
      try {
        db.collection('days').onSnapshot(function (snap) {
          var m = {};
          snap.docs.forEach(function (d) { var b = d.data(); if (b) m[d.id] = b; });
          remote = m;
          if (!snap.metadata || !snap.metadata.fromCache) { clearTimeout(loadTimer); remoteLoaded = true; remoteSlow = false; }
          if (view === 'report') renderReport();
        }, function () { clearTimeout(loadTimer); remoteSlow = true; paintSource(); });
      } catch (e) { remoteSlow = true; }
      paintSource();
      if (Object.keys(dirty).length) scheduleSync();
      userDone.then(function (ok) { paintSource(); sharedResolve({ db: db, canWrite: ok !== false }); });
    }, function () { dbState = 'off'; paintSource(); sharedResolve({ db: null, canWrite: false }); });
  }
  function autoNote() {
    var at = load('sentAt', 0), when = at ? new Date(at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '';
    return 'This report covers practice on this device. The same numbers are sent to the practice log for a parent to see.' +
      (autoFails ? ' The last send did not go through. It will try again.' : (when ? ' Last sent ' + when + '.' : ''));
  }
  function paintSource() {
    var el = $('kit-source'), t;
    paintSend();
    if (!el) return;
    if (dbState === 'pending') t = 'Checking the shared record.';
    else if (autoOn()) t = autoNote();
    else if (sendOn()) t = 'This report covers this device only. Practice is not saved anywhere else until you tap Finish session at the top of the page.';
    else if (dbState === 'off') t = 'The shared record is not available in this view. This report covers this device only.';
    else if (dbState === 'readonly') t = 'This device cannot save to the shared record, so its practice stays on this device. Ask the owner of this page for Contributor or Editor access.';
    else if (remoteSlow) t = 'The shared record cannot be reached right now. This report may be missing practice from other devices.';
    else if (!remoteLoaded) t = 'Checking the shared record.';
    else t = 'This report combines practice from every device that can save to this page. It updates about 12 seconds after practice pauses.';
    el.textContent = t;
  }

  /* ---------- Report ---------- */
  function allDocs() {
    var m = {}, k;
    for (k in remote) if (Object.prototype.hasOwnProperty.call(remote, k)) m[k] = remote[k];
    for (k in days) if (Object.prototype.hasOwnProperty.call(days, k)) m[k + '_' + DEV] = days[k];
    return Object.keys(m).map(function (id) { return m[id]; });
  }
  function tile(n, label) { return '<div class="stat"><span class="n">' + n + '</span><span class="l">' + esc(label) + '</span></div>'; }
  function minutes(ms) { var m = Math.round(ms / 60000); return (ms > 0 && m < 1) ? '&lt;1' : String(m); }
  function renderReport() {
    var box = $('kit-report');
    if (!box) return;
    var r = summarize(allDocs(), todayStr(), C), T = C.test || null, h = '';
    h += '<section><h2>Last 7 days</h2><div class="tiles">' +
      tile(r.days7 + '<small> of 7</small>', 'Days practiced') +
      tile(minutes(r.ms7) + '<small> min</small>', 'Practice time');
    if (C.mastery) h += tile(r.done + '<small>/' + (r.total || '–') + '</small>', C.masteryLabel || 'Mastered now');
    if (T) h += tile(T.goalMs ? (r.bestMs ? fmt(r.bestMs) : '–') : (r.bestScore === null ? '–' : r.bestScore + '<small>/' + T.total + '</small>'), 'Best ' + T.name);
    h += '</div></section>';
    if (r.empty) {
      h += '<section><p class="empty">No practice recorded yet. Answers on the other tabs will show up here.</p></section>';
    } else {
      var words = { bad: 'Fix', warn: 'Watch', ok: 'Good' }, label = { miss: 'misses', slow: 'slow', ok: 'solid', none: '' };
      h += '<section><h2>What to work on</h2><ul class="flags">';
      r.flags.forEach(function (f) { h += '<li><span class="pill ' + f.lv + '">' + words[f.lv] + '</span><span>' + esc(f.text) + '</span></li>'; });
      h += '</ul></section>';

      var timed = !!C.slowMs, cols = timed ? 4 : 3, lastG = null;
      h += '<section><h2>Each item, last 7 days</h2><p class="note">Right answers out of tries' + (timed ? ', and the average time on right answers.' : '.') + '</p><div class="scroll"><table class="itable"><thead><tr><th scope="col">Item</th><th scope="col">Right</th>' + (timed ? '<th scope="col">Avg time</th>' : '') + '<th scope="col"></th></tr></thead><tbody>';
      C.items.forEach(function (it) {
        var p = r.per[it.key], g = it.group || '';
        if (g && g !== lastG) { h += '<tr class="grp"><td colspan="' + cols + '">' + esc(g) + '</td></tr>'; lastG = g; }
        if (!p.n7) { h += '<tr class="none"><td>' + esc(it.name) + '</td><td>no tries</td>' + (timed ? '<td></td>' : '') + '<td class="st"></td></tr>'; return; }
        h += '<tr class="' + p.st + '"><td>' + esc(it.name) + '</td><td>' + p.ok7 + '/' + p.n7 + '</td>' + (timed ? '<td>' + (p.ok7 ? secs(p.avg) : '–') + '</td>' : '') + '<td class="st">' + label[p.st] + '</td></tr>';
      });
      h += '</tbody></table></div></section>';

      h += '<section><h2>Day by day</h2><div class="scroll"><table class="log"><thead><tr><th scope="col">Day</th><th scope="col">Minutes</th><th scope="col">Answers</th><th scope="col">Right</th>' + (timed ? '<th scope="col">Avg time</th>' : '') + '<th scope="col">' + (T ? esc(T.name) : '') + '</th></tr></thead><tbody>';
      r.log.forEach(function (d) {
        var tb = T ? '–' : '';
        if (T && d.tests.length) {
          var top = d.tests.slice().sort(function (x, y) { return y.s - x.s || x.ms - y.ms; })[0];
          tb = d.tests.length + ', best ' + top.s + '/' + top.t + (top.ms ? ' in ' + fmt(top.ms) : '');
        }
        h += '<tr><td>' + esc(fmtDate(d.date)) + '</td><td>' + minutes(d.activeMs) + '</td><td>' + d.answered + '</td><td>' +
          (d.answered ? pct(Math.min(d.correct, d.answered) / d.answered) : '–') + '</td>' +
          (timed ? '<td>' + (d.correct ? secs(d.msCorrect / d.correct) : '–') + '</td>' : '') + '<td>' + tb + '</td></tr>';
      });
      h += '</tbody></table></div></section>';
    }
    box.innerHTML = h;
    paintSource();
    if (C.onReport) { try { C.onReport(r); } catch (e) {} }
  }

  /* ---------- Tabs ---------- */
  function show(v, push) {
    if (VIEWS.indexOf(v) < 0) v = VIEWS[0];
    view = v;
    VIEWS.forEach(function (n) {
      var sec = $('view-' + n), tab = $('tab-' + n);
      if (sec) sec.hidden = n !== v;
      if (tab) tab.setAttribute('aria-selected', n === v ? 'true' : 'false');
    });
    if (v === 'report') { flush(); renderReport(); }
    if (push) { try { history.replaceState(null, '', '#' + v); } catch (e) { try { location.hash = v; } catch (e2) {} } }
    if (C.onShow) C.onShow(v);
  }

  /* digitKeys(getContainer): number keys 1-9 press the nth enabled .key in the container returned for the current view. */
  function digitKeys(getContainer) {
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || !e.key) return;
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      var n = '123456789'.indexOf(e.key);
      if (n < 0) return;
      var box = getContainer(view);
      if (!box) return;
      var b = box.querySelectorAll('.key')[n];
      if (b && !b.disabled) { e.preventDefault(); b.click(); }
    });
  }

  /* init(config):
       prefix        string, unique per page; namespaces this page's saved data on the device
       items         [{ key, name, group }]  key: letters/digits/_ only; name: plain text shown in the report
       slowMs        right answers slower than this are flagged "slow" (default 3000); null for untimed work
       planDays      practice days per week the plan asks for (default 5)
       planMinutes   minutes per day the plan asks for on this page (default 5)
       idleCapMs     longest gap between answers that still counts as practice time (default 20000)
       dtCapMs       cap on one answer's time when averaging (default 20000)
       test          { name, total, passScore?, goalMs? } or null; results go in with recTest()
       mastery       function returning { done, total }, shown as a tile and saved with each record; or null
       masteryLabel  tile label (default "Mastered now")
       norecLabel    label for the don't-record checkbox
       onShow(view)  called whenever a tab is shown
       onReport(r)   called after the report renders */
  function init(config) {
    C = config || {};
    P = C.prefix || 'kit';
    C.items = C.items || [];
    if (C.slowMs === undefined) C.slowMs = 3000;
    C.idleCapMs = C.idleCapMs || 20000;
    C.dtCapMs = C.dtCapMs || 20000;
    DEV = load('dev', null);
    if (typeof DEV !== 'string' || !/^[a-z0-9]{6}$/.test(DEV)) {
      DEV = ''; for (var i = 0; i < 6; i++) DEV += 'abcdefghijkmnpqrstuvwxyz23456789'.charAt(Math.floor(Math.random() * 32));
      save('dev', DEV);
    }
    days = load('days', {});
    if (!days || typeof days !== 'object' || Array.isArray(days)) days = {};
    dirty = load('dirty', {});
    if (!dirty || typeof dirty !== 'object' || Array.isArray(dirty)) dirty = {};
    norec = load('norec', false) === true;
    var rv = $('view-report');
    if (rv) {
      rv.innerHTML = '<div class="rep"><div id="kit-report" class="rep"></div><section><p class="note" id="kit-source"></p>' +
        '<label class="check" for="kit-norec"><input type="checkbox" id="kit-norec"> ' + esc(C.norecLabel || "Don't record practice on this device (for a parent trying it out)") + '</label></section></div>';
      $('kit-norec').checked = norec;
      $('kit-norec').addEventListener('change', function () { norec = $('kit-norec').checked; save('norec', norec); });
    }
  }
  /* start(): call once, after the page has built its own DOM and decks. */
  function start() {
    VIEWS = Array.prototype.map.call(document.querySelectorAll('.tab'), function (t) { return t.dataset.view; });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.addEventListener('click', function () { show(t.dataset.view, true); });
    });
    window.addEventListener('hashchange', function () { show(location.hash.replace('#', ''), false); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { flush(); autoNow(); } });
    window.addEventListener('pagehide', function () { flush(); autoNow(); });
    mountSend();
    paintSource();
    show(location.hash.replace('#', ''), false);
    initShared();
    autoSoon(3000);
  }

  return {
    $: $, load: load, save: save, esc: esc, shuffle: shuffle, pickOne: pickOne,
    math: math, M: M, fmt: fmt, secs: secs, pct: pct,
    init: init, start: start, show: show, view: function () { return view; },
    deck: deck, recAnswer: recAnswer, recTest: recTest, digitKeys: digitKeys,
    shared: function () { return sharedPromise; },      /* resolves { db, canWrite } once known; db is null when unavailable */
    recording: function () { return !norec; },
    today: todayStr, _summarize: summarize, _encodeDay: encodeDay, _sendPlan: sendPlan
  };
})();
