/* SHRM TRIVIA NIGHT - shared UI helpers, option shapes, confetti and sound. */
(function () {
  "use strict";

  var app = null;
  function root() { return app || (app = document.getElementById("app")); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function q(sel, el) { return (el || document).querySelector(sel); }
  function qa(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function on(sel, ev, fn, el) { var n = typeof sel === "string" ? q(sel, el) : sel; if (n) n.addEventListener(ev, fn); return n; }
  function render(html, cls) {
    var r = root();
    r.innerHTML = html;
    r.className = cls || "";
    return r;
  }

  var toastT = 0;
  function toast(msg, bad) {
    var t = q("#toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.className = "show" + (bad ? " bad" : "");
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.className = ""; }, 2600);
  }

  /* Four answer slots: colour + shape, same on the screen and on every phone. */
  var SLOTS = [
    { key: "gold",  name: "Triangle", svg: '<svg viewBox="0 0 24 24"><path d="M12 3 22 21H2z"/></svg>' },
    { key: "lav",   name: "Diamond",  svg: '<svg viewBox="0 0 24 24"><path d="M12 2 22 12 12 22 2 12z"/></svg>' },
    { key: "sky",   name: "Circle",   svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>' },
    { key: "melon", name: "Square",   svg: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>' }
  ];

  /* Player accent colours (avatar frames). 20 so a full room rarely doubles up. */
  var PLAYER_COLORS = ["#F5B32A", "#A896EA", "#9BD1FF", "#F26A42", "#5CC98A", "#F28FB1", "#FFD86B",
    "#7FE0D6", "#C7BAF5", "#FF9F7A", "#8FD3FF", "#E4C1FF", "#B7F0A8", "#FFC9A8", "#9FA8FF", "#F5E07A",
    "#8BE9C2", "#FFB3C7", "#D6C2FF", "#A5E3FF"];

  function fmtMs(ms) { return (Math.max(0, ms) / 1000).toFixed(1) + "s"; }
  function fmtScore(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /* Count a number up inside an element. */
  function countUp(el, from, to, ms) {
    if (!el) return;
    var t0 = performance.now();
    function step(t) {
      var k = Math.min(1, (t - t0) / (ms || 800));
      k = 1 - Math.pow(1 - k, 3);
      el.textContent = fmtScore(from + (to - from) * k);
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------------- confetti ---------------- */
  var confettiCanvas = null, confettiParts = [], confettiRAF = 0;
  function confetti(opts) {
    opts = opts || {};
    if (!confettiCanvas) {
      confettiCanvas = document.createElement("canvas");
      confettiCanvas.id = "confetti";
      document.body.appendChild(confettiCanvas);
    }
    var c = confettiCanvas, ctx = c.getContext("2d");
    c.width = innerWidth; c.height = innerHeight;
    var colors = ["#F5B32A", "#A896EA", "#F3EEE3", "#9BD1FF", "#F26A42"];
    var n = opts.count || 160;
    for (var i = 0; i < n; i++) {
      confettiParts.push({
        x: opts.x != null ? opts.x : Math.random() * c.width,
        y: opts.y != null ? opts.y : -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * (opts.spread || 6),
        vy: opts.burst ? -(4 + Math.random() * 9) : 2 + Math.random() * 3,
        w: 6 + Math.random() * 8, h: 8 + Math.random() * 10,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        col: colors[(Math.random() * colors.length) | 0], life: 1
      });
    }
    if (!confettiRAF) tick();
    function tick() {
      ctx.clearRect(0, 0, c.width, c.height);
      confettiParts = confettiParts.filter(function (p) { return p.y < c.height + 30 && p.life > 0; });
      confettiParts.forEach(function (p) {
        p.vy += 0.18; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vx *= 0.99;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      confettiRAF = confettiParts.length ? requestAnimationFrame(tick) : 0;
      if (!confettiRAF) ctx.clearRect(0, 0, c.width, c.height);
    }
  }

  /* ---------------- sound (Web Audio, no files) ---------------- */
  var AC = null, muted = false;
  function ac() {
    if (muted) return null;
    try {
      if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === "suspended") AC.resume();
      return AC;
    } catch (e) { return null; }
  }
  function tone(f, t0, dur, type, gain, slideTo) {
    var a = ac(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f, a.currentTime + t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + t0 + dur);
    g.gain.setValueAtTime(0.0001, a.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.18, a.currentTime + t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + 0.05);
  }
  var SFX = {
    unlock: function () { ac(); },
    mute: function (m) { muted = m; },
    join: function () { tone(880, 0, 0.09, "triangle", 0.12); tone(1320, 0.07, 0.12, "triangle", 0.1); },
    lock: function () { tone(520, 0, 0.06, "square", 0.05); },
    tick: function () { tone(1200, 0, 0.05, "square", 0.06); },
    go: function () { tone(440, 0, 0.1, "triangle", 0.14); tone(660, 0.1, 0.1, "triangle", 0.14); tone(880, 0.2, 0.22, "triangle", 0.16); },
    reveal: function () { tone(330, 0, 0.35, "sawtooth", 0.08, 660); tone(990, 0.3, 0.3, "triangle", 0.12); },
    right: function () { tone(660, 0, 0.1, "triangle", 0.14); tone(990, 0.09, 0.18, "triangle", 0.14); },
    wrong: function () { tone(220, 0, 0.25, "sawtooth", 0.08, 140); },
    whoosh: function () { tone(200, 0, 0.3, "sine", 0.1, 900); },
    fanfare: function () {
      [523, 659, 784, 1046].forEach(function (f, i) { tone(f, i * 0.12, 0.3, "triangle", 0.14); });
      tone(1318, 0.5, 0.7, "triangle", 0.16);
    }
  };

  window.UI = {
    esc: esc, q: q, qa: qa, on: on, render: render, toast: toast,
    SLOTS: SLOTS, PLAYER_COLORS: PLAYER_COLORS,
    fmtMs: fmtMs, fmtScore: fmtScore, ordinal: ordinal, countUp: countUp,
    confetti: confetti, SFX: SFX
  };
})();
