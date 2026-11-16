/* SHRM TRIVIA NIGHT - host (the big screen). Owns every bit of game state.
   Phones are thin clients: they send a name + drawing to join, and a choice + time to answer. */
(function () {
  "use strict";
  var U = window.UI, Q = window.QUESTIONS, SFX = U.SFX;

  var params = new URLSearchParams(location.search);
  var FAST = params.has("fast");
  var AUTO = params.has("auto");
  var READ_MS = FAST ? 1200 : 4500;        // question alone on screen before the options appear
  var ROUND_MS = FAST ? 1600 : 4200;       // round / difficulty intro card
  var REVEAL_HOLD = FAST ? 1800 : 6500;    // auto mode only: how long the reveal sits before moving on
  var ALL_IN_GRACE = 900;                  // once everyone has answered, close the question after this

  var BASE = 1000, SPEED_MAX = 250;        // right answer = 1000, plus up to 250 for speed

  var G = null, net = null, tickRAF = 0, timers = [];
  var BOT_NAMES = ["Kayla", "Dylan", "Blasia", "Krishtina", "Ilana", "Marcus", "Priya", "Jordan", "Sofia", "Ethan",
    "Maya", "Noah", "Zara", "Liam", "Aaliyah", "Tyler", "Nia", "Omar", "Grace", "Leo", "Harper", "Diego", "Ava", "Jaden", "Chloe"];

  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  /* ---------------- state ---------------- */
  function fresh() {
    return {
      code: "", phase: "lobby", players: {}, order: [], qs: [], qi: -1,
      settings: { boardEvery: 1 },
      askStart: 0, deadline: 0, answers: {}, prevRank: {}, muted: false, nextSeq: 1, tbUsed: 0
    };
  }
  function connectedPlayers() { return G.order.map(function (id) { return G.players[id]; }).filter(function (p) { return p && (p.connected || p.bot); }); }
  function allPlayers() { return G.order.map(function (id) { return G.players[id]; }).filter(Boolean); }
  function ranked() {
    return allPlayers().slice().sort(function (a, b) {
      return (b.score - a.score) || (a.totalMs - b.totalMs) || (a.joined - b.joined);
    });
  }
  function rankOf(pid) { var r = ranked(); for (var i = 0; i < r.length; i++) if (r[i].pid === pid) return i + 1; return r.length; }
  function scoreFor(ms, limitMs) { var k = Math.max(0, Math.min(1, 1 - ms / limitMs)); return BASE + Math.round(SPEED_MAX * k); }
  function current() { return G.qs[G.qi]; }
  function isLast() { return G.qi >= G.qs.length - 1; }
  function tiedAtTop() { var r = ranked(); return r.length > 1 && r[0].score === r[1].score; }
  function tiebreakerLeft() { return !!Q.tiebreaker(G.tbUsed); }

  function joinURL() { return location.origin + location.pathname.replace(/index\.html$/, "") + "#" + G.code; }
  function prettyURL() { return location.host + location.pathname.replace(/index\.html$/, ""); }

  /* ---------------- networking ---------------- */
  function startNet() {
    net = window.NET.host({
      onReady: function (code) { G.code = code; if (G.phase === "lobby") drawQR(); },
      onJoin: function (msg) {
        var name = String(msg.name || "").replace(/\s+/g, " ").trim().slice(0, 16);
        if (!name) return null;
        var av = typeof msg.avatar === "string" && /^data:image\/png;base64,/.test(msg.avatar) && msg.avatar.length < 90000 ? msg.avatar : "";
        var pid = msg.pid && G.players[msg.pid] ? msg.pid : null;
        if (pid) {
          var p = G.players[pid];
          p.name = name; if (av) p.avatar = av; p.connected = true;
        } else {
          pid = "p" + (G.nextSeq++) + "-" + Math.random().toString(36).slice(2, 6);
          G.players[pid] = {
            pid: pid, name: name, avatar: av, color: U.PLAYER_COLORS[(G.order.length) % U.PLAYER_COLORS.length],
            score: 0, correct: 0, totalMs: 0, streak: 0, lastGain: 0, connected: true, joined: Date.now(), bot: false
          };
          G.order.push(pid);
          SFX.join();
        }
        later(function () { welcome(pid); }, 30);
        onRosterChange();
        return pid;
      },
      onLeave: function (pid) { var p = G.players[pid]; if (p) { p.connected = false; onRosterChange(); } },
      onMsg: function (pid, msg) {
        if (msg.t === "answer") takeAnswer(pid, msg);
      },
      onError: function (err) { U.toast("Connection problem: " + (err && err.type || "unknown"), true); }
    });
  }

  function welcome(pid) {
    var p = G.players[pid]; if (!p) return;
    var w = { t: "welcome", pid: pid, name: p.name, color: p.color, phase: G.phase, score: p.score, n: allPlayers().length };
    net.send(pid, w);
    // Catch a late or returning player up with whatever is on screen.
    if (G.phase === "ask" && Date.now() < G.deadline && !G.answers[pid]) net.send(pid, askMsg(Date.now() - G.askStart));
    else if (G.phase === "read" || G.phase === "round") net.send(pid, { t: "read", n: G.qi + 1, total: G.qs.length, cat: current().cat, color: current().color });
    else if (G.phase === "reveal" || G.phase === "board" || G.phase === "winner") net.send(pid, { t: "board", rank: rankOf(pid), total: allPlayers().length, score: p.score });
    else if (G.phase === "podium") sendFinal(pid);
    else net.send(pid, { t: "lobby", n: allPlayers().length });
  }

  function onRosterChange() {
    if (G.phase === "lobby") { paintRoster(); net.broadcast({ t: "lobby", n: allPlayers().length }); }
    if (G.phase === "ask") maybeCloseEarly();
  }

  /* ---------------- lobby ---------------- */
  function topbar() {
    return '<div class="topbar"><div class="wordmark">SHRM<b>@</b>VCU</div>' +
      '<div class="right"><div class="eyebrow">Fall 2026</div><div class="eyebrow gold">Last meeting of the semester</div></div></div>';
  }
  function avatarImg(p) { return p.avatar ? '<img src="' + p.avatar + '" alt="">' : ""; }

  function paintLobby() {
    var s = G.settings;
    U.render(topbar() +
      '<div class="stage"><div class="lobby">' +
        '<div class="join rise">' +
          '<p class="tag serif">One last chapter meeting.<br><span class="sky">One winning phone.</span></p>' +
          '<div id="qr" class="qr"></div>' +
          '<div class="codewrap"><div class="eyebrow">Join code</div><div class="code display" id="code">' + (G.code || "····") + '</div></div>' +
          '<div class="url">scan the code, or go to <b>' + U.esc(prettyURL()) + '</b> and type it in</div>' +
        '</div>' +
        '<div class="room rise d1">' +
          '<div class="head"><div class="display">Trivia <b>Night</b></div><div class="serif" id="roomcount"></div></div>' +
          '<div class="roster" id="roster"></div>' +
          '<div class="settings">' +
            '<div class="grp rounds"><span class="eyebrow">Tonight</span>' + Q.ROUNDS.map(function (r) {
              return '<span class="chip on ' + r.color + '" title="' + U.esc(r.name) + '">' + r.n + ' &middot; ' + U.esc(r.diff) + '</span>';
            }).join("") + '<span class="eyebrow" style="margin-left:6px">25 questions</span></div>' +
            '<div class="grp" id="board"><span class="eyebrow">Leaderboard</span>' + [[1, "Every Q"], [5, "Every round"], [99, "End only"]].map(function (o) {
              return '<button class="chip' + (s.boardEvery === o[0] ? " on" : "") + '" data-board="' + o[0] + '">' + o[1] + '</button>';
            }).join("") + '</div>' +
            '<button class="btn gold display start" id="startBtn">Start</button>' +
          '</div>' +
        '</div>' +
      '</div></div>' + controls(true), "host");
    drawQR();
    paintRoster();
    bindControls("");
    U.on("#board", "click", function (e) {
      var b = e.target.closest("[data-board]"); if (!b) return;
      s.boardEvery = +b.dataset.board; U.qa("#board .chip").forEach(function (c) { c.classList.toggle("on", c === b); });
    });
    U.on("#startBtn", "click", startGame);
  }

  function drawQR() {
    var el = U.q("#qr");
    if (!el || !window.QRCode || !G.code) return;
    el.innerHTML = "";
    try {
      new window.QRCode(el, { text: joinURL(), width: 320, height: 320, colorDark: "#0B1142", colorLight: "#F3EEE3", correctLevel: window.QRCode.CorrectLevel.M });
    } catch (e) {}
    var c = U.q("#code"); if (c) c.textContent = G.code;
  }

  function paintRoster() {
    var el = U.q("#roster"); if (!el) return;
    var ps = allPlayers();
    var rc = U.q("#roomcount");
    if (rc) rc.textContent = ps.length ? ps.length + (ps.length === 1 ? " player in" : " players in") : "waiting for players";
    if (!ps.length) { el.innerHTML = '<div class="empty serif pulse">Nobody yet. Scan the code, type your name, draw your face.</div>'; return; }
    var have = {};
    U.qa(".pcard", el).forEach(function (c) { have[c.dataset.pid] = c; });
    ps.forEach(function (p) {
      var c = have[p.pid];
      if (!c) {
        c = document.createElement("div"); c.className = "pcard"; c.dataset.pid = p.pid;
        el.appendChild(c);
      }
      c.style.setProperty("--pc", p.color);
      c.classList.toggle("gone", !p.connected && !p.bot);
      c.innerHTML = '<div class="av">' + avatarImg(p) + '</div><div class="nm">' + U.esc(p.name) + '</div>';
    });
    var empty = U.q(".empty", el); if (empty) empty.remove();
    fitRoster(el);
  }
  function fitRoster(el) {
    // Shrink the cards until every name fits on screen (25+ people on one projector).
    var scale = 1;
    el.style.setProperty("--rs", "1");
    el.style.zoom = "";
    while (el.scrollHeight > el.clientHeight + 2 && scale > 0.45) {
      scale -= 0.06;
      el.style.zoom = String(scale);
    }
  }

  /* ---------------- game flow ---------------- */
  function startGame() {
    if (G.phase !== "lobby") return;
    if (!allPlayers().length) { U.toast("Nobody has joined yet", true); return; }
    SFX.unlock();
    G.qs = Q.flat(FAST ? 7 : 0);
    G.qi = -1; G.tbUsed = 0;
    allPlayers().forEach(function (p) { p.score = 0; p.correct = 0; p.totalMs = 0; p.streak = 0; p.lastGain = 0; });
    SFX.go();
    nextQuestion();
  }

  function nextQuestion() {
    clearTimers();
    G.qi++;
    if (G.qi >= G.qs.length) { winner(); return; }
    G.answers = {};
    G.prevRank = {}; ranked().forEach(function (p, i) { G.prevRank[p.pid] = i + 1; });
    var q = current();
    if (q.first) {
      G.phase = "round";
      net.broadcast({ t: "round", round: q.round, name: q.roundName, diff: q.diff, color: q.color, tiebreak: !!q.tiebreak });
      paintRound(q);
      SFX.go();
      later(showRead, ROUND_MS);
    } else showRead();
  }
  function showRead() {
    clearTimers();
    G.phase = "read";
    var q = current();
    net.broadcast({ t: "read", n: G.qi + 1, total: G.qs.length, cat: q.cat, color: q.color });
    paintRead();
    SFX.whoosh();
    later(ask, READ_MS);
  }

  function askMsg(elapsed) {
    var q = current();
    return { t: "ask", q: G.qi, n: G.qi + 1, total: G.qs.length, text: q.q, a: q.a, cat: q.cat, color: q.color, limit: q.t * 1000, elapsed: elapsed || 0 };
  }
  function ask() {
    G.phase = "ask";
    G.askStart = Date.now();
    G.deadline = G.askStart + current().t * 1000;
    net.broadcast(askMsg(0));
    paintAsk();
    SFX.go();
    startTick();
    botsAnswer();
  }

  function takeAnswer(pid, msg) {
    if (G.phase !== "ask" || msg.q !== G.qi) return;
    var p = G.players[pid]; if (!p || G.answers[pid]) return;
    var hostMs = Date.now() - G.askStart;
    if (hostMs > current().t * 1000 + 1500) return;
    var ms = typeof msg.ms === "number" && msg.ms >= 0 && msg.ms <= hostMs + 80 ? msg.ms : hostMs;
    var choice = [0, 1, 2, 3].indexOf(msg.choice) >= 0 ? msg.choice : -1;
    if (choice < 0) return;
    G.answers[pid] = { choice: choice, ms: Math.min(ms, current().t * 1000) };
    net.send(pid, { t: "ack", q: G.qi, ms: G.answers[pid].ms });
    SFX.lock();
    paintLockedTray();
    maybeCloseEarly();
  }

  function maybeCloseEarly() {
    if (G.phase !== "ask") return;
    var live = connectedPlayers();
    if (!live.length) return;
    var pending = live.filter(function (p) { return !G.answers[p.pid]; });
    if (!pending.length && !G.closing) {
      G.closing = true;
      later(reveal, ALL_IN_GRACE);
    }
  }

  function reveal() {
    if (G.phase !== "ask") return;
    G.phase = "reveal"; G.closing = false;
    stopTick(); clearTimers();
    var q = current(), limitMs = q.t * 1000;
    var counts = [0, 0, 0, 0], fastest = null;
    allPlayers().forEach(function (p) {
      var a = G.answers[p.pid];
      var gained = 0, right = false;
      if (a) {
        counts[a.choice]++;
        right = a.choice === q.c;
        if (right) {
          gained = scoreFor(a.ms, limitMs);
          p.correct++; p.totalMs += a.ms; p.streak++;
          if (!fastest || a.ms < fastest.ms) fastest = { p: p, ms: a.ms };
        } else p.streak = 0;
      } else p.streak = 0;
      p.lastGain = gained; p.score += gained;
    });
    var total = allPlayers().length;
    allPlayers().forEach(function (p) {
      var a = G.answers[p.pid];
      net.send(p.pid, {
        t: "result", q: G.qi, answered: !!a, choice: a ? a.choice : -1, correct: q.c, right: !!a && a.choice === q.c,
        gained: p.lastGain, score: p.score, rank: rankOf(p.pid), total: total, streak: p.streak, answer: q.a[q.c]
      });
    });
    paintReveal(counts, fastest);
    SFX.reveal();
    if (AUTO) later(afterReveal, REVEAL_HOLD);
  }

  function afterReveal() {
    if (G.phase !== "reveal") return;
    var every = G.settings.boardEvery, last = isLast();
    if (last || current().tiebreak || ((G.qi + 1) % every === 0)) board(); else nextQuestion();
  }
  function afterBoard() {
    if (!isLast()) { nextQuestion(); return; }
    if (tiedAtTop() && tiebreakerLeft()) {
      G.qs.push(Q.tiebreaker(G.tbUsed++, FAST ? 7 : 0));
      nextQuestion();
      return;
    }
    winner();
  }

  function winner() {
    clearTimers(); stopTick();
    G.phase = "winner";
    net.broadcast({ t: "winner" });
    paintWinner();
  }

  function board() {
    clearTimers();
    G.phase = "board";
    net.broadcast({ t: "board" });
    paintBoard();
    SFX.whoosh();
    if (AUTO) later(afterBoard, FAST ? 1800 : 5000);
  }

  function sendFinal(pid) {
    var p = G.players[pid]; if (!p) return;
    net.send(pid, { t: "final", rank: rankOf(pid), total: allPlayers().length, score: p.score, correct: p.correct, qs: G.qs.length });
  }
  function podium() {
    clearTimers(); stopTick();
    G.phase = "podium";
    allPlayers().forEach(function (p) { sendFinal(p.pid); });
    paintPodium();
    later(function () { U.confetti({ count: 200 }); }, 1600);
  }

  function advance() {
    SFX.unlock();
    if (G.phase === "lobby") startGame();
    else if (G.phase === "round") showRead();
    else if (G.phase === "read") { clearTimers(); ask(); }
    else if (G.phase === "ask") reveal();
    else if (G.phase === "reveal") afterReveal();
    else if (G.phase === "board") afterBoard();
    else if (G.phase === "winner") { if (G.winnerDone) podium(); }
    else if (G.phase === "podium") { U.toast("That's the game. Reload to host another."); }
  }

  /* ---------------- timer ---------------- */
  var lastWhole = -1;
  function startTick() { stopTick(); lastWhole = -1; tick(); }
  function stopTick() { if (tickRAF) cancelAnimationFrame(tickRAF); tickRAF = 0; }
  function tick() {
    if (G.phase !== "ask") return;
    var limit = current().t * 1000, left = G.deadline - Date.now(), k = Math.max(0, left / limit);
    var bar = U.q("#tbar"); if (bar) bar.style.transform = "scaleX(" + k + ")";
    var tm = U.q("#timer"); if (tm) tm.classList.toggle("hot", left < 5000);
    var num = U.q("#tnum"); var whole = Math.ceil(left / 1000);
    if (num && whole !== lastWhole) { num.textContent = Math.max(0, whole); if (whole <= 3 && whole > 0) SFX.tick(); lastWhole = whole; }
    if (left <= 0) { reveal(); return; }
    tickRAF = requestAnimationFrame(tick);
  }

  /* ---------------- painting ---------------- */
  function controls(lobby) {
    return '<div class="hostctl">' +
      '<span class="hint" id="ctlhint"></span>' +
      '<button class="btn ghost" id="muteBtn">' + (G.muted ? "Unmute" : "Mute") + '</button>' +
      (lobby ? "" : '<button class="btn ghost" id="endBtn">End game</button><button class="btn" id="nextBtn">Next</button>') +
    '</div>';
  }
  function diffLine(q) {
    return q.tiebreak ? "Only the tied players matter now. Everyone can play." :
      q.diff === "Easy" ? "Warm up. Everyone should get these." :
      q.diff === "Medium" ? "Now it gets real." :
      q.diff === "Challenging" ? "Scenarios. Think like HR." :
      "Easy points, big bragging rights.";
  }
  function paintRound(q) {
    U.render(topbar() + '<div class="stage"><div class="roundcard">' +
      '<div class="eyebrow sky rise">' + (q.tiebreak ? "Sudden death" : "Up next") + '</div>' +
      '<div class="display rn rise d1">' + (q.tiebreak ? "Tie<span class='gold'>breaker</span>" : "Round <span class='gold'>" + q.round + "</span>") + '</div>' +
      '<div class="serif rname rise d2">' + U.esc(q.roundName) + '</div>' +
      '<div class="stamp ' + q.color + '"><span>' + U.esc(q.diff) + '</span></div>' +
      '<div class="rline rise d5">' + U.esc(diffLine(q)) + '</div>' +
    '</div></div>' + controls(), "host");
    bindControls("Space: skip intro");
  }

  function paintWinner() {
    var r = ranked(), w = r[0];
    if (!w) { podium(); return; }
    G.winnerDone = false;
    var pool = r.slice(0, Math.min(6, r.length));
    U.render(topbar() + '<div class="stage"><div class="winner">' +
      '<div class="rays"></div>' +
      '<div class="eyebrow gold rise" id="wlead">And the winner is...</div>' +
      '<div class="spot" id="spot"><div class="av" id="wav"></div></div>' +
      '<div class="display wname" id="wname">&nbsp;</div>' +
      '<div class="serif wsub" id="wsub">&nbsp;</div>' +
    '</div></div>' + controls(), "host");
    bindControls("");
    var av = U.q("#wav"), spot = U.q("#spot"), name = U.q("#wname"), sub = U.q("#wsub");
    // Slot-machine shuffle through the finalists, slowing down, landing on the winner.
    var seq = [], i, total = FAST ? 14 : 26;
    for (i = 0; i < total; i++) seq.push(pool[(i + 1) % pool.length]);
    seq.push(w);
    var t = 0;
    seq.forEach(function (p, k) {
      var isLastOne = k === seq.length - 1;
      var step = 70 + Math.pow(k / seq.length, 2.2) * 520;
      t += step;
      later(function () {
        av.innerHTML = avatarImg(p); spot.style.setProperty("--pc", p.color);
        if (!isLastOne) { SFX.tick(); return; }
        spot.classList.add("land");
        name.innerHTML = U.esc(p.name);
        name.classList.add("slam");
        sub.textContent = U.fmtScore(p.score) + " points · " + p.correct + " of " + G.qs.length + " right";
        sub.classList.add("rise");
        U.q("#wlead").textContent = "Trivia Night champion";
        U.q(".winner .rays").classList.add("on");
        SFX.fanfare();
        U.confetti({ count: 200, x: innerWidth / 2, y: innerHeight * 0.45, burst: true, spread: 26 });
        later(function () { U.confetti({ count: 220 }); }, 500);
        later(function () { G.winnerDone = true; var h = U.q("#ctlhint"); if (h) h.textContent = "Space: podium"; }, 1200);
      }, t);
    });
  }
  function bindControls(hint) {
    var h = U.q("#ctlhint"); if (h) h.textContent = hint || "";
    U.on("#nextBtn", "click", advance);
    U.on("#muteBtn", "click", function () { G.muted = !G.muted; SFX.mute(G.muted); this.textContent = G.muted ? "Unmute" : "Mute"; });
    U.on("#endBtn", "click", function () { if (G.phase !== "lobby" && G.phase !== "podium" && confirm("End the game now and show the podium?")) podium(); });
  }
  function qhead(q) {
    return '<div class="qhead rise"><div class="cat"><span class="pill ' + q.color + '">' + U.esc(q.cat) + '</span><span class="serif">' + U.esc(q.tag) + '</span></div>' +
      '<div class="num">Q <b>' + (G.qi + 1) + '</b> / ' + G.qs.length + '</div></div>';
  }

  function paintRead() {
    var q = current();
    U.render(topbar() + '<div class="stage">' + qhead(q) +
      '<div class="question read"><div class="text rise d1">' + U.esc(q.q) + '</div>' +
      '<div class="readhint rise d3 serif">Get ready... answers in <b id="readnum">' + Math.ceil(READ_MS / 1000) + '</b></div></div>' +
      '</div>' + controls(), "host");
    bindControls("Space: show answers");
    var n = Math.ceil(READ_MS / 1000);
    var iv = setInterval(function () { n--; var el = U.q("#readnum"); if (!el || n <= 0) { clearInterval(iv); return; } el.textContent = n; }, 1000);
    timers.push(iv);
  }

  function paintAsk() {
    var q = current();
    U.render(topbar() + '<div class="stage">' + qhead(q) +
      '<div class="timer" id="timer"><i id="tbar"></i></div>' +
      '<div class="question"><div class="text">' + U.esc(q.q) + '</div>' +
        '<div class="answers" id="answers">' + q.a.map(function (t, i) {
          var s = U.SLOTS[i];
          return '<div class="opt ' + s.key + '" data-i="' + i + '"><div class="bar"></div><div class="shape">' + s.svg + '</div><div class="label">' + U.esc(t) + '</div><div class="cnt">0</div><div class="check">Correct</div></div>';
        }).join("") + '</div>' +
        '<div class="lockedtray"><span class="eyebrow">Locked in</span><span class="count" id="lockcount"></span><div class="avs" id="lockavs"></div>' +
        '<span class="count" style="margin-left:auto" id="tnum"></span></div>' +
      '</div></div>' + controls(), "host");
    bindControls("Space: close early");
    paintLockedTray();
  }

  function paintLockedTray() {
    var c = U.q("#lockcount"), avs = U.q("#lockavs"); if (!c) return;
    var live = connectedPlayers(), n = Object.keys(G.answers).length;
    c.innerHTML = '<b>' + n + '</b> / ' + live.length;
    var have = {}; U.qa(".mini", avs).forEach(function (m) { have[m.dataset.pid] = true; });
    Object.keys(G.answers).forEach(function (pid) {
      if (have[pid]) return;
      var p = G.players[pid]; if (!p) return;
      var m = document.createElement("div"); m.className = "mini"; m.dataset.pid = pid; m.style.setProperty("--pc", p.color);
      m.innerHTML = avatarImg(p); m.title = p.name;
      avs.appendChild(m);
    });
  }

  function paintReveal(counts, fastest) {
    var q = current(), total = Math.max(1, Object.keys(G.answers).length);
    var ans = U.q("#answers"); if (!ans) return;
    U.qa(".opt", ans).forEach(function (o, i) {
      o.classList.toggle("right", i === q.c);
      U.q(".cnt", o).textContent = counts[i];
      later(function () { U.q(".bar", o).style.width = Math.round(100 * counts[i] / total) + "%"; }, 150);
    });
    ans.classList.add("revealed");
    var tm = U.q("#timer"); if (tm) tm.style.opacity = ".25";
    var tray = U.q(".lockedtray");
    if (tray) {
      if (fastest) {
        tray.outerHTML = '<div class="fastest" style="--pc:' + fastest.p.color + '"><span class="bolt">&#9889;</span><div class="av">' + avatarImg(fastest.p) + '</div>' +
          '<div><div class="eyebrow">Fastest right answer</div><div class="nm">' + U.esc(fastest.p.name) + '</div></div><div class="ms">' + U.fmtMs(fastest.ms) + '</div></div>';
      } else {
        tray.outerHTML = '<div class="fastest"><span class="bolt">&#128556;</span><div><div class="eyebrow">Nobody got it</div><div class="nm">Tough one.</div></div></div>';
      }
    }
    var h = U.q("#ctlhint"); if (h) h.textContent = "Space: " + ((isLast() || current().tiebreak || (G.qi + 1) % G.settings.boardEvery === 0) ? "leaderboard" : "next question");
  }

  function paintBoard() {
    var r = ranked(), top = r.slice(0, 10), last = isLast(), tie = last && tiedAtTop() && tiebreakerLeft();
    var q = current();
    U.render(topbar() + '<div class="stage"><div class="board">' +
      '<div class="title rise"><div class="display">Leader<span class="gold">board</span></div>' +
        '<div class="serif">' + (tie ? "Tied at the top. Tiebreaker time." : last ? "Final standings. Winner next..." : "After question " + (G.qi + 1) + " of " + G.qs.length + " · " + U.esc(q.roundName)) + '</div>' +
        '<div class="after">' + r.length + ' players &middot; ' + (last ? "all questions done" : (G.qs.length - G.qi - 1) + ' questions left') + '</div></div>' +
      '<div class="rows" id="rows"></div>' +
    '</div></div>' + controls(), "host");
    bindControls(tie ? "Space: tiebreaker" : last ? "Space: reveal the winner" : "Space: next question");
    if (tie) { var nb = U.q("#nextBtn"); if (nb) nb.textContent = "Tiebreaker"; }
    var rows = U.q("#rows"), H = rows.clientHeight || 500;
    var gap = 8, rh = Math.min(66, Math.floor((H - gap * (top.length - 1)) / Math.max(1, top.length)));
    top.forEach(function (p, i) {
      var prev = (G.prevRank[p.pid] || top.length + 2) - 1;
      var row = document.createElement("div");
      row.className = "row" + (i === 0 ? " top1" : "") + (prev >= 10 ? " enter" : "");
      row.style.setProperty("--pc", p.color);
      row.style.height = rh + "px";
      row.style.top = (Math.min(prev, top.length + 1) * (rh + gap)) + "px";
      row.innerHTML = '<div class="rk">' + (i + 1) + '</div><div class="av">' + avatarImg(p) + '</div><div class="nm">' + U.esc(p.name) + '</div>' +
        '<div class="delta' + (p.lastGain ? "" : " zero") + '">' + (p.lastGain ? "+" + U.fmtScore(p.lastGain) : "+0") + '</div><div class="sc">' + U.fmtScore(p.score - p.lastGain) + '</div>';
      rows.appendChild(row);
      later(function () {
        row.style.top = (i * (rh + gap)) + "px";
        U.q(".delta", row).classList.add("show");
        U.countUp(U.q(".sc", row), p.score - p.lastGain, p.score, 900);
      }, 120 + i * 60);
    });
  }

  function paintPodium() {
    var r = ranked(), p1 = r[0], p2 = r[1], p3 = r[2];
    function stand(p, cls, n) {
      if (!p) return "";
      return '<div class="stand ' + cls + '" style="--pc:' + p.color + '"><div class="who"><div class="av">' + avatarImg(p) + '</div><div class="nm">' + U.esc(p.name) + '</div><div class="sc">' + U.fmtScore(p.score) + '</div></div><div class="block">' + n + '</div></div>';
    }
    U.render(topbar() + '<div class="stage"><div class="podium">' +
      '<div class="title"><div class="serif rise">One last chapter meeting.</div><div class="display rise d1">One <span class="gold">winner.</span></div></div>' +
      '<div class="stands">' + stand(p2, "p2", 2) + stand(p1, "p1", 1) + stand(p3, "p3", 3) + '</div>' +
      (r.length > 3 ? '<div class="rest">' + r.slice(3, 15).map(function (p, i) {
        return '<div class="pcard" style="--pc:' + p.color + ';animation-delay:' + (2 + i * 0.08) + 's"><div class="av">' + avatarImg(p) + '</div><span class="rk">' + (i + 4) + '</span><div class="nm">' + U.esc(p.name) + '</div></div>';
      }).join("") + '</div>' : "") +
    '</div></div>' + controls(), "host");
    bindControls("Game over");
    var nb = U.q("#nextBtn"); if (nb) nb.textContent = "Play again";
    U.on("#nextBtn", "click", function () { location.reload(); });
  }

  /* ---------------- bots (testing) ---------------- */
  function addBots(n) {
    for (var i = 0; i < n; i++) {
      var pid = "bot" + (G.nextSeq++);
      var nm = BOT_NAMES[(G.order.length) % BOT_NAMES.length] + (G.order.length >= BOT_NAMES.length ? " " + (G.order.length + 1) : "");
      G.players[pid] = {
        pid: pid, name: nm, avatar: window.AVATAR.randomFace(G.order.length * 17 + 3), color: U.PLAYER_COLORS[G.order.length % U.PLAYER_COLORS.length],
        score: 0, correct: 0, totalMs: 0, streak: 0, lastGain: 0, connected: true, joined: Date.now() + i, bot: true, skill: 0.4 + Math.random() * 0.5
      };
      G.order.push(pid);
    }
    onRosterChange();
  }
  function botsAnswer() {
    var q = current(), limitMs = q.t * 1000, qi = G.qi;
    allPlayers().filter(function (p) { return p.bot; }).forEach(function (p) {
      var delay = 600 + Math.random() * Math.min(limitMs * 0.8, 9000);
      later(function () {
        if (G.phase !== "ask" || G.qi !== qi) return;
        var right = Math.random() < p.skill;
        var choice = right ? q.c : [0, 1, 2, 3].filter(function (k) { return k !== q.c; })[(Math.random() * 3) | 0];
        if (Math.random() < 0.08) return; // some people never tap
        takeAnswer(p.pid, { q: qi, choice: choice, ms: Date.now() - G.askStart });
      }, delay);
    });
  }

  /* ---------------- boot ---------------- */
  function start() {
    G = fresh();
    paintLobby();
    startNet();
    var bots = parseInt(params.get("bots") || "0", 10);
    if (bots > 0) later(function () { addBots(Math.min(bots, 60)); }, 300);
    document.addEventListener("keydown", function (e) {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowRight") { e.preventDefault(); advance(); }
      if (e.key === "m" || e.key === "M") { var b = U.q("#muteBtn"); if (b) b.click(); }
    });
    window.addEventListener("resize", function () { var r = U.q("#roster"); if (r) fitRoster(r); });
    window.TRIVIA = {
      state: function () { return G; },
      next: advance, skip: advance,
      addBots: addBots,
      jumpToEnd: function () { if (G.phase === "lobby") startGame(); clearTimers(); stopTick(); G.qi = G.qs.length - 1; winner(); },
      board: board, winner: winner, podium: podium
    };
  }

  window.HOST = { start: start };
})();
