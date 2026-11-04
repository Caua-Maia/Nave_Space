const Save = (() => {
  const KEY = "space-survivor-save-v2";
  const MAX_BOARD = 10;

  function defaultOptions() {
    return {
      volume: 70,
      music: false,
      vibrate: true,
      stickSize: "m",
      layout: {
        vital: { x: 2, y: 2 },
        score: { x: 2, y: 16 },
        combo: { x: 2, y: 26 },
        wave: { x: 36, y: 2 },
        objective: { x: 28, y: 7 },
        time: { x: 74, y: 2 },
        pad: { x: 58, y: 11 },
        boss: { x: 22, y: 74 },
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
      layout,
    };
  }

  function blank() {
    return {
      name: "",
      shipId: "lanca",
      story: { nextStage: 1, campaignScore: 0, cleared: 0 },
      survivalBoard: [],
      storyBoard: [],
      session: null,
      options: defaultOptions(),
    };
  }

  function load() {
    try {
      let raw = localStorage.getItem(KEY);
      if (!raw) {
        raw = localStorage.getItem("space-survivor-save-v1");
      }
      if (!raw) return blank();
      const data = JSON.parse(raw);
      const base = blank();
      return {
        name: typeof data.name === "string" ? data.name.slice(0, 16) : "",
        shipId: data.shipId === "dardo" || data.shipId === "bastiao" ? data.shipId : "lanca",
        story: { ...base.story, ...(data.story || {}) },
        survivalBoard: Array.isArray(data.survivalBoard) ? data.survivalBoard : [],
        storyBoard: Array.isArray(data.storyBoard) ? data.storyBoard : [],
        session: data.session && data.session.v === 2 ? data.session : null,
        options: mergeOptions(data.options),
      };
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
      name: (entry.name || data.name || "ANÔNIMO").slice(0, 16),
      score: entry.score | 0,
      extra: entry.extra || "",
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
    data.options = mergeOptions(options);
    write(data);
    return data.options;
  }

  return { load, setName, setShip, setOptions, defaultOptions, saveStory, saveSession, clearSession, hasSession, pushBoard };
})();
