/* SHRM TRIVIA NIGHT relay.
   One Durable Object per room code. The big screen connects as "host", phones connect as
   "player". Players only ever talk to the host; the host sends to one player or to everyone.
   Nothing is stored: if the host goes away the room is just empty until a host comes back.

   Host  -> relay : {"to": "<cid>" | "*", "msg": {...}}
   Relay -> host  : {"from": "<cid>", "msg": {...}}   or   {"t": "_close", "from": "<cid>"}
   Player -> relay: {...}            (forwarded to the host as-is, wrapped with its cid)
   Relay -> player: {"t": "_hello", "cid": "..."} once, then whatever the host sends.
   Pings ({"t":"ping"}) are answered by the relay itself, so a hibernating room stays cheap. */

export class Room {
  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  fetch(req) {
    if (req.headers.get("Upgrade") !== "websocket") return new Response("expected a websocket", { status: 426 });
    const url = new URL(req.url);
    const role = url.searchParams.get("role") === "host" ? "host" : "player";
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];

    if (role === "host") {
      for (const old of this.ctx.getWebSockets("host")) { try { old.close(4000, "replaced by a newer host"); } catch (e) {} }
      this.ctx.acceptWebSocket(server, ["host"]);
      server.send('{"t":"_ready"}');
    } else if (!this.ctx.getWebSockets("host").length) {
      this.ctx.acceptWebSocket(server, ["player", "c:none"]);
      server.send('{"t":"_noroom"}');
      setTimeout(() => { try { server.close(4001, "no host in this room"); } catch (e) {} }, 50);
    } else {
      const cid = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
      this.ctx.acceptWebSocket(server, ["player", "c:" + cid]);
      server.send(JSON.stringify({ t: "_hello", cid }));
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, data) {
    if (typeof data !== "string" || data.length > 200000) return;
    const tags = this.ctx.getTags(ws);
    let body;
    try { body = JSON.parse(data); } catch (e) { return; }
    if (!body || typeof body !== "object") return;

    if (tags[0] === "host") {
      if (!body.msg) return;
      const payload = JSON.stringify(body.msg);
      const targets = body.to === "*" ? this.ctx.getWebSockets("player") : this.ctx.getWebSockets("c:" + body.to);
      for (const p of targets) { try { p.send(payload); } catch (e) {} }
    } else {
      const cid = (tags[1] || "c:none").slice(2);
      if (cid === "none") return;
      const out = JSON.stringify({ from: cid, msg: body });
      for (const h of this.ctx.getWebSockets("host")) { try { h.send(out); } catch (e) {} }
    }
  }

  webSocketClose(ws) { this.gone(ws); }
  webSocketError(ws) { this.gone(ws); }

  gone(ws) {
    const tags = this.ctx.getTags(ws);
    if (tags[0] !== "player") return;
    const cid = (tags[1] || "c:none").slice(2);
    if (cid === "none") return;
    const out = JSON.stringify({ t: "_close", from: cid });
    for (const h of this.ctx.getWebSockets("host")) { try { h.send(out); } catch (e) {} }
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9]{3,8})$/);
    if (!m) return new Response("SHRM Trivia Night relay is up.", { headers: { "content-type": "text/plain" } });
    const id = env.ROOM.idFromName(m[1].toUpperCase());
    return env.ROOM.get(id).fetch(req);
  }
};
