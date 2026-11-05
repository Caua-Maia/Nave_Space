const Net = (() => {
  let socket = null;
  let role = "";
  let code = "";
  let mate = null;
  let handler = function () {};
  let ref = 0;
  let joinRef = "";
  let topic = "";
  let heartbeat = 0;
  let token = 0;
  let open = false;
  let joinTries = 0;

  function emit(type, extra) {
    handler(type, extra || {});
  }

  function failMessage(text) {
    const msg = String(text || "");
    if (role === "host") return "Não deu para abrir a sala. Tente de novo.";
    if (/not found|does not exist|unauthorized|403/i.test(msg)) return "Não deu para entrar. Confira o código.";
    return "Sem ligação com a sala. Tente de novo.";
  }

  function sendRaw(event, payload, useJoin) {
    if (!socket || socket.readyState !== 1) return;
    ref += 1;
    socket.send(
      JSON.stringify({
        topic: event === "heartbeat" ? "phoenix" : topic,
        event,
        payload: payload || {},
        ref: String(ref),
        join_ref: useJoin === false ? null : joinRef,
      })
    );
  }

  function frame(raw) {
    if (Array.isArray(raw)) {
      return { join_ref: raw[0], ref: raw[1], topic: raw[2], event: raw[3], payload: raw[4] || {} };
    }
    return raw || {};
  }

  function onFrame(msg) {
    if (msg.event === "heartbeat") return;
    if (msg.event === "phx_reply" && msg.topic === "phoenix") return;
    if (msg.event === "phx_reply" && msg.ref === joinRef) {
      const status = msg.payload && msg.payload.status;
      if (status === "ok") {
        open = true;
        joinTries = 0;
        emit("ready", { code });
        emit("joined", {});
        return;
      }
      const reason = msg.payload && (msg.payload.response || msg.payload);
      const text = typeof reason === "string" ? reason : JSON.stringify(reason || {});
      if (/MissingPartition/i.test(text) && joinTries < 4 && socket && socket.readyState === 1) {
        joinTries += 1;
        setTimeout(() => sendJoin(), 500);
        return;
      }
      emit("fail", { message: failMessage(text) });
      return;
    }
    if (msg.event === "broadcast") {
      const body = msg.payload && msg.payload.payload;
      const name = msg.payload && msg.payload.event;
      if (name !== "game" || !body || typeof body.t !== "string") return;
      if (body.t === "hello") {
        mate = {
          name: String(body.name || "Piloto").slice(0, 16),
          shipId: body.shipId === "dardo" || body.shipId === "bastiao" ? body.shipId : "lanca",
        };
        emit("peer", mate);
      } else {
        emit(body.t, body);
      }
    }
    if (msg.event === "phx_error" || msg.event === "phx_close") emit("gone", {});
  }

  function closeSocket() {
    open = false;
    clearInterval(heartbeat);
    heartbeat = 0;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      try {
        socket.close();
      } catch (err) {}
    }
    socket = null;
  }

  function sendJoin() {
    if (!socket || socket.readyState !== 1) return;
    joinRef = String(++ref);
    socket.send(
      JSON.stringify({
        topic,
        event: "phx_join",
        payload: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { enabled: false },
            postgres_changes: [],
            private: false,
          },
          access_token: Cloud.key(),
        },
        ref: joinRef,
        join_ref: joinRef,
      })
    );
  }

  function connect() {
    if (!Cloud.key() || Cloud.key().indexOf("PENDING") === 0) {
      emit("fail", { message: "Sala sem servidor. Tente de novo em instantes." });
      return;
    }
    const mine = ++token;
    topic = "realtime:sala:" + code;
    joinTries = 0;
    const ws =
      Cloud.url().replace("https://", "wss://") +
      "/realtime/v1/websocket?apikey=" +
      encodeURIComponent(Cloud.key()) +
      "&vsn=1.0.0";
    socket = new WebSocket(ws);
    socket.onopen = () => {
      if (mine !== token) return;
      sendJoin();
      heartbeat = setInterval(() => sendRaw("heartbeat", {}, false), 25000);
    };
    socket.onmessage = (event) => {
      if (mine !== token) return;
      let msg = null;
      try {
        msg = frame(JSON.parse(event.data));
      } catch (err) {
        return;
      }
      onFrame(msg);
    };
    socket.onerror = () => {
      if (mine !== token || open) return;
      emit("fail", { message: "Sem ligação com a sala. Tente de novo." });
    };
    socket.onclose = () => {
      if (mine !== token) return;
      if (open) emit("gone", {});
      open = false;
    };
  }

  function makeCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 4; i++) out += alphabet[(Math.random() * alphabet.length) | 0];
    return out;
  }

  function host(roomCode) {
    leave();
    role = "host";
    code = String(roomCode || makeCode()).toUpperCase();
    connect();
  }

  function join(roomCode) {
    leave();
    role = "guest";
    code = String(roomCode || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4);
    connect();
  }

  function send(msg) {
    if (!open) return;
    sendRaw("broadcast", { type: "broadcast", event: "game", payload: msg });
  }

  function leave() {
    token += 1;
    if (socket && socket.readyState === 1 && joinRef) {
      try {
        sendRaw("phx_leave", {});
      } catch (err) {}
    }
    closeSocket();
    role = "";
    mate = null;
    code = "";
  }

  return {
    on(fn) {
      handler = typeof fn === "function" ? fn : handler;
    },
    host,
    join,
    send,
    leave,
    makeCode,
    role() {
      return role;
    },
    code() {
      return code;
    },
    mate() {
      return mate;
    },
  };
})();
