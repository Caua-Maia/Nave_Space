const Cloud = (() => {
  const URL = "https://sncenrdjoxbbzvlxyrcj.supabase.co";
  const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuY2VucmRqb3hiYnp2bHh5cmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NDQ4NjEsImV4cCI6MjEwNzUyMDg2MX0.K1sYHW0yhqemlCnf_QcmjIlWSiN9bTCRVT6WfCMLuqQ";
  let timer = 0;
  let coopOnline = null;
  let coopProbeInterval = 0;
  let coopListener = null;

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

  function pilotIdFromSave(data) {
    return data && data.pilotId ? String(data.pilotId) : "";
  }

  function boardKey(row) {
    const pid = String(row.pilot_id || row.pilotId || "")
      .trim()
      .toLowerCase();
    if (pid) return "id:" + pid;
    const name = String(row.name || "ANÔNIMO")
      .trim()
      .slice(0, 16)
      .toLowerCase();
    return "name:" + name;
  }

  function pilotBody(data) {
    const story = data.story || {};
    const id = pilotIdFromSave(data);
    return {
      id,
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
      if (!body.id) return;
      fetch(URL + "/rest/v1/pilots?on_conflict=id", {
        method: "POST",
        headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(body),
      }).catch(() => {});
    }, 400);
  }

  function pull() {
    if (KEY.indexOf("PENDING") === 0) return Promise.resolve(null);
    const data = Save.load();
    const pid = pilotIdFromSave(data);
    if (!pid) return Promise.resolve(null);
    return fetch(URL + "/rest/v1/pilots?id=eq." + encodeURIComponent(pid) + "&select=*", {
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

  const MAX_CLOUD_SCORE = 500000000;

  function parseIntFromExtra(extra, re) {
    const m = String(extra || "").match(re);
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function validateScorePush(kind, entry) {
    const scoreVal = Math.max(0, entry.score | 0);
    const extra = String(entry.extra || "").trim();
    if (scoreVal > MAX_CLOUD_SCORE) return { ok: false, reason: "cap" };
    if (kind === "survival") {
      const wave = parseIntFromExtra(extra, /onda\s*(\d+)/i);
      if (wave > 0) {
        const cap = Math.max(800000, wave * 12000000);
        if (scoreVal > cap) return { ok: false, reason: "plausible" };
      }
    }
    if (kind === "story") {
      const low = extra.toLowerCase();
      if (low.indexOf("fase") === 0) {
        const stage = parseIntFromExtra(extra, /fase\s*(\d+)/i);
        if (stage > 0) {
          const cap = Math.max(2000000, stage * 15000000);
          if (scoreVal > cap) return { ok: false, reason: "plausible" };
        }
      } else if (low === "campanha" && scoreVal > 400000000) {
        return { ok: false, reason: "plausible" };
      }
    }
    return { ok: true, reason: "ok" };
  }

  function pushScore(kind, entry) {
    if (KEY.indexOf("PENDING") === 0) return Promise.resolve({ ok: false, reason: "network" });
    const data = Save.load();
    const pilot_id = pilotIdFromSave(data);
    const name = String(entry.name || data.name || "").trim().slice(0, 16);
    if (!pilot_id || !name) return Promise.resolve({ ok: false, reason: "missing" });
    const check = validateScorePush(kind, entry);
    if (!check.ok) return Promise.resolve(check);
    const ship = shipId(entry.shipId || data.shipId);
    const scoreVal = Math.max(0, entry.score | 0);
    const mode = kind === "story" ? "story" : "survival";
    const playSeconds = Math.max(
      0,
      Math.floor(Number(entry.playSeconds != null ? entry.playSeconds : entry.play_seconds) || 0)
    );
    if (typeof ScoreIntegrity === "undefined") {
      return Promise.resolve({ ok: false, reason: "integrity" });
    }
    return ScoreIntegrity.token(mode, scoreVal, playSeconds, pilot_id).then((integrity_token) => {
      if (!integrity_token) return { ok: false, reason: "integrity" };
      return fetch(URL + "/rest/v1/scores", {
        method: "POST",
        headers: headers({ Prefer: "return=minimal" }),
        body: JSON.stringify({
          mode,
          pilot_id,
          name,
          score: scoreVal,
          extra: String(entry.extra || "").slice(0, 40),
          ship_id: ship,
          play_seconds: playSeconds,
          integrity_token,
        }),
      })
        .then((res) => {
          if (res.ok) return { ok: true, reason: "ok" };
          if (res.status === 400 || res.status === 409 || res.status === 422) return { ok: false, reason: "rejected" };
          return { ok: false, reason: "network" };
        })
        .catch(() => ({ ok: false, reason: "network" }));
    });
  }

  function dedupeScores(rows) {
    const best = new Map();
    (rows || []).forEach((row) => {
      const name = String(row.name || "ANÔNIMO").slice(0, 16);
      const key = boardKey(row);
      const entry = {
        pilotId: row.pilot_id || "",
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
      "&select=pilot_id,name,score,extra,ship_id&order=score.desc&limit=40";
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

  function probeCoopServer() {
    if (KEY.indexOf("PENDING") === 0) {
      coopOnline = false;
      return Promise.resolve(false);
    }
    return fetch(URL + "/rest/v1/scores?select=id&limit=1", {
      method: "GET",
      headers: headers(),
    })
      .then((res) => {
        const ok = res.ok;
        coopOnline = ok;
        return ok;
      })
      .catch(() => {
        coopOnline = false;
        return false;
      });
  }

  function probeRealtime() {
    if (KEY.indexOf("PENDING") === 0) {
      coopOnline = false;
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      let finished = false;
      const done = (ok) => {
        if (finished) return;
        finished = true;
        coopOnline = ok;
        resolve(ok);
      };
      let ws;
      try {
        const wsUrl =
          URL.replace("https://", "wss://") +
          "/realtime/v1/websocket?apikey=" +
          encodeURIComponent(KEY) +
          "&vsn=1.0.0";
        ws = new WebSocket(wsUrl);
      } catch (err) {
        done(false);
        return;
      }
      const timeout = setTimeout(() => {
        try {
          ws.close();
        } catch (e) {}
        done(false);
      }, 5500);
      ws.onopen = () => {
        clearTimeout(timeout);
        try {
          ws.close();
        } catch (e) {}
        done(true);
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        done(false);
      };
    });
  }

  function coopReady() {
    return coopOnline;
  }

  function watchCoop(onChange) {
    coopListener = typeof onChange === "function" ? onChange : null;
    const run = () =>
      probeRealtime().then((ok) => {
        if (coopListener) coopListener(ok);
        return ok;
      });
    clearInterval(coopProbeInterval);
    coopProbeInterval = 0;
    run();
    coopProbeInterval = setInterval(run, 45000);
  }

  return {
    sync,
    pull,
    pushScore,
    boards,
    url: () => URL,
    key: () => KEY,
    probeCoopServer,
    probeRealtime,
    coopReady,
    watchCoop,
  };
})();
