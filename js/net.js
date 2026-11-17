/* SHRM TRIVIA NIGHT - networking through the relay worker (plain WebSockets, no peer-to-peer).
   Campus Wi-Fi blocks phones from talking to the laptop directly, so every message goes
   phone -> relay -> big screen and back. The relay is a Cloudflare Worker (see relay/).
   Same API the host and player code always used:
     NET.host(cb)  -> { code, send(pid,msg), broadcast(msg), isConnected(pid), destroy() }
     NET.join(code, cb) -> { send(msg), isOpen(), destroy() } */
(function () {
  "use strict";

  var ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I O 0 1
  var PING_MS = 7000;
  var RELAY = (new URLSearchParams(location.search).get("relay") || "wss://shrmtrivia-relay.coopermeidinger1.workers.dev").replace(/\/$/, "");

  function code(n) {
    var s = "";
    for (var i = 0; i < (n || 4); i++) s += ALPHA[(Math.random() * ALPHA.length) | 0];
    return s;
  }
  function parse(data) { try { var m = JSON.parse(data); return m && typeof m === "object" ? m : null; } catch (e) { return null; } }

  /* ------------------------------------------------------------------
     HOST
     ------------------------------------------------------------------ */
  function host(cb) {
    var ws = null, roomCode = code(4), dead = false, readyOnce = false, retryT = 0, attempts = 0;
    var cidToPid = {}, pidToCid = {};

    function boot() {
      if (dead) return;
      try { ws = new WebSocket(RELAY + "/room/" + roomCode + "?role=host"); } catch (e) { schedule(); return; }
      ws.onmessage = function (ev) {
        var env = parse(ev.data); if (!env) return;
        if (env.t === "_ready") {
          attempts = 0;
          if (!readyOnce) { readyOnce = true; cb.onReady && cb.onReady(roomCode); }
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
      ws.onclose = function () { if (!dead) schedule(); };
      ws.onerror = function () {};
    }
    function schedule() {
      attempts++;
      clearTimeout(retryT);
      retryT = setTimeout(boot, Math.min(800 + attempts * 600, 5000));
      if (attempts === 3 && cb.onError) cb.onError({ type: "network" });
    }

    boot();

    return {
      get code() { return roomCode; },
      isConnected: function (pid) { return !!pidToCid[pid]; },
      send: function (pid, msg) {
        var cid = pidToCid[pid];
        if (!cid || !ws || ws.readyState !== 1) return false;
        try { ws.send(JSON.stringify({ to: cid, msg: msg })); return true; } catch (e) { return false; }
      },
      broadcast: function (msg) {
        if (!ws || ws.readyState !== 1) return;
        try { ws.send(JSON.stringify({ to: "*", msg: msg })); } catch (e) {}
      },
      destroy: function () { dead = true; clearTimeout(retryT); try { ws.close(); } catch (e) {} }
    };
  }

  /* ------------------------------------------------------------------
     PLAYER
     ------------------------------------------------------------------ */
  function join(roomCode, cb) {
    var ws = null, dead = false, attempts = 0, pingT = 0, retryT = 0, open = false;
    var target = RELAY + "/room/" + String(roomCode || "").toUpperCase() + "?role=player";

    function fail(reason) {
      if (dead) return;
      open = false;
      clearInterval(pingT);
      cb.onDrop && cb.onDrop(reason);
      schedule();
    }
    function schedule() {
      if (dead) return;
      attempts++;
      if (attempts > 60) { cb.onGiveUp && cb.onGiveUp(); return; }
      clearTimeout(retryT);
      retryT = setTimeout(boot, Math.min(1000 + attempts * 500, 5000));
    }
    function boot() {
      if (dead) return;
      try { if (ws) { ws.onclose = null; ws.close(); } } catch (e) {}
      try { ws = new WebSocket(target); } catch (e) { fail("network"); return; }
      var guard = setTimeout(function () { if (!open) { try { ws.close(); } catch (e) {} } }, 12000);
      ws.onmessage = function (ev) {
        var m = parse(ev.data); if (!m) return;
        if (m.t === "pong") return;
        if (m.t === "_noroom") { clearTimeout(guard); cb.onNoRoom && cb.onNoRoom(); return; }
        if (m.t === "_hello") {
          clearTimeout(guard);
          open = true; attempts = 0;
          cb.onOpen && cb.onOpen();
          clearInterval(pingT);
          pingT = setInterval(function () { if (ws && ws.readyState === 1) { try { ws.send('{"t":"ping"}'); } catch (e) {} } }, PING_MS);
          return;
        }
        cb.onMsg && cb.onMsg(m);
      };
      ws.onclose = function () { clearTimeout(guard); fail(open ? "closed" : "refused"); };
      ws.onerror = function () {};
    }

    boot();

    return {
      send: function (msg) {
        if (ws && ws.readyState === 1 && open) { try { ws.send(JSON.stringify(msg)); return true; } catch (e) {} }
        return false;
      },
      isOpen: function () { return !!(ws && ws.readyState === 1 && open); },
      destroy: function () { dead = true; clearInterval(pingT); clearTimeout(retryT); try { ws.close(); } catch (e) {} }
    };
  }

  window.NET = { host: host, join: join, code: code, ALPHA: ALPHA, RELAY: RELAY };
})();
