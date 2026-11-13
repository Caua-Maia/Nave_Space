const Save = (() => {
  const KEY = "space-survivor-save-v3";
  const OLD_KEYS = ["space-survivor-save-v2", "space-survivor-save-v1"];
  const MAX_BOARD = 10;

  function defaultOptions() {
    return {
      volume: 70,
      music: false,
      vibrate: true,
      stickSize: "m",
      touchMode: "fixed",
      showCoop: false,
      layoutCustom: false,
      layout: {
        vital: { x: 2, y: 2 },
        wave: { x: 2, y: 17 },
        objective: { x: 2, y: 25 },
        pad: { x: 2, y: 34 },
        score: { x: 36, y: 2 },
        combo: { x: 58, y: 2 },
        time: { x: 82, y: 2 },
        boss: { x: 34, y: 82 },
        bossMega: { x: 28, y: 68 },
        stickL: { x: 4, y: 70 },
        stickR: { x: 72, y: 70 },
        pause: { x: 38, y: 1 },
        full: { x: 62, y: 1 },
      },
    };
  }

  function spot(raw, fallback) {
    const x = raw && Number(raw.x);
    const y = raw && Number(raw.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: fallback.x, y: fallback.y };
    return {
      x: Math.max(0, Math.min(96, x)),
      y: Math.max(0, Math.min(96, y)),
    };
  }

  function mergeOptions(raw) {
    const base = defaultOptions();
    const src = raw && typeof raw === "object" ? raw : {};
    const layout = {};
    const saved = src.layout && typeof src.layout === "object" ? src.layout : {};
    Object.keys(base.layout).forEach((key) => {
      layout[key] = spot(saved[key], base.layout[key]);
    });
    const volume = Number(src.volume);
    return {
      volume: Number.isFinite(volume) ? Math.max(0, Math.min(100, volume)) : base.volume,
      music: src.music === true,
      vibrate: src.vibrate !== false,
      stickSize: src.stickSize === "p" || src.stickSize === "g" ? src.stickSize : "m",
      touchMode: src.touchMode === "follow" || src.touchMode === "split" ? src.touchMode : "fixed",
      showCoop: src.showCoop === true,
      introSeen: src.introSeen === true,
      layoutCustom: src.layoutCustom === true,
      layout,
    };
  }

  function newPilotId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
      const r = (Math.random() * 16) | 0;
      const v = ch === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function normalizePilotId(value) {
    const s = String(value || "")
      .trim()
      .toLowerCase();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s)) return s;
    return "";
  }

  function pilotTag(id) {
    const s = normalizePilotId(id);
    if (!s) return "";
    return s.slice(-4).toUpperCase();
  }

  function blank() {
    return {
      pilotId: newPilotId(),
      name: "",
      shipId: "lanca",
      story: { nextStage: 1, campaignScore: 0, cleared: 0 },
      survivalBoard: [],
      storyBoard: [],
      session: null,
      options: defaultOptions(),
    };
  }

  function packFromRaw(data) {
    const base = blank();
    const src = data && typeof data === "object" ? data : {};
    return {
      pilotId: normalizePilotId(src.pilotId) || newPilotId(),
      name: typeof src.name === "string" ? src.name.slice(0, 16) : "",
      shipId: src.shipId === "dardo" || src.shipId === "bastiao" ? src.shipId : "lanca",
      story: { ...base.story, ...(src.story || {}) },
      survivalBoard: Array.isArray(src.survivalBoard) ? src.survivalBoard : [],
      storyBoard: Array.isArray(src.storyBoard) ? src.storyBoard : [],
      session: src.session && src.session.v === 2 ? src.session : null,
      options: mergeOptions(src.options),
    };
  }

  function wipeLegacy() {
    try {
      OLD_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch (err) {}
  }

  function load() {
    wipeLegacy();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const data = JSON.parse(raw);
      const packed = packFromRaw(data);
      if (!normalizePilotId(data.pilotId)) write(packed);
      return packed;
    } catch {
      return blank();
    }
  }

  function write(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function setName(name) {
    const data = load();
    data.name = String(name || "")
      .trim()
      .slice(0, 16);
    write(data);
    return data.name;
  }

  function setShip(id) {
    const data = load();
    data.shipId = id === "dardo" || id === "bastiao" ? id : "lanca";
    write(data);
    return data.shipId;
  }

  function saveStory(story) {
    const data = load();
    data.story = { ...data.story, ...story };
    write(data);
  }

  function saveSession(session) {
    const data = load();
    data.session = session;
    write(data);
  }

  function clearSession() {
    const data = load();
    data.session = null;
    write(data);
  }

  function hasSession() {
    return !!load().session;
  }

  function pushBoard(kind, entry) {
    const data = load();
    const list = kind === "story" ? data.storyBoard : data.survivalBoard;
    list.push({
      pilotId: normalizePilotId(entry.pilotId) || data.pilotId,
      name: (entry.name || data.name || "ANÔNIMO").slice(0, 16),
      score: entry.score | 0,
      extra: entry.extra || "",
      shipId: entry.shipId || data.shipId || "lanca",
      date: Date.now(),
    });
    list.sort((a, b) => b.score - a.score);
    const trimmed = list.slice(0, MAX_BOARD);
    if (kind === "story") data.storyBoard = trimmed;
    else data.survivalBoard = trimmed;
    write(data);
    return trimmed;
  }

  function setOptions(options) {
    const data = load();
    data.options = mergeOptions({ ...data.options, ...(options || {}) });
    write(data);
    return data.options;
  }

  function getPilotId() {
    return load().pilotId;
  }

  return {
    load,
    getPilotId,
    pilotTag,
    setName,
    setShip,
    setOptions,
    defaultOptions,
    saveStory,
    saveSession,
    clearSession,
    hasSession,
    pushBoard,
  };
})();
