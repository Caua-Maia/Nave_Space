const ScoreIntegrity = (() => {
  const SALT = ["NaveSpace", "score", "v1", "8f3c2a1e9b4d7c6f"].join("-");

  function hexFromBuffer(buf) {
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function token(mode, score, playSeconds, pilotId) {
    const m = mode === "story" ? "story" : "survival";
    const sc = Math.max(0, score | 0);
    const sec = Math.max(0, playSeconds | 0);
    const pid = String(pilotId || "").trim().toLowerCase();
    if (!pid) return Promise.resolve("");
    const payload = m + "|" + sc + "|" + sec + "|" + pid + "|" + SALT;
    if (typeof crypto !== "undefined" && crypto.subtle && typeof TextEncoder !== "undefined") {
      const data = new TextEncoder().encode(payload);
      return crypto.subtle.digest("SHA-256", data).then(hexFromBuffer).catch(() => "");
    }
    return Promise.resolve("");
  }

  return { token };
})();
