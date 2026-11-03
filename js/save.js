const Save = (() => {
  const KEY = "space-survivor-save-v1";
  const MAX_BOARD = 10;

  function blank() {
    return {
      name: "",
      story: { nextStage: 1, campaignScore: 0, cleared: 0 },
      survivalBoard: [],
      storyBoard: [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const data = JSON.parse(raw);
      const base = blank();
      return {
        name: typeof data.name === "string" ? data.name.slice(0, 16) : "",
        story: { ...base.story, ...(data.story || {}) },
        survivalBoard: Array.isArray(data.survivalBoard) ? data.survivalBoard : [],
        storyBoard: Array.isArray(data.storyBoard) ? data.storyBoard : [],
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

  function saveStory(story) {
    const data = load();
    data.story = { ...data.story, ...story };
    write(data);
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

  return { load, setName, saveStory, pushBoard };
})();
