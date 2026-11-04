const Save = (() => {
  const KEY = "space-survivor-save-v2";
  const MAX_BOARD = 10;

  function blank() {
    return {
      name: "",
      shipId: "lanca",
      story: { nextStage: 1, campaignScore: 0, cleared: 0 },
      survivalBoard: [],
      storyBoard: [],
      session: null,
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

  return { load, setName, setShip, saveStory, saveSession, clearSession, hasSession, pushBoard };
})();
