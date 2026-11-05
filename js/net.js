const Net = (() => {
  const PREFIX = "nave-";
  let peer = null;
  let conn = null;
  let role = "";
  let code = "";
  let mate = null;
  let handler = function () {};
  let retries = 0;
  let token = 0;

  function emit(type, extra) {
    handler(type, extra || {});
  }

  function destroyPeer() {
    try {
      if (conn) conn.close();
    } catch (err) {}
    try {
      if (peer) peer.destroy();
    } catch (err) {}
    peer = null;
    conn = null;
  }

  function failMessage(err) {
    const type = err && err.type;
    if (type === "peer-unavailable") return "Sala não encontrada. Confira o código.";
    if (type === "unavailable-id") return "Esse código já está em uso. Crie outro.";
    if (type === "invalid-id") return "Código inválido.";
    if (type === "browser-incompatible") return "Este navegador não abre a sala.";
    return "Sem ligação com a sala. Tente de novo.";
  }

  function wire(c) {
    conn = c;
    c.on("data", (msg) => {
      if (!msg || typeof msg.t !== "string") return;
      if (msg.t === "hello") {
        mate = {
          name: String(msg.name || "Piloto").slice(0, 16),
          shipId: msg.shipId === "dardo" || msg.shipId === "bastiao" ? msg.shipId : "lanca",
        };
        emit("peer", mate);
      } else if (msg.t === "ship" || msg.t === "shot" || msg.t === "world" || msg.t === "down") {
        emit(msg.t, msg);
      }
    });
    c.on("close", () => emit("gone", {}));
    c.on("error", () => emit("gone", {}));
  }

  function openPeer(id, isHost) {
    if (typeof Peer !== "function") {
      emit("fail", { message: "Rede indisponível neste navegador." });
      return;
    }
    const mine = ++token;
    peer = new Peer(id);
    peer.on("open", () => {
      if (mine !== token) return;
      emit("ready", { code });
      if (!isHost) {
        const link = peer.connect(PREFIX + code, { reliable: true });
        wire(link);
        link.on("open", () => {
          if (mine !== token) return;
          emit("joined", {});
        });
      }
    });
    if (isHost) {
      peer.on("connection", (incoming) => {
        if (mine !== token) return;
        if (conn && conn.open) {
          incoming.close();
          return;
        }
        wire(incoming);
        incoming.on("open", () => emit("joined", {}));
      });
    }
    peer.on("error", (err) => {
      if (mine !== token) return;
      if (isHost && err && err.type === "unavailable-id" && retries < 3) {
        retries += 1;
        code = makeCode();
        destroyPeer();
        emit("ready", { code });
        openPeer(PREFIX + code, true);
        return;
      }
      emit("fail", { message: failMessage(err) });
    });
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
    retries = 0;
    openPeer(PREFIX + code, true);
  }

  function join(roomCode) {
    leave();
    role = "guest";
    code = String(roomCode || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4);
    openPeer(PREFIX + "g" + code + makeCode(), false);
  }

  function send(msg) {
    if (conn && conn.open) conn.send(msg);
  }

  function leave() {
    token += 1;
    destroyPeer();
    role = "";
    mate = null;
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
