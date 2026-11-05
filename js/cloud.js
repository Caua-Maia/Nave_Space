const Cloud = (() => {
  const URL = "https://sncenrdjoxbbzvlxyrcj.supabase.co";
  const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuY2VucmRqb3hiYnp2bHh5cmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NDQ4NjEsImV4cCI6MjEwNzUyMDg2MX0.K1sYHW0yhqemlCnf_QcmjIlWSiN9bTCRVT6WfCMLuqQ";
  let timer = 0;

  function headers(extra) {
    return Object.assign(
      {
        apikey: KEY,
        Authorization: "Bearer " + KEY,
        "Content-Type": "application/json",
      },
      extra || {}
    );
  }

  function shipId(id) {
    return id === "dardo" || id === "bastiao" ? id : "lanca";
  }

  function pilotBody(data) {
    const story = data.story || {};
    return {
      name: String(data.name || "").trim().slice(0, 16),
      ship_id: shipId(data.shipId),
      next_stage: Math.max(1, Math.min(8, story.nextStage | 0 || 1)),
      campaign_score: Math.max(0, story.campaignScore | 0),
      cleared: Math.max(0, Math.min(8, story.cleared | 0)),
      options: data.options || {},
      updated_at: new Date().toISOString(),
    };
  }

  function sync() {
    if (KEY.indexOf("PENDING") === 0) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const data = Save.load();
      const body = pilotBody(data);
      if (!body.name) return;
      fetch(URL + "/rest/v1/pilots?on_conflict=name", {
        method: "POST",
        headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(body),
      }).catch(() => {});
    }, 400);
  }

  function pull() {
    if (KEY.indexOf("PENDING") === 0) return Promise.resolve(null);
    const data = Save.load();
    const name = String(data.name || "").trim();
    if (!name) return Promise.resolve(null);
    return fetch(URL + "/rest/v1/pilots?name=eq." + encodeURIComponent(name) + "&select=*", {
      headers: headers(),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((rows) => {
        const row = rows && rows[0];
        if (!row) {
          sync();
          return null;
        }
        const local = Save.load();
        const cloudCleared = row.cleared | 0;
        const localCleared = local.story.cleared | 0;
        const cloudScore = row.campaign_score | 0;
        const localScore = local.story.campaignScore | 0;
        if (cloudCleared > localCleared || (cloudCleared === localCleared && cloudScore >= localScore)) {
          Save.saveStory({
            nextStage: row.next_stage || 1,
            campaignScore: cloudScore,
            cleared: cloudCleared,
          });
        } else {
          sync();
        }
        Save.setShip(shipId(row.ship_id));
        if (row.options && typeof row.options === "object") Save.setOptions(row.options);
        if (typeof Settings !== "undefined") Settings.apply();
        return row;
      })
      .catch(() => null);
  }

  function pushScore(kind, entry) {
    if (KEY.indexOf("PENDING") === 0) return Promise.resolve(false);
    const data = Save.load();
    const name = String(entry.name || data.name || "").trim().slice(0, 16);
    if (!name) return Promise.resolve(false);
    return fetch(URL + "/rest/v1/scores", {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        mode: kind === "story" ? "story" : "survival",
        name,
        score: Math.max(0, entry.score | 0),
        extra: String(entry.extra || "").slice(0, 40),
        ship_id: shipId(data.shipId),
      }),
    })
      .then((res) => res.ok)
      .catch(() => false);
  }

  function dedupeScores(rows) {
    const best = new Map();
    (rows || []).forEach((row) => {
      const name = String(row.name || "ANÔNIMO").slice(0, 16);
      const key = name.toLowerCase();
      const entry = {
        name,
        score: row.score | 0,
        extra: row.extra || "",
        shipId: row.ship_id,
      };
      const cur = best.get(key);
      if (!cur || entry.score > cur.score) best.set(key, entry);
    });
    return Array.from(best.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  function board(mode) {
    const query =
      "/rest/v1/scores?mode=eq." +
      mode +
      "&select=name,score,extra,ship_id&order=score.desc&limit=40";
    return fetch(URL + query, { headers: headers() })
      .then((res) => {
        if (!res.ok) return { ok: false, rows: [] };
        return res.json().then((rows) => ({ ok: true, rows: rows || [] }));
      })
      .then((pack) =>
        pack.ok
          ? { ok: true, list: dedupeScores(pack.rows) }
          : { ok: false, list: [] }
      )
      .catch(() => ({ ok: false, list: [] }));
  }

  function boards() {
    if (KEY.indexOf("PENDING") === 0) return Promise.resolve({ ok: false, survival: [], story: [] });
    return Promise.all([board("survival"), board("story")]).then((pair) => ({
      ok: pair[0].ok && pair[1].ok,
      survival: pair[0].list,
      story: pair[1].list,
    }));
  }

  return { sync, pull, pushScore, boards, url: () => URL, key: () => KEY };
})();
