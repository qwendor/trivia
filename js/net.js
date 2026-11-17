/* SHRM TRIVIA NIGHT - networking through the relay worker (plain WebSockets, no peer-to-peer).
   Campus Wi-Fi blocks phones from talking to the laptop directly, so every message goes
   phone -> relay -> big screen and back. The relay is a Cloudflare Worker (see relay/).
   Same API the host and player code always used:
     NET.host(cb)  -> { code, send(pid,msg), broadcast(msg), isConnected(pid), destroy() }
     NET.join(code, cb) -> { send(msg), isOpen(), destroy() }
   Both sides ping the relay every few seconds and reconnect on their own if the pongs stop,
   because a dropped Wi-Fi link does not always close the socket. */
(function () {
  "use strict";

  var ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I O 0 1
  var PING_MS = 6000;
  var PONG_TIMEOUT = 20000;
  var RELAY = (new URLSearchParams(location.search).get("relay") || "wss://shrmtrivia-relay.coopermeidinger1.workers.dev").replace(/\/$/, "");

  function code(n) {
    var s = "";
    for (var i = 0; i < (n || 4); i++) s += ALPHA[(Math.random() * ALPHA.length) | 0];
    return s;
  }
  function parse(data) { try { var m = JSON.parse(data); return m && typeof m === "object" ? m : null; } catch (e) { return null; } }

  /* Heartbeat: ping the relay, and if pongs stop, kill the socket so the reconnect logic runs. */
  function heartbeat(getWs, onDead) {
    var lastPong = Date.now(), iv;
    iv = setInterval(function () {
      var ws = getWs();
      if (!ws || ws.readyState !== 1) return;
      if (Date.now() - lastPong > PONG_TIMEOUT) { try { ws.close(); } catch (e) {} onDead(); return; }
      try { ws.send('{"t":"ping"}'); } catch (e) {}
    }, PING_MS);
    return { pong: function () { lastPong = Date.now(); }, reset: function () { lastPong = Date.now(); }, stop: function () { clearInterval(iv); } };
  }

  /* ------------------------------------------------------------------
     HOST
     ------------------------------------------------------------------ */
  function host(cb) {
    var ws = null, roomCode = code(4), dead = false, readyOnce = false, retryT = 0, attempts = 0, up = false;
    var cidToPid = {}, pidToCid = {};
    var hb = heartbeat(function () { return ws; }, function () { linkDown(); });

    function linkDown() {
      if (!up) return;
      up = false;
      cb.onLink && cb.onLink(false);
    }
    function boot() {
      if (dead) return;
      var sock;
      try { sock = new WebSocket(RELAY + "/room/" + roomCode + "?role=host"); } catch (e) { schedule(); return; }
      ws = sock;
      sock.onmessage = function (ev) {
        if (sock !== ws) return;
        var env = parse(ev.data); if (!env) return;
        if (env.t === "pong") { hb.pong(); return; }
        if (env.t === "_ready") {
          attempts = 0; up = true; hb.reset();
          if (!readyOnce) { readyOnce = true; cb.onReady && cb.onReady(roomCode); }
          cb.onLink && cb.onLink(true);
          return;
        }
        if (env.t === "_close") {
          var gonePid = cidToPid[env.from];
          if (gonePid) { delete cidToPid[env.from]; if (pidToCid[gonePid] === env.from) delete pidToCid[gonePid]; cb.onLeave && cb.onLeave(gonePid); }
          return;
        }
        if (!env.from || !env.msg || typeof env.msg !== "object") return;
        var msg = env.msg;
        if (msg.t === "join") {
          var pid = cb.onJoin ? cb.onJoin(msg) : null;
          if (!pid) return;
          var oldCid = pidToCid[pid];
          if (oldCid && oldCid !== env.from) delete cidToPid[oldCid];
          cidToPid[env.from] = pid; pidToCid[pid] = env.from;
          return;
        }
        var bound = cidToPid[env.from];
        if (!bound) return;
        if (msg.t === "ping") return;
        cb.onMsg && cb.onMsg(bound, msg);
      };
      sock.onclose = function () { if (sock !== ws) return; linkDown(); if (!dead) schedule(); };
      sock.onerror = function () {};
    }
    function schedule() {
      attempts++;
      clearTimeout(retryT);
      retryT = setTimeout(boot, Math.min(600 + attempts * 500, 4000));
      if (attempts === 4 && cb.onError) cb.onError({ type: "network" });
    }

    boot();

    return {
      get code() { return roomCode; },
      isConnected: function (pid) { return !!pidToCid[pid]; },
      isUp: function () { return up; },
      send: function (pid, msg) {
        var cid = pidToCid[pid];
        if (!cid || !ws || ws.readyState !== 1) return false;
        try { ws.send(JSON.stringify({ to: cid, msg: msg })); return true; } catch (e) { return false; }
      },
      broadcast: function (msg) {
        if (!ws || ws.readyState !== 1) return;
        try { ws.send(JSON.stringify({ to: "*", msg: msg })); } catch (e) {}
      },
      destroy: function () { dead = true; hb.stop(); clearTimeout(retryT); try { ws.close(); } catch (e) {} }
    };
  }

  /* ------------------------------------------------------------------
     PLAYER
     ------------------------------------------------------------------ */
  function join(roomCode, cb) {
    var ws = null, dead = false, attempts = 0, retryT = 0, open = false;
    var target = RELAY + "/room/" + String(roomCode || "").toUpperCase() + "?role=player";
    var hb = heartbeat(function () { return ws; }, function () { fail("silent"); });

    function fail(reason) {
      if (dead) return;
      var wasOpen = open;
      open = false;
      if (wasOpen) cb.onDrop && cb.onDrop(reason);
      schedule();
    }
    function schedule() {
      if (dead) return;
      attempts++;
      if (attempts > 80) { cb.onGiveUp && cb.onGiveUp(); return; }
      clearTimeout(retryT);
      retryT = setTimeout(boot, Math.min(800 + attempts * 500, 5000));
    }
    function boot() {
      if (dead) return;
      var sock;
      try { if (ws) { ws.onclose = null; ws.close(); } } catch (e) {}
      try { sock = new WebSocket(target); } catch (e) { schedule(); return; }
      ws = sock;
      var guard = setTimeout(function () { if (!open && sock === ws) { try { sock.close(); } catch (e) {} } }, 12000);
      sock.onmessage = function (ev) {
        if (sock !== ws) return;
        var m = parse(ev.data); if (!m) return;
        if (m.t === "pong") { hb.pong(); return; }
        if (m.t === "_noroom") { clearTimeout(guard); cb.onNoRoom && cb.onNoRoom(); return; }
        if (m.t === "_hello") {
          clearTimeout(guard);
          open = true; attempts = 0; hb.reset();
          cb.onOpen && cb.onOpen();
          return;
        }
        cb.onMsg && cb.onMsg(m);
      };
      sock.onclose = function () { if (sock !== ws) return; clearTimeout(guard); if (open) fail("closed"); else schedule(); };
      sock.onerror = function () {};
    }

    boot();

    return {
      send: function (msg) {
        if (ws && ws.readyState === 1 && open) { try { ws.send(JSON.stringify(msg)); return true; } catch (e) {} }
        return false;
      },
      isOpen: function () { return !!(ws && ws.readyState === 1 && open); },
      destroy: function () { dead = true; hb.stop(); clearTimeout(retryT); try { ws.close(); } catch (e) {} }
    };
  }

  window.NET = { host: host, join: join, code: code, ALPHA: ALPHA, RELAY: RELAY };
})();
