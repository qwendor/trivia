/* SHRM TRIVIA NIGHT - player (phone). Name + drawing to join, then one tap per question. */
(function () {
  "use strict";
  var U = window.UI;

  var S = { code: "", pid: "", name: "", avatar: "", color: "#F5B32A", phase: "join", n: 0,
    q: null, askedAt: 0, choice: -1, lockedMs: 0, limit: 20000, score: 0 };
  var net = null, tickRAF = 0, pad = null;

  function key(k) { return "shrmq_" + S.code + "_" + k; }
  function save() { try { localStorage.setItem(key("pid"), S.pid); localStorage.setItem(key("name"), S.name); localStorage.setItem(key("avatar"), S.avatar); } catch (e) {} }
  function load() { try { S.pid = localStorage.getItem(key("pid")) || ""; S.name = localStorage.getItem(key("name")) || ""; S.avatar = localStorage.getItem(key("avatar")) || ""; } catch (e) {} }

  function top() {
    return '<div class="top"><div><div class="wordmark">SHRM<b>@</b>VCU</div><div class="eyebrow">Trivia Night &middot; ' + U.esc(S.code) + '</div></div>' +
      (S.name ? '<div class="me" style="--pc:' + S.color + '"><div class="av">' + (S.avatar ? '<img src="' + S.avatar + '" alt="">' : "") + '</div>' + U.esc(S.name) + '</div>' : "") + '</div>' +
      '<div class="conn" id="conn">Reconnecting...</div>';
  }
  function paint(html) { U.render(top() + '<div class="body">' + html + '</div>', "player"); }

  /* ---------------- join ---------------- */
  function paintJoin() {
    S.phase = "join";
    paint(
      '<h1 class="display rise">Trivia<br><span class="gold">Night</span></h1>' +
      '<p class="tag serif rise d1">Put your name in, draw your face, and wait for the screen.</p>' +
      '<form id="joinForm" class="rise d2">' +
        '<label class="eyebrow" for="nameIn">Your name</label>' +
        '<input class="field" id="nameIn" maxlength="16" placeholder="First name" autocomplete="off" value="' + U.esc(S.name) + '">' +
        '<label class="eyebrow">Draw yourself</label>' +
        '<div id="pad"></div>' +
        '<button class="btn gold wide big" type="submit">I\'m in</button>' +
      '</form>'
    );
    pad = window.AVATAR.mount(U.q("#pad"));
    if (S.avatar) pad.load(S.avatar);
    U.on("#joinForm", "submit", function (e) {
      e.preventDefault();
      var name = (U.q("#nameIn").value || "").replace(/\s+/g, " ").trim();
      if (!name) { U.toast("Put your name in first", true); U.q("#nameIn").focus(); return; }
      if (pad.isEmpty()) { U.toast("Draw something, even a smiley", true); U.q(".pad-wrap").classList.add("shake"); setTimeout(function () { U.q(".pad-wrap").classList.remove("shake"); }, 600); return; }
      S.name = name; S.avatar = pad.toDataURL();
      save();
      U.SFX.unlock();
      paintWait("Joining...");
      connect();
    });
  }

  /* ---------------- waiting ---------------- */
  function paintWait(sub) {
    S.phase = "wait";
    paint('<div class="wait">' +
      '<div class="bigav" style="--pc:' + S.color + '">' + (S.avatar ? '<img src="' + S.avatar + '" alt="">' : "") + '</div>' +
      '<div class="display">You\'re <span class="gold">in,</span><br>' + U.esc(S.name) + '</div>' +
      '<div class="serif">Eyes on the big screen.</div>' +
      '<div class="sub pulse" id="waitsub">' + U.esc(sub || "Waiting for the host to start") + '</div>' +
      '<div class="count" id="waitcount"></div>' +
    '</div>');
    paintCount();
  }
  function paintCount() { var el = U.q("#waitcount"); if (el && S.n) el.innerHTML = '<b>' + S.n + '</b> ' + (S.n === 1 ? "player" : "players") + ' in the room'; }

  function paintRound(m) {
    S.phase = "round";
    paint('<div class="pround">' +
      '<div class="eyebrow sky rise">' + (m.tiebreak ? "Sudden death" : "Up next") + '</div>' +
      '<div class="display rise d1">' + (m.tiebreak ? "Tie<span class='gold'>breaker</span>" : "Round <span class='gold'>" + (+m.round || "") + "</span>") + '</div>' +
      '<div class="serif rise d2">' + U.esc(m.name) + '</div>' +
      '<div class="stamp ' + U.esc(m.color) + '"><span>' + U.esc(m.diff) + '</span></div>' +
    '</div>');
    if (navigator.vibrate) try { navigator.vibrate(20); } catch (e) {}
  }
  function paintRead(m) {
    S.phase = "read";
    paint('<div class="wait">' +
      '<div class="eyebrow sky">Question ' + m.n + ' of ' + m.total + '</div>' +
      '<div class="display" style="margin-top:14px">Read the<br><span class="gold">screen</span></div>' +
      '<div class="serif">Answers are coming to your phone...</div>' +
      '<div class="sub">' + U.esc(m.cat) + '</div>' +
    '</div>');
  }

  /* ---------------- answering ---------------- */
  function paintAsk(m) {
    S.phase = "ask"; S.q = m; S.choice = -1; S.limit = m.limit;
    S.askedAt = Date.now() - (m.elapsed || 0);
    paint('<div class="pq">' +
      '<div class="meta"><div class="num">Q <b>' + m.n + '</b> / ' + m.total + '</div><div class="cat ' + m.color + '">' + U.esc(m.cat) + '</div></div>' +
      '<div class="timer" id="timer"><i id="tbar"></i></div>' +
      '<div class="qt">' + U.esc(m.text) + '</div>' +
      '<div class="pbtns" id="pbtns">' + m.a.map(function (t, i) {
        var s = U.SLOTS[i];
        return '<button type="button" class="pbtn ' + s.key + '" data-i="' + i + '"><div class="shape">' + s.svg + '</div><span>' + U.esc(t) + '</span></button>';
      }).join("") + '</div>' +
      '<div id="locked"></div>' +
    '</div>');
    U.on("#pbtns", "click", function (e) {
      var b = e.target.closest(".pbtn"); if (!b || S.choice >= 0) return;
      answer(+b.dataset.i);
    });
    startTick();
  }
  function answer(i) {
    if (S.phase !== "ask" || S.choice >= 0) return;
    S.choice = i; S.lockedMs = Date.now() - S.askedAt;
    var box = U.q("#pbtns"); if (box) { box.classList.add("locked"); var b = U.qa(".pbtn", box)[i]; if (b) b.classList.add("mine"); }
    var l = U.q("#locked"); if (l) l.innerHTML = '<div class="locked rise"><div class="display">Locked in</div><div class="ms">' + U.fmtMs(S.lockedMs) + '</div><div class="sub">Waiting for everyone else</div></div>';
    if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}
    U.SFX.lock();
    net.send({ t: "answer", q: S.q.q, choice: i, ms: S.lockedMs });
  }
  function startTick() { stopTick(); tick(); }
  function stopTick() { if (tickRAF) cancelAnimationFrame(tickRAF); tickRAF = 0; }
  function tick() {
    if (S.phase !== "ask") return;
    var left = S.limit - (Date.now() - S.askedAt), k = Math.max(0, left / S.limit);
    var bar = U.q("#tbar"); if (bar) bar.style.transform = "scaleX(" + k + ")";
    var tm = U.q("#timer"); if (tm) tm.classList.toggle("hot", left < 5000);
    if (left <= 0) {
      if (S.choice < 0) { var box = U.q("#pbtns"); if (box) box.classList.add("locked"); var l = U.q("#locked"); if (l) l.innerHTML = '<div class="locked rise"><div class="display">Time!</div><div class="sub">Look at the screen</div></div>'; }
      return;
    }
    tickRAF = requestAnimationFrame(tick);
  }

  /* ---------------- results ---------------- */
  function paintResult(m) {
    S.phase = "result"; S.score = m.score; stopTick();
    var right = m.right;
    var verdict = !m.answered ? "No answer" : right ? ["Correct!", "Nailed it", "Yes!", "Big brain"][(Math.random() * 4) | 0] : ["Not this time", "Nope", "So close", "Next one"][(Math.random() * 4) | 0];
    paint('<div class="result ' + (right ? "right" : "wrong") + '">' +
      '<div class="verdict display pop">' + U.esc(verdict) + '</div>' +
      '<div class="gained rise d1">' + (right ? "+" + U.fmtScore(m.gained) : "+0") +
        (right ? '<small>' + (m.gained - 1000 > 0 ? "1,000 + " + (m.gained - 1000) + " speed bonus" : "1,000") + '</small>' : "") + '</div>' +
      (!right ? '<div class="ans rise d2">The answer was <b>' + U.esc(m.answer) + '</b></div>' : "") +
      '<div class="rank rise d3"><div><div class="eyebrow">Your rank</div><div class="display">' + U.ordinal(m.rank) + '</div></div>' +
        '<div><div class="eyebrow">Score</div><div class="display" id="myscore">' + U.fmtScore(m.score - m.gained) + '</div></div></div>' +
      (m.streak >= 3 ? '<div class="streak rise d4">' + m.streak + ' in a row. Keep it going.</div>' : "") +
    '</div>');
    U.countUp(U.q("#myscore"), m.score - m.gained, m.score, 900);
    if (right) { U.SFX.right(); if (navigator.vibrate) try { navigator.vibrate([40, 40, 80]); } catch (e) {} } else U.SFX.wrong();
  }

  function paintFinal(m) {
    S.phase = "final"; stopTick();
    var line = m.rank === 1 ? "You won the whole thing." : m.rank <= 3 ? "Podium. Go stand up." : m.rank <= Math.ceil(m.total / 2) ? "Top half. Respectable." : "Thanks for playing.";
    paint('<div class="final">' +
      '<div class="bigav" style="--pc:' + S.color + '">' + (S.avatar ? '<img src="' + S.avatar + '" alt="">' : "") + '</div>' +
      '<div class="eyebrow sky">Final standing</div>' +
      '<div class="place display pop">' + U.ordinal(m.rank) + '</div>' +
      '<div class="serif rise d1">' + line + '</div>' +
      '<div class="sc rise d2">' + U.fmtScore(m.score) + '</div>' +
      '<div class="sub rise d3">' + m.correct + ' of ' + m.qs + ' right &middot; ' + m.total + ' players</div>' +
    '</div>');
    if (m.rank <= 3) { U.confetti({ count: 140 }); U.SFX.fanfare(); }
  }

  /* ---------------- networking ---------------- */
  function connect() {
    if (net) net.destroy();
    net = window.NET.join(S.code, {
      onOpen: function () {
        U.q("#conn") && U.q("#conn").classList.remove("show");
        net.send({ t: "join", name: S.name, avatar: S.avatar, pid: S.pid || undefined });
      },
      onMsg: function (m) {
        if (!m || !m.t) return;
        switch (m.t) {
          case "welcome":
            S.pid = m.pid; S.color = m.color || S.color; S.n = m.n || 0; S.score = m.score || 0; save();
            if (m.phase === "lobby") paintWait();
            break;
          case "lobby": S.n = m.n || 0; if (S.phase === "wait") paintCount(); else if (S.phase === "join") {} else paintWait(); break;
          case "round": paintRound(m); break;
          case "read": paintRead(m); break;
          case "winner": paintWait("Winner reveal on the big screen"); break;
          case "ask": if (!(S.phase === "ask" && S.q && S.q.q === m.q)) paintAsk(m); break;
          case "ack": break;
          case "result": paintResult(m); break;
          case "board": if (S.phase !== "result") paintWait("Leaderboard is on the screen"); else { var el = U.q(".result"); if (el) el.insertAdjacentHTML("beforeend", '<div class="sub rise" style="margin-top:18px;color:var(--mute);font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase">Leaderboard is on the screen</div>'); } break;
          case "final": paintFinal(m); break;
        }
      },
      onNoRoom: function () { U.toast("No game with code " + S.code + " yet. Is the big screen up?", true); },
      onDrop: function () { var c = U.q("#conn"); if (c) c.classList.add("show"); },
      onGiveUp: function () { U.toast("Lost the connection. Reload to try again.", true); },
      onError: function () {}
    });
  }

  function start(code) {
    S.code = code;
    load();
    paintJoin();
    window.TRIVIA_PLAYER = {
      state: function () { return S; },
      answer: answer,
      join: function (name) { S.name = name || "Tester"; S.avatar = window.AVATAR.randomFace(Date.now() % 1000); save(); paintWait("Joining..."); connect(); }
    };
  }

  window.PLAYER = { start: start };
})();
