const Game = (() => {
  let canvas, ctx, w, h;
  let state = "menu";
  let last = 0;
  let player;
  let bullets = [];
  let rocks = [];
  let enemies = [];
  let bosses = [];
  let particles = [];
  let powers = [];
  let stars = [];
  let score = 0;
  let stageScore = 0;
  let stageStartScore = 0;
  let combo = 0;
  let comboTime = 0;
  let wave = 1;
  let elapsed = 0;
  let spawnRock = 0;
  let spawnEnemy = 0;
  let spawnHeal = 8;
  let shake = 0;
  let mode = "survival";
  let stageId = 1;
  let bossPhase = false;
  let stageDone = false;
  let pendingStage = 1;
  let scoreSaved = false;
  let lastSaveSignature = "";
  let lastBossWave = 0;
  let surgeTimer = 14;
  let diffTier = 1;
  let survJitter = 1;
  let survJitterSec = -1;
  let selectedShipId = "lanca";
  let pendingMode = "survival";
  let optionsFrom = "title";
  let remote = null;
  let remoteGoal = null;
  let linkAcc = 0;
  let linkLive = false;
  let linkName = "Piloto";
  let linkShip = "lanca";
  let linkHello = 0;
  let linkPendingCode = "";
  let megaBoss = null;
  let bossDrones = [];
  let bossDroneTimer = 0;
  let bossState = "INACTIVE";
  let bossIntroTimer = 0;
  let bossWarnTimer = 0;
  let survivalMegaTypeId = "titan";
  let comboGraceLeft = 0;
  let comboWasLocked = false;
  let spawningEnabled = true;
  let worldSeq = 1;
  const els = {};

  function data() {
    return Save.load();
  }

  function typing() {
    const el = document.activeElement;
    return el && el.tagName === "INPUT";
  }

  function multiplier() {
    return 1 + Math.floor(combo / 4);
  }

  function rumble(ms, mag) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.vibrationActuator) {
        p.vibrationActuator
          .playEffect("dual-rumble", {
            duration: ms,
            strongMagnitude: mag,
            weakMagnitude: mag * 0.6,
          })
          .catch(() => {});
      }
    }
    if (typeof Settings !== "undefined") Settings.pulse(ms);
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) particles.push(new Particle(x, y, color, speed));
  }

  function makeStars() {
    stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z: rand(0.2, 1.2),
        s: rand(0.6, 2.2),
      });
    }
  }

  function syncMenuPointer() {
    if (!canvas || !els.overlay) return;
    const menuOpen = !els.overlay.classList.contains("hidden");
    canvas.style.pointerEvents = menuOpen ? "none" : "auto";
    if (typeof TouchControls !== "undefined") {
      TouchControls.setVisible(!menuOpen && state === "play");
    }
  }

  function showView(name) {
    document.querySelectorAll(".panel").forEach((p) => {
      p.classList.toggle("hidden", p.dataset.view !== name);
    });
    els.overlay.classList.remove("hidden");
    syncMenuPointer();
  }

  function hideOverlay() {
    els.overlay.classList.add("hidden");
    syncMenuPointer();
  }

  function refreshTitle() {
    const s = data();
    els.pilotName.value = s.name;
    const sess = s.session;
    if (els.btnLink) els.btnLink.classList.toggle("hidden", s.options.showCoop !== true);
    if (sess) {
      els.btnContinue.classList.remove("hidden");
      const extra =
        sess.mode === "story"
          ? `fase ${sess.stageId} · ${formatTime(sess.elapsed)}`
          : `onda ${sess.wave} · score ${sess.score.toLocaleString("pt-BR")}`;
      els.storySave.textContent = `Partida salva (${extra}). CONTINUAR retoma de onde parou.`;
    } else {
      els.btnContinue.classList.add("hidden");
      if (s.story.cleared >= Story.stages.length) {
        els.storySave.textContent = `${s.name || "Piloto"} · campanha completa · recorde local salvo`;
      } else {
        els.storySave.textContent = s.name
          ? `${s.name} · história na fase ${s.story.nextStage} / ${Story.stages.length} · score campanha ${s.story.campaignScore.toLocaleString("pt-BR")}`
          : "Digite um nome para gravar ranking e progresso da história.";
      }
    }
  }

  function fx(v) {
    return v / Math.max(1, w);
  }
  function ux(f) {
    return f * w;
  }
  function fy(v) {
    return v / Math.max(1, h);
  }
  function uy(f) {
    return f * h;
  }

  function buildSessionSnapshot() {
    return {
      v: 2,
      cw: w,
      ch: h,
      mode,
      stageId,
      score,
      stageScore,
      stageStartScore,
      combo,
      comboTime,
      wave,
      elapsed,
      bossPhase,
      stageDone,
      lastBossWave,
      spawnRock,
      spawnEnemy,
      spawnHeal,
      surgeTimer,
      diffTier,
      player: {
        shipId: player.shipId,
        x: fx(player.x),
        y: fy(player.y),
        vx: player.vx,
        vy: player.vy,
        hp: player.hp,
        aim: player.aim,
        rapid: player.rapid,
        shield: player.shield,
        multi: player.multi,
        cool: player.cool,
        iframes: player.iframes,
      },
      rocks: rocks.map((r) => ({
        x: fx(r.x),
        y: fy(r.y),
        size: r.size,
        vx: r.vx,
        vy: r.vy,
        hp: r.hp,
        rot: r.rot,
        spin: r.spin,
      })),
      enemies: enemies.map((e) => ({
        x: fx(e.x),
        y: fy(e.y),
        type: e.type,
        hp: e.hp,
        angle: e.angle,
        cool: e.cool,
        speed: e.speed,
      })),
      bosses: bosses.map((b) => ({
        x: fx(b.x),
        y: fy(b.y),
        kind: b.kind,
        hp: b.hp,
        angle: b.angle,
        cool: b.cool,
        t: b.t,
      })),
      bullets: bullets.map((b) => ({
        x: fx(b.x),
        y: fy(b.y),
        vx: b.vx,
        vy: b.vy,
        fromPlayer: b.fromPlayer,
        color: b.color,
        dmg: b.dmg,
        life: b.life,
        r: b.r,
      })),
      powers: powers.map((p) => ({ x: fx(p.x), y: fy(p.y), type: p.type, life: p.life })),
    };
  }

  function applySessionSnapshot(s) {
    mode = s.mode;
    stageId = s.stageId;
    score = s.score;
    stageScore = s.stageScore;
    stageStartScore = s.stageStartScore;
    combo = s.combo;
    comboTime = s.comboTime;
    wave = s.wave;
    elapsed = s.elapsed;
    bossPhase = s.bossPhase;
    stageDone = s.stageDone;
    lastBossWave = s.lastBossWave;
    spawnRock = s.spawnRock;
    spawnEnemy = s.spawnEnemy;
    spawnHeal = s.spawnHeal;
    surgeTimer = s.surgeTimer ?? 14;
    diffTier = s.diffTier ?? 1;

    player = new Player(ux(s.player.x), uy(s.player.y), s.player.shipId);
    Object.assign(player, {
      vx: s.player.vx,
      vy: s.player.vy,
      hp: s.player.hp,
      aim: s.player.aim,
      rapid: s.player.rapid,
      shield: s.player.shield,
      multi: s.player.multi,
      cool: s.player.cool,
      iframes: s.player.iframes,
    });

    rocks = s.rocks.map((r) => {
      const a = new Asteroid(ux(r.x), uy(r.y), r.size, r.vx, r.vy);
      a.hp = r.hp;
      a.rot = r.rot;
      a.spin = r.spin;
      return a;
    });
    enemies = s.enemies.map((e) => {
      const en = new Enemy(ux(e.x), uy(e.y), e.type, e.scale || 1);
      en.hp = e.hp;
      en.angle = e.angle;
      en.cool = e.cool;
      en.speed = e.speed;
      return en;
    });
    bosses = s.bosses.map((b) => {
      const boss = new Boss(ux(b.x), uy(b.y), b.kind);
      boss.hp = b.hp;
      boss.angle = b.angle;
      boss.cool = b.cool;
      boss.t = b.t;
      return boss;
    });
    bullets = s.bullets.map((b) => {
      const ang = Math.atan2(b.vy, b.vx);
      const spd = Math.hypot(b.vx, b.vy);
      const bullet = new Bullet(ux(b.x), uy(b.y), ang, spd, b.fromPlayer, b.color, b.dmg);
      bullet.life = b.life;
      bullet.r = b.r;
      return bullet;
    });
    powers = s.powers.map((p) => {
      const pu = new PowerUp(ux(p.x), uy(p.y), p.type);
      pu.life = p.life;
      return pu;
    });
    particles = [];
  }

  function saveRunSession() {
    if (mode === "link") return false;
    if (state !== "play" && state !== "pause") return false;
    commitName(els.pilotName.value || data().name);
    Save.saveSession(buildSessionSnapshot());
    if (mode === "story") {
      persistStory({ nextStage: stageId, campaignScore: score });
    }
    refreshTitle();
    return true;
  }

  function continueSavedRun() {
    const s = data().session;
    if (!s) return;
    try {
      AudioFx.resume();
      applySessionSnapshot(s);
      state = "play";
      hideOverlay();
      els.hud.classList.remove("hidden");
    } catch (err) {
      console.error(err);
      Save.clearSession();
      refreshTitle();
      alert("Save corrompido — removido. Escolha História ou Sobrevivência.");
      goMenu();
    }
  }

  function dedupeLocalBoard(list) {
    const best = new Map();
    (list || []).forEach((row) => {
      const name = String(row.name || "ANÔNIMO").slice(0, 16);
      const key = name.toLowerCase();
      const entry = {
        name,
        score: row.score | 0,
        extra: row.extra || "",
        shipId: row.shipId,
      };
      const cur = best.get(key);
      if (!cur || entry.score > cur.score) best.set(key, entry);
    });
    return Array.from(best.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  function shipRankLabel(id) {
    const spec = shipById(id);
    return spec && spec.name ? spec.name : "";
  }

  function escapeRankText(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function fillRankOl(ol, rows) {
    if (!ol) return;
    ol.textContent = "";
    if (!rows.length) {
      const li = document.createElement("li");
      li.textContent = "Nenhum registro ainda";
      ol.appendChild(li);
      return;
    }
    rows.forEach((e) => {
      const li = document.createElement("li");
      const ship = shipRankLabel(e.shipId);
      let t =
        escapeRankText(e.name) +
        " — " +
        e.score.toLocaleString("pt-BR") +
        (e.extra ? " · " + escapeRankText(e.extra) : "") +
        (ship ? " · " + escapeRankText(ship) : "");
      li.textContent = t;
      ol.appendChild(li);
    });
  }

  function fillRanks() {
    const paint = (survival, story) => {
      fillRankOl(els.rankSurvival, survival);
      fillRankOl(els.rankStory, story);
    };
    if (els.rankNote) els.rankNote.textContent = "Carregando ranking global…";
    const s = data();
    paint(dedupeLocalBoard(s.survivalBoard), dedupeLocalBoard(s.storyBoard));
    if (typeof Cloud === "undefined") {
      if (els.rankNote) els.rankNote.textContent = "Ranking só neste aparelho.";
      return;
    }
    Cloud.boards().then((boards) => {
      if (state !== "ranks") return;
      if (!boards || !boards.ok) {
        if (els.rankNote) els.rankNote.textContent = "Nuvem offline — mostrando só este aparelho.";
        return;
      }
      if (els.rankNote) els.rankNote.textContent = "Top 10 global (melhor score por piloto).";
      paint(boards.survival, boards.story);
    });
  }

  function linkHost() {
    return mode === "link" && typeof Net !== "undefined" && Net.role() === "host";
  }

  function linkGuest() {
    return mode === "link" && typeof Net !== "undefined" && Net.role() !== "host";
  }

  function likeSurvival() {
    return mode === "survival" || linkHost();
  }

  function pilotTarget(ent) {
    if (mode === "link" && remote) {
      return dist2(ent, remote) < dist2(ent, player) ? remote : player;
    }
    return player;
  }

  function q3(n) {
    return Math.round(Number(n) * 1000) / 1000;
  }

  function markId(ent) {
    if (!ent.nid) ent.nid = worldSeq++;
    return ent.nid;
  }

  function megaEncounterActive() {
    if (bossState === "WARN") return true;
    return megaBoss && (bossState === "INTRO" || bossState === "FIGHT" || bossState === "OUTRO");
  }

  function comboLocked() {
    return megaEncounterActive() || comboGraceLeft > 0;
  }

  function comboTimerMax() {
    return typeof SurvivalMega !== "undefined" ? SurvivalMega.COMBO_TIMER_MAX : 2.1;
  }

  function updateCombo(dt) {
    const locked = comboLocked();
    if (locked) {
      if (combo > 0) comboTime = comboTimerMax();
      if (!megaEncounterActive() && comboGraceLeft > 0) comboGraceLeft -= dt;
      comboWasLocked = true;
      return;
    }
    if (comboWasLocked && combo > 0) {
      comboTime = comboTimerMax();
      comboWasLocked = false;
    }
    comboTime -= dt;
    if (comboTime <= 0) combo = 0;
  }

  function caps() {
    const bossHere = bosses.length > 0 || (megaBoss && bossState === "FIGHT");
    if (likeSurvival()) {
      const d = survivalDifficulty();
      return {
        rockMax: bossHere ? Math.max(4, d.rockMax - 3) : d.rockMax,
        enemyMax: bossHere ? Math.max(2, d.enemyMax - 2) : d.enemyMax,
      };
    }
    const rockMax = bossHere ? 6 : Math.min(12, 6 + Math.floor(wave / 3));
    const enemyMax = bossHere ? 3 : Math.min(7, 3 + Math.floor(wave / 4));
    return { rockMax, enemyMax };
  }

  function survivalDifficulty() {
    const jitter = survJitter;
    const scale = 1 + wave * 0.045 + elapsed * 0.0055;
    diffTier = Math.floor(scale);
    return {
      scale,
      jitter,
      rockRate: Math.max(0.28, 2.35 - wave * 0.022 - elapsed * 0.0018) * jitter,
      enemyRate: Math.max(0.42, 6.1 - wave * 0.026 - elapsed * 0.0022) * jitter,
      rockMax: Math.min(22, 6 + Math.floor(wave * 0.14 + elapsed / 45)),
      enemyMax: Math.min(16, 4 + Math.floor(wave * 0.11 + elapsed / 55)),
      rockSpeed: 38 + wave * 3.2 + elapsed * 0.09,
      shooterChance: Math.min(0.78, 0.22 + wave * 0.005 + elapsed * 0.0009),
      healInterval: Math.max(8, 18 - wave * 0.06),
    };
  }

  function spawnBoss(kind) {
    const p = spawnEdge(w, h, 90);
    bosses.push(new Boss(p.x, p.y, kind));
    AudioFx.boss();
    rumble(220, 0.45);
    els.flash.textContent = bosses[0].name;
    els.flash.style.opacity = "1";
    setTimeout(() => {
      els.flash.style.opacity = "0";
    }, 700);
  }

  function dropHeal(x, y) {
    if (powers.filter((p) => p.type === "heal").length >= 2) return;
    powers.push(new PowerUp(x, y, "heal"));
  }

  function resetArena() {
    player = new Player(w * 0.5, h * 0.5, selectedShipId);
    bullets = [];
    rocks = [];
    enemies = [];
    bosses = [];
    particles = [];
    powers = [];
    combo = 0;
    comboTime = 0;
    stageScore = 0;
    wave = 1;
    elapsed = 0;
    spawnRock = 0.5;
    spawnEnemy = 5;
    spawnHeal = 9;
    shake = 0;
    bossPhase = false;
    stageDone = false;
    surgeTimer = 14;
    diffTier = 1;
    survJitter = 0.88 + Math.random() * 0.28;
    survJitterSec = Math.floor(elapsed);
    megaBoss = null;
    bossDrones = [];
    bossDroneTimer = 0;
    bossState = "INACTIVE";
    bossIntroTimer = 0;
    bossWarnTimer = 0;
    comboGraceLeft = 0;
    comboWasLocked = false;
    survivalMegaTypeId = "titan";
    spawningEnabled = true;
    AudioFx.bossWarningStop();
    AudioFx.beamLaserStop();
    if (els.bossHudMega) els.bossHudMega.classList.add("hidden");
    if (mode === "link" && !linkHost()) return;
    const n = mode === "story" ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const p = spawnEdge(w, h, 80);
      rocks.push(new Asteroid(p.x, p.y, 2 + (Math.random() < 0.5 ? 1 : 0)));
    }
  }

  function startSurvival(forceNew) {
    AudioFx.resume();
    commitName(els.pilotName.value);
    if (!forceNew && Save.hasSession() && data().session?.mode === "survival") {
      continueSavedRun();
      return;
    }
    if (Save.hasSession() && !forceNew) {
      const ok = window.confirm("Iniciar nova sobrevivência? A partida salva será apagada.");
      if (!ok) return;
    }
    Save.clearSession();
    mode = "survival";
    score = 0;
    stageStartScore = 0;
    lastBossWave = 0;
    resetArena();
    setPilotSlot(player, "");
    if (els.btnSaveScore) els.btnSaveScore.classList.remove("hidden");
    if (els.overNameRow) els.overNameRow.classList.remove("hidden");
    state = "play";
    hideOverlay();
    els.hud.classList.remove("hidden");
    refreshTitle();
  }


  function openStoryBrief() {
    AudioFx.resume();
    commitName(els.pilotName.value);
    const s = data();
    pendingStage = Math.min(s.story.nextStage || 1, Story.stages.length);
    if (s.story.cleared >= Story.stages.length) pendingStage = 1;
    const st = Story.get(pendingStage);
    els.briefKicker.textContent = `FASE ${st.id} / ${Story.stages.length}`;
    els.briefTitle.textContent = st.title;
    els.briefText.textContent = st.briefing;
    if (st.type === "score") els.briefGoal.textContent = `Objetivo: ${st.target.toLocaleString("pt-BR")} pontos`;
    else if (st.type === "survive_boss") els.briefGoal.textContent = `Objetivo: sobreviver ${st.duration}s e derrotar o semi-boss`;
    else els.briefGoal.textContent = "Objetivo: derrotar o boss";
    showView("brief");
  }

  function startStoryStage(id) {
    Save.clearSession();
    mode = "story";
    stageId = id;
    const s = data();
    score = s.story.campaignScore || 0;
    stageStartScore = score;
    lastBossWave = 0;
    resetArena();
    setPilotSlot(player, "");
    if (Story.get(id).type === "boss") spawnEnemy = 2.5;
    state = "play";
    hideOverlay();
    els.hud.classList.remove("hidden");
  }

  function persistStory(partial) {
    const s = data();
    Save.saveStory({ ...s.story, ...partial });
    if (typeof Cloud !== "undefined") Cloud.sync();
    refreshTitle();
  }

  function commitName(value) {
    const name = Save.setName(value);
    if (typeof Cloud !== "undefined") Cloud.sync();
    if (els.pilotName) els.pilotName.value = name;
    if (els.overName && !els.overName.value) els.overName.value = name;
    if (els.winName && !els.winName.value) els.winName.value = name;
    return name;
  }

  function openLayoutEdit() {
    if (state === "play") state = "pause";
    optionsFrom = state === "pause" ? "pause" : "title";
    els.overlay.classList.add("hidden");
    syncMenuPointer();
    Settings.beginEdit(() => {
      if (optionsFrom === "pause") showView("pause");
      else showView("title");
    });
  }

  function openOptions() {
    optionsFrom = state === "pause" ? "pause" : "title";
    Settings.fillForm();
    showView("options");
  }

  function closeOptions() {
    if (optionsFrom === "pause") showView("pause");
    else goMenu();
  }

  function enterHangar() {
    Save.setOptions({ introSeen: true });
    state = "menu";
    refreshTitle();
    showView("title");
  }

  function hangupLink() {
    linkLive = false;
    remote = null;
    remoteGoal = null;
    linkPendingCode = "";
    clearInterval(linkHello);
    linkHello = 0;
    document.body.classList.remove("link-role-host", "link-role-guest");
    if (els.viewLink) els.viewLink.classList.remove("hosting");
    if (typeof Net !== "undefined" && Net.role()) Net.leave();
    if (mode === "link") mode = "survival";
  }

  function goMenu() {
    hangupLink();
    state = "menu";
    finishMegaBossCleanup();
    els.hud.classList.add("hidden");
    refreshTitle();
    showView("title");
  }

  function saveRunSignature(name) {
    const n = String(name || "")
      .trim()
      .toLowerCase();
    const sc = Math.floor(Number(score) || 0);
    if (state === "win") return `campaign|${sc}|${n}`;
    if (mode === "story") return `story_over|${stageId}|${sc}|${n}`;
    return `survival|${wave}|${sc}|${n}`;
  }

  function gameOver() {
    if (state === "dead") return;
    finishMegaBossCleanup();
    state = "dead";
    Save.clearSession();
    refreshTitle();
    AudioFx.lose();
    rumble(280, 0.7);
    scoreSaved = false;
    lastSaveSignature = "";
    els.saveMsg.textContent = "";
    const s = data();
    els.overName.value = s.name;
    if (mode === "link") {
      els.overText.textContent = `Dois pilotos · score ${score.toLocaleString("pt-BR")} · onda ${wave} · ${formatTime(elapsed)}`;
    } else if (mode === "story") {
      persistStory({ nextStage: stageId, campaignScore: stageStartScore });
      els.overText.textContent = `Fase ${stageId} · score da run ${score.toLocaleString("pt-BR")} · ao tentar de novo você volta ao início desta fase`;
    } else {
      els.overText.textContent = `Score ${score.toLocaleString("pt-BR")} · onda ${wave} · ${formatTime(elapsed)}`;
    }
    if (els.btnSaveScore) els.btnSaveScore.classList.toggle("hidden", mode === "link");
    if (els.overNameRow) els.overNameRow.classList.toggle("hidden", mode === "link");
    els.hud.classList.add("hidden");
    showView("over");
  }

  function completeStage() {
    if (stageDone) return;
    stageDone = true;
    state = "clear";
    AudioFx.win();
    const next = stageId + 1;
    persistStory({
      nextStage: Math.min(next, Story.stages.length),
      campaignScore: score,
      cleared: Math.max(data().story.cleared, stageId),
    });
    if (stageId >= Story.stages.length) {
      state = "win";
      scoreSaved = false;
      lastSaveSignature = "";
      els.winMsg.textContent = "";
      els.winName.value = data().name;
      els.winText.textContent = `Campanha concluída · ${score.toLocaleString("pt-BR")} pontos`;
      els.hud.classList.add("hidden");
      showView("win");
      return;
    }
    els.clearText.textContent = `Fase ${stageId} ok. Score da campanha: ${score.toLocaleString("pt-BR")}. Próxima: ${Story.get(next).title}`;
    els.hud.classList.add("hidden");
    showView("clear");
  }

  function pauseToggle() {
    if (state === "play") {
      state = "pause";
      showView("pause");
    } else if (state === "pause") {
      state = "play";
      hideOverlay();
    }
  }

  function addScore(base, x, y) {
    combo += 1;
    comboTime = 2.1;
    const gained = Math.floor(base * multiplier());
    score += gained;
    stageScore += gained;
    if (combo > 1 && combo % 5 === 0) {
      AudioFx.combo();
      els.flash.textContent = `COMBO x${combo}`;
      els.flash.style.opacity = "1";
      els.flash.style.transform = "translateX(-50%) scale(1.15)";
      setTimeout(() => {
        els.flash.style.opacity = "0";
        els.flash.style.transform = "translateX(-50%) scale(1)";
      }, 420);
    }
    const low = player && player.hp < player.maxHp * 0.62;
    if (low && Math.random() < 0.2) dropHeal(x, y);
    else if (Math.random() < 0.09) powers.push(new PowerUp(x, y, pick(["rapid", "shield", "multi"])));
  }

  function maybeSpawnSurvivalBoss() {
    if (!likeSurvival()) return;
    if (megaEncounterActive()) return;
    if (bosses.length) return;
    if (wave < 3) return;
    if (wave === lastBossWave) return;
    if (typeof SurvivalMega !== "undefined") {
      if (wave >= SurvivalMega.MIN_WAVE && wave % SurvivalMega.WAVE_INTERVAL === 0) {
        lastBossWave = wave;
        announceSurvivalMega();
        return;
      }
    }
    const atBoss = wave % 8 === 0;
    const atMini = wave % 4 === 0;
    const chaos = wave > 20 && Math.random() < 0.12;
    if (!atBoss && !atMini && !chaos) return;
    lastBossWave = wave;
    let kind = "mini_rock";
    if (atBoss) {
      if (wave >= 48) kind = "core";
      else if (wave >= 24) kind = "cruiser";
      else kind = "mini_hunter";
    } else if (wave >= 12) kind = Math.random() < 0.55 ? "mini_hunter" : "mini_rock";
    if (chaos && wave >= 30) kind = Math.random() < 0.35 ? "cruiser" : kind;
    spawnBoss(kind);
  }

  function survivalSurge() {
    const d = survivalDifficulty();
    const n = 2 + Math.floor(Math.random() * 3) + Math.floor(wave / 15);
    for (let i = 0; i < n; i++) {
      const p = spawnEdge(w, h);
      const type = pickEnemyType(d.scale);
      enemies.push(new Enemy(p.x, p.y, type, d.scale));
    }
    els.flash.textContent = "SURTO!";
    els.flash.style.opacity = "1";
    setTimeout(() => {
      els.flash.style.opacity = "0";
    }, 500);
  }

  function clearRocksNoScore() {
    rocks.forEach((r) => burst(r.x, r.y, "#ffb347", 8, 150));
    rocks = [];
  }

  function materializeMegaEntity() {
    if (megaBoss && megaBoss.survivalMode) return megaBoss;
    if (megaBoss) return megaBoss;
    const cycle = typeof SurvivalMega !== "undefined" ? SurvivalMega.defeatedCount() : 0;
    if (typeof SurvivalMega !== "undefined" && survivalMegaTypeId) {
      megaBoss = SurvivalMega.createInstance(survivalMegaTypeId, w * 0.5, -100, cycle, w, h);
    } else {
      megaBoss = new MegaBoss(w * 0.5, -100);
    }
    megaBoss.introStartY = megaBoss.introStartY != null ? megaBoss.introStartY : -100;
    if (megaBoss.targetAnchorY == null) megaBoss.targetAnchorY = h * 0.22;
    bossDroneTimer = 0;
    bossDrones = [];
    if (els.bossHud) els.bossHud.classList.add("hidden");
    if (els.bossHudMega) els.bossHudMega.classList.remove("hidden");
    updateMegaBossHud();
    return megaBoss;
  }

  function announceSurvivalMega(forceTypeId) {
    if (!likeSurvival() || megaEncounterActive()) return;
    const cycle = typeof SurvivalMega !== "undefined" ? SurvivalMega.defeatedCount() : 0;
    survivalMegaTypeId =
      forceTypeId || (typeof SurvivalMega !== "undefined" ? SurvivalMega.pickType(cycle) : "titan");
    if (typeof SurvivalMega !== "undefined") SurvivalMega.startEncounter();
    rocks.length = 0;
    enemies.length = 0;
    bosses.length = 0;
    spawningEnabled = false;
    megaBoss = null;
    bossState = "WARN";
    bossWarnTimer = typeof SurvivalMega !== "undefined" ? SurvivalMega.WARN_SEC : 2.5;
    comboGraceLeft = 0;
    if (combo > 0) comboTime = comboTimerMax();
    const label =
      typeof SurvivalMega !== "undefined" ? SurvivalMega.def(survivalMegaTypeId).name : "MEGA BOSS";
    els.flash.textContent = `ALERTA — ${label}`;
    els.flash.style.opacity = "1";
    setTimeout(() => {
      els.flash.style.opacity = "0";
    }, 900);
    AudioFx.bossWarningStart();
    rumble(120, 0.35);
    if (els.bossHudMega) els.bossHudMega.classList.add("hidden");
  }

  function spawnMegaBoss() {
    rocks.length = 0;
    enemies.length = 0;
    spawningEnabled = false;
    materializeMegaEntity();
    bossState = "INTRO";
    bossIntroTimer = 3;
    AudioFx.bossWarningStart();
  }

  function beginMegaBossEncounter() {
    if (megaBoss) return;
    spawnMegaBoss();
  }

  function triggerMegaBossDefeat() {
    if (!megaBoss || bossState !== "FIGHT") return;
    megaBoss.alive = false;
    bossState = "OUTRO";
    bossIntroTimer = 2;
    addScore(megaBoss.score, megaBoss.x, megaBoss.y);
    burst(megaBoss.x, megaBoss.y, "#6688ff", 36, 280);
    AudioFx.explode(4);
    rumble(280, 0.75);
    if (megaBoss.survivalMode && typeof SurvivalMega !== "undefined") {
      SurvivalMega.onVictory();
      comboGraceLeft = SurvivalMega.COMBO_GRACE;
      comboTime = comboTimerMax();
      shake = Math.max(shake, 14);
      if (player.hp < player.maxHp) dropHeal(megaBoss.x, megaBoss.y);
      else if (Math.random() < 0.55) powers.push(new PowerUp(megaBoss.x, megaBoss.y, "shield"));
    }
    spawningEnabled = true;
    AudioFx.beamLaserStop();
    AudioFx.bossWarningStop();
  }

  function finishMegaBossCleanup() {
    AudioFx.beamLaserStop();
    AudioFx.bossWarningStop();
    megaBoss = null;
    bossDrones = [];
    bossState = "INACTIVE";
    bossIntroTimer = 0;
    spawningEnabled = true;
    if (els.bossHudMega) els.bossHudMega.classList.add("hidden");
  }

  function tickMegaBossEncounter(dt) {
    if (bossState === "WARN") {
      bossWarnTimer -= dt;
      if (bossWarnTimer <= 0) {
        AudioFx.bossWarningStop();
        materializeMegaEntity();
        bossState = "INTRO";
        bossIntroTimer = 3;
        AudioFx.bossWarningStart();
      }
      return;
    }
    if (!megaBoss) return;
    if (bossState === "INTRO") {
      megaBoss.updateIntro(dt, w, h, player);
      bossIntroTimer -= dt;
      if (bossIntroTimer <= 0) {
        AudioFx.bossWarningStop();
        AudioFx.boss();
        rumble(200, 0.5);
        bossState = "FIGHT";
        megaBoss.introLerp = 1;
        megaBoss.y = megaBoss.targetAnchorY != null ? megaBoss.targetAnchorY : h * 0.22;
        megaBoss.currentPattern = "IDLE";
        megaBoss.patternTimer = 0.4;
        bossDroneTimer = 11;
      }
    } else if (bossState === "FIGHT") {
      if (megaBoss.survivalMode && typeof SurvivalMega !== "undefined") {
        SurvivalMega.tickPhase(dt, megaBoss);
        if (megaBoss.survivalPhase != null) megaBoss.survivalPhase = SurvivalMega.getPhase();
      }
      megaBoss.updateFight(dt, w, h, player, bullets);
      if (typeof megaBoss.applyHazards === "function") megaBoss.applyHazards(dt, w, h, player, remote);
      else megaBoss.applyBeamDamage(dt, w, player, remote);
      const firing =
        megaBoss.currentPattern === "BEAM_FIRE" ||
        megaBoss.currentPattern === "SWEEP_FIRE";
      if (firing) shake = Math.max(shake, megaBoss.profileId === "prisma" ? 6 : 8);
      spawnMegaBossDrones(dt);
    } else if (bossState === "OUTRO") {
      bossIntroTimer -= dt;
      if (bossIntroTimer <= 0) {
        finishMegaBossCleanup();
        if (mode === "story" && stageId === 8) completeStage();
      }
    }
    updateMegaBossHud();
  }

  function spawnMegaBossDrones(dt) {
    if (megaBoss && (megaBoss.profileId === "prisma" || megaBoss.profileId === "orbita")) return;
    bossDroneTimer -= dt;
    if (bossDroneTimer > 0) return;
    bossDroneTimer = 12;
    bossDrones.push(new BossDrone(-50, rand(100, h - 100), "repair", megaBoss));
    bossDrones.push(new BossDrone(w + 50, rand(100, h - 100), "kamikaze", { x: player.x, y: player.y }));
  }

  function updateMegaBossHud() {
    if (!megaBoss || !els.bossHudMega) return;
    const ws = megaBoss.weakSpots || [];
    const setFill = (el, cur, max) => {
      if (!el) return;
      el.style.width = `${Math.max(0, Math.min(100, (cur / max) * 100))}%`;
    };
    const fills = [els.wsLeftFill, els.wsTopFill, els.wsRightFill];
    for (let i = 0; i < fills.length; i++) {
      const s = ws[i];
      if (!fills[i]) continue;
      setFill(fills[i], s && s.alive ? s.hp : 0, s ? s.maxHp : 1);
    }
    if (els.bossCoreFill)
      els.bossCoreFill.style.width = `${Math.max(0, (megaBoss.coreHp / megaBoss.maxCoreHp) * 100)}%`;
    if (els.bossShieldOverlay)
      els.bossShieldOverlay.classList.toggle("shield-active", megaBoss.shieldActive);
  }

  function megaBossPlayerBulletHit(i, b) {
    if (!megaBoss || !megaBoss.alive || bossState !== "FIGHT" || !b.fromPlayer || b.ghost) return false;
    const vitalRad = (spot) =>
      typeof megaBoss.vitalHitRadius === "function" ? megaBoss.vitalHitRadius(spot) : (spot.r || 16) + 4;
    for (const spot of megaBoss.weakSpots) {
      if (!spot.alive) continue;
      const pos = megaBoss.getWeakSpotWorldPos(spot);
      const vr = vitalRad(spot);
      if (dist2(b, { x: pos.x, y: pos.y }) < (b.r + vr) * (b.r + vr)) {
        bullets.splice(i, 1);
        const dmg = Math.max(1, Math.round(b.dmg || 16));
        spot.hp -= dmg;
        burst(pos.x, pos.y, "#ffcc00", 8, 200);
        AudioFx.hit();
        if (spot.hp <= 0) {
          spot.hp = 0;
          spot.alive = false;
          burst(pos.x, pos.y, "#ff3366", 18, 260);
          AudioFx.explode(2);
          addScore(500, pos.x, pos.y);
        }
        return true;
      }
    }
    const hullR =
      typeof megaBoss.bulletHullRadius === "function" ? megaBoss.bulletHullRadius() : megaBoss.r;
    if (dist2(b, megaBoss) < (b.r + hullR) * (b.r + hullR)) {
      bullets.splice(i, 1);
      const survivalCore =
        megaBoss.survivalMode && typeof SurvivalMega !== "undefined" && !SurvivalMega.coreOpen(megaBoss);
      if (megaBoss.shieldActive || survivalCore) {
        burst(b.x, b.y, "#00f0ff", 5, 220);
        AudioFx.shieldDeflect();
      } else {
        const dmg = Math.max(1, Math.round(b.dmg || 16));
        megaBoss.coreHp -= dmg;
        burst(b.x, b.y, "#ff0055", 6, 200);
        AudioFx.hit();
        if (megaBoss.coreHp <= 0) {
          megaBoss.coreHp = 0;
          triggerMegaBossDefeat();
        }
      }
      return true;
    }
    for (let d = bossDrones.length - 1; d >= 0; d--) {
      const dr = bossDrones[d];
      if (dist2(b, dr) < (b.r + dr.r) * (b.r + dr.r)) {
        bullets.splice(i, 1);
        const dmg = Math.max(1, Math.round(b.dmg || 16));
        dr.hp -= dmg;
        burst(dr.x, dr.y, dr.color, 5, 160);
        if (dr.hp <= 0) bossDrones.splice(d, 1);
        return true;
      }
    }
    return false;
  }

  function spawnWaveStuff(dt) {
    if (!spawningEnabled) {
      spawnHeal -= dt;
      const needy = player.hp < player.maxHp || (linkHost() && remote && remote.hp < remote.maxHp);
      if (spawnHeal <= 0 && needy) {
        const surv = likeSurvival() ? survivalDifficulty() : null;
        const healWait = surv ? surv.healInterval : player.hp < 40 ? 11 : 17;
        spawnHeal = healWait + rand(0, 4);
        if (!megaEncounterActive() && (wave < 25 || Math.random() < 0.65)) {
          const p = spawnEdge(w, h, 60);
          dropHeal(Math.max(80, Math.min(w - 80, p.x)), Math.max(80, Math.min(h - 80, p.y)));
        }
      }
      if (mode === "story") tickStory();
      return;
    }
    spawnRock -= dt;
    spawnEnemy -= dt;
    spawnHeal -= dt;
    const { rockMax, enemyMax } = caps();
    const surv = likeSurvival() ? survivalDifficulty() : null;
    const rockRate = surv ? surv.rockRate : Math.max(1.15, 2.4 - elapsed * 0.012);
    const enemyRate = surv ? surv.enemyRate : Math.max(2.1, 6.2 - elapsed * 0.018);
    if (spawnRock <= 0 && rocks.length < rockMax) {
      spawnRock = rockRate * (0.92 + Math.random() * 0.16);
      const p = spawnEdge(w, h);
      const bigRock =
        (mode === "survival" || linkHost()) && wave > 8 && Math.random() < 0.35 + wave * 0.002;
      const size = bigRock ? 3 : Math.random() < 0.45 ? 3 : Math.random() < 0.75 ? 2 : 1;
      const toward = Math.atan2(player.y - p.y, player.x - p.x) + rand(-0.55, 0.55);
      const spd = surv ? surv.rockSpeed * (0.9 + Math.random() * 0.25) : 36 + Math.min(wave, 12) * 5;
      rocks.push(new Asteroid(p.x, p.y, size, Math.cos(toward) * spd, Math.sin(toward) * spd));
    }
    const enemyStart = mode === "story" && Story.get(stageId).type === "boss" ? 1.2 : 7;
    if (elapsed > enemyStart && spawnEnemy <= 0 && enemies.length < enemyMax) {
      spawnEnemy = enemyRate * (0.9 + Math.random() * 0.2);
      const p = spawnEdge(w, h);
      const type = pickEnemyType(surv ? surv.scale : 1 + elapsed * 0.012);
      enemies.push(new Enemy(p.x, p.y, type, surv ? surv.scale : 1));
    }
    const needy = player.hp < player.maxHp || (linkHost() && remote && remote.hp < remote.maxHp);
    if (spawnHeal <= 0 && needy) {
      const healWait = surv ? surv.healInterval : player.hp < 40 ? 11 : 17;
      spawnHeal = healWait + rand(0, 4);
      if (wave < 25 || Math.random() < 0.65) {
        const p = spawnEdge(w, h, 60);
        dropHeal(Math.max(80, Math.min(w - 80, p.x)), Math.max(80, Math.min(h - 80, p.y)));
      }
    }

    if (likeSurvival() && spawningEnabled && !megaEncounterActive()) {
      surgeTimer -= dt;
      if (surgeTimer <= 0) {
        surgeTimer = Math.max(8, 22 - wave * 0.08 - diffTier * 0.15) * (0.75 + Math.random() * 0.5);
        if (wave >= 5) survivalSurge();
      }
    }

    const waveLen = likeSurvival() ? Math.max(14, 22 - Math.floor(wave / 12)) : 22;
    const newWave = 1 + Math.floor(elapsed / waveLen);
    if (newWave !== wave) {
      wave = newWave;
      if (likeSurvival()) maybeSpawnSurvivalBoss();
    }

    if (mode === "story") tickStory();
  }

  function tickStory() {
    const st = Story.get(stageId);
    if (st.type === "score" && stageScore >= st.target) completeStage();
    if (st.type === "survive_boss") {
      if (!bossPhase && elapsed >= st.duration) {
        bossPhase = true;
        spawnBoss(st.boss);
      }
    }
    if (st.type === "boss" && elapsed > 2.2 && !bosses.length && !megaBoss && !bossPhase) {
      bossPhase = true;
      if (st.boss === "mega") beginMegaBossEncounter();
      else spawnBoss(st.boss);
    }
  }

  function shotAnglesFor(ship, aim, dualBack) {
    if (dualBack || (ship.multi > 0 && ship.shipId === "dardo")) {
      return [aim, aim + Math.PI];
    }
    let n = ship.shots;
    let spread = ship.spread || 0.18;
    if (ship.multi > 0 && ship.shipId === "lanca") n = 3;
    if (ship.multi > 0 && ship.shipId === "bastiao") n = 3;
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(aim + (n === 1 ? 0 : (i - (n - 1) / 2) * spread));
    }
    return out;
  }

  function anglesFromShotMsg(msg, ship, aim) {
    if (msg.dual) return [aim, aim + Math.PI];
    const n = Math.max(1, Math.min(5, msg.n | 0));
    if (n > 1) {
      const spread = Number(msg.spread) || 0;
      const out = [];
      for (let i = 0; i < n; i++) out.push(aim + (i - (n - 1) / 2) * spread);
      return out;
    }
    return [aim];
  }

  function spawnBulletsFor(ship, x, y, aim, owner, msg) {
    const tint = ship.pilotColor || ship.color;
    const dmg = ship.bulletDmg || 16;
    const angles = msg ? anglesFromShotMsg(msg, ship, aim) : shotAnglesFor(ship, aim);
    angles.forEach((a) => {
      const b = new Bullet(
        x + Math.cos(a) * 18,
        y + Math.sin(a) * 18,
        a,
        ship.bulletSpeed,
        true,
        tint,
        dmg
      );
      if (ship.shipId === "dardo") b.r = 2.2;
      if (ship.shipId === "bastiao") b.r = 4.4;
      if (mode === "link") b.owner = owner;
      bullets.push(b);
    });
    return {
      t: "shot",
      x: w ? x / w : 0.5,
      y: h ? y / h : 0.5,
      aim,
      n: angles.length,
      spread: ship.spread || 0,
      speed: ship.bulletSpeed,
      shipId: ship.shipId,
      dual: ship.multi > 0 && ship.shipId === "dardo" ? 1 : 0,
    };
  }

  function tryShoot(input) {
    let aimX = 0;
    let aimY = 0;
    let want = false;
    const padAimDead = 0.18;
    const touchFireDead = 0.2;
    if (input.pad && (input.pad.right.mag > padAimDead || input.pad.r2 > 0.12)) {
      if (input.pad.right.mag > padAimDead) {
        aimX = input.pad.right.x;
        aimY = input.pad.right.y;
      } else {
        aimX = Math.cos(player.aim);
        aimY = Math.sin(player.aim);
      }
      want = input.pad.shoot;
    } else if (input.touch && input.touch.mode) {
      if (input.touch.right.mag > touchFireDead - 1e-6) {
        aimX = input.touch.right.x;
        aimY = input.touch.right.y;
      } else {
        aimX = Math.cos(player.aim);
        aimY = Math.sin(player.aim);
      }
      want = input.touch.shoot;
    } else {
      aimX = input.mouse.x - player.x;
      aimY = input.mouse.y - player.y;
      want = input.kbShoot;
    }
    if (Math.hypot(aimX, aimY) > 0.01) player.aim = Math.atan2(aimY, aimX);
    if (!want || player.cool > 0) return;
    const gap = player.rapid > 0 ? player.gap * 0.55 : player.gap;
    player.cool = gap;
    const owner = mode === "link" && Net.role() === "guest" ? 1 : 0;
    const shotMsg = spawnBulletsFor(player, player.x, player.y, player.aim, owner);
    AudioFx.shoot();
    return shotMsg;
  }

  function spawnRemoteShot(msg) {
    if (!remote || !w || !h) return;
    const spec = shipById(msg.shipId || remote.shipId);
    const x = Number(msg.x) * w;
    const y = Number(msg.y) * h;
    const aim = Number(msg.aim) || 0;
    remote.shipId = spec.id;
    remote.bulletSpeed = Number(msg.speed) || spec.bulletSpeed;
    remote.bulletDmg = spec.bulletDmg || 16;
    spawnBulletsFor(remote, x, y, aim, 1, msg);
  }

  function easeRemote(dt) {
    if (!remote || !remoteGoal) return;
    const k = Math.min(1, dt * 14);
    let dx = remoteGoal.x - remote.x;
    let dy = remoteGoal.y - remote.y;
    if (dx > w * 0.5) dx -= w;
    if (dx < -w * 0.5) dx += w;
    if (dy > h * 0.5) dy -= h;
    if (dy < -h * 0.5) dy += h;
    remote.x += dx * k;
    remote.y += dy * k;
    wrap(remote, w, h, remote.r);
    let da = remoteGoal.aim - remote.aim;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    remote.aim += da * k;
  }

  function packWorld() {
    const take = (list, max) => (list.length > max ? list.slice(0, max) : list);
    return {
      t: "world",
      wave,
      score,
      elapsed: q3(elapsed),
      tier: diffTier,
      ghp: remote ? Math.ceil(remote.hp) : 100,
      rapid: remote ? q3(remote.rapid) : 0,
      shield: remote ? q3(remote.shield) : 0,
      multi: remote ? q3(remote.multi) : 0,
      rocks: take(rocks, 24).map((r) => [markId(r), q3(r.x / w), q3(r.y / h), r.size, q3(r.rot), r.hp]),
      enemies: take(enemies, 18).map((e) => [
        markId(e),
        q3(e.x / w),
        q3(e.y / h),
        e.type,
        q3(e.scale),
        q3(e.angle),
        e.hp,
        q3(e.r),
      ]),
      bosses: bosses.slice(0, 2).map((b) => [
        markId(b),
        q3(b.x / w),
        q3(b.y / h),
        b.kind,
        q3(b.angle),
        b.hp,
        b.maxHp,
        q3(b.t),
      ]),
      bullets: take(
        bullets.filter((b) => !b.ghost),
        64
      ).map((b) => [
        q3(b.x / w),
        q3(b.y / h),
        q3(b.vx / w),
        q3(b.vy / h),
        b.fromPlayer ? 1 : 0,
        b.owner === 1 ? 1 : 0,
        q3(b.r),
        b.color,
        q3(b.life),
      ]),
      powers: take(powers, 6).map((p) => [q3(p.x / w), q3(p.y / h), p.type, q3(p.life)]),
    };
  }

  function pullPos(ent, x, y) {
    ent.tx = x * w;
    ent.ty = y * h;
  }

  function easeList(list, dt) {
    const k = Math.min(1, dt * 12);
    list.forEach((ent) => {
      if (ent.tx == null) return;
      let dx = ent.tx - ent.x;
      let dy = ent.ty - ent.y;
      if (dx > w * 0.5) dx -= w;
      if (dx < -w * 0.5) dx += w;
      if (dy > h * 0.5) dy -= h;
      if (dy < -h * 0.5) dy += h;
      ent.x += dx * k;
      ent.y += dy * k;
    });
  }

  function syncKind(list, rows, make, patch) {
    const keep = new Set();
    rows.forEach((row) => {
      const id = row[0];
      keep.add(id);
      let ent = list.find((item) => item.nid === id);
      if (!ent) {
        ent = make(row);
        ent.nid = id;
        list.push(ent);
      }
      patch(ent, row);
    });
    for (let i = list.length - 1; i >= 0; i--) {
      if (!keep.has(list[i].nid)) list.splice(i, 1);
    }
  }

  function applyWorld(msg) {
    if (!linkGuest() || !w || !h) return;
    score = msg.score || 0;
    wave = msg.wave || wave;
    elapsed = Number(msg.elapsed) || elapsed;
    diffTier = msg.tier || diffTier;
    if (typeof msg.ghp === "number" && player) {
      if (msg.ghp < player.hp) {
        AudioFx.hit();
        shake = 8;
        rumble(100, 0.4);
      }
      player.hp = msg.ghp;
      player.rapid = Number(msg.rapid) || 0;
      player.shield = Number(msg.shield) || 0;
      player.multi = Number(msg.multi) || 0;
    }
    syncKind(
      rocks,
      msg.rocks || [],
      (row) => new Asteroid(row[1] * w, row[2] * h, row[3]),
      (ent, row) => {
        pullPos(ent, row[1], row[2]);
        ent.size = row[3];
        ent.r = ent.size === 3 ? 42 : ent.size === 2 ? 26 : 14;
        ent.rot = row[4];
        ent.hp = row[5];
      }
    );
    syncKind(
      enemies,
      msg.enemies || [],
      (row) => new Enemy(row[1] * w, row[2] * h, row[3], row[4]),
      (ent, row) => {
        pullPos(ent, row[1], row[2]);
        ent.type = row[3];
        ent.scale = row[4];
        ent.angle = row[5];
        ent.hp = row[6];
        ent.r = row[7];
        ent.color = enemyTierColor(ent.scale);
      }
    );
    syncKind(
      bosses,
      msg.bosses || [],
      (row) => new Boss(row[1] * w, row[2] * h, row[3]),
      (ent, row) => {
        pullPos(ent, row[1], row[2]);
        ent.kind = row[3];
        ent.angle = row[4];
        ent.hp = row[5];
        ent.maxHp = row[6];
        ent.t = row[7];
      }
    );
    const mine = bullets.filter((b) => b.owner === 1);
    bullets = (msg.bullets || [])
      .filter((row) => row[5] !== 1)
      .map((row) => {
        const angle = Math.atan2(row[3] * h, row[2] * w);
        const speed = Math.hypot(row[2] * w, row[3] * h);
        const b = new Bullet(row[0] * w, row[1] * h, angle, speed || 1, row[4] === 1, row[7], 16);
        b.vx = row[2] * w;
        b.vy = row[3] * h;
        b.r = row[6];
        b.life = row[8];
        b.owner = 0;
        return b;
      })
      .concat(mine);
    powers = (msg.powers || []).map((row) => {
      const p = new PowerUp(row[0] * w, row[1] * h, row[2]);
      p.life = row[3];
      pullPos(p, row[0], row[1]);
      return p;
    });
  }

  function rememberPilot() {
    linkName = commitName(els.pilotName.value) || "Piloto";
    linkShip = data().shipId || selectedShipId || "lanca";
  }

  function pilotHello() {
    Net.send({
      t: "hello",
      name: linkName,
      shipId: linkShip,
    });
  }

  function attachMate() {
    const mate = Net.mate();
    if (!mate || !player || !w) return;
    const side = Net.role() === "host" ? 0.38 : 0.62;
    if (!remote) {
      remote = new Player(w * (1 - side), h * 0.5, mate.shipId);
      remoteGoal = null;
    } else if (mate.shipId && mate.shipId !== remote.shipId) {
      const spec = shipById(mate.shipId);
      remote.shipId = spec.id;
      remote.color = spec.color;
      remote.r = spec.r;
    }
    remote.pilotName = mate.name;
    setPilotSlot(remote, Net.role() === "host" ? "guest" : "host");
  }

  function startHelloPulse(inLobby) {
    clearInterval(linkHello);
    pilotHello();
    linkHello = setInterval(() => {
      if (inLobby && state !== "link-lobby") {
        clearInterval(linkHello);
        linkHello = 0;
        return;
      }
      if (!inLobby && !linkLive) {
        clearInterval(linkHello);
        linkHello = 0;
        return;
      }
      if (!Net.mate()) {
        pilotHello();
        return;
      }
      if (inLobby) {
        refreshLinkLobby();
        return;
      }
      attachMate();
      clearInterval(linkHello);
      linkHello = 0;
    }, 700);
  }

  function syncShipSubtitle() {
    if (!els.shipSubtitle) return;
    if (pendingMode === "link-host") {
      els.shipSubtitle.textContent = "Escolha a nave. Depois você abre a sala e decide quando iniciar.";
    } else if (pendingMode === "link-guest") {
      els.shipSubtitle.textContent = "Escolha a nave antes de entrar na sala de espera.";
    } else {
      els.shipSubtitle.textContent =
        "Três formas, três jeitos de jogar. A Lança é a clássica. Dardo e Bastião são as novas.";
    }
  }

  function refreshLinkLobby() {
    if (!els.linkLobbyCode) return;
    const code = Net.code() || "----";
    els.linkLobbyCode.textContent = code;
    const mate = Net.mate();
    const spec = mate && mate.shipId ? shipById(mate.shipId) : null;
    if (Net.role() === "host") {
      els.linkLobbyStatus.textContent = mate
        ? `${mate.name} entrou · nave ${spec ? spec.name : ""}`
        : `Sala ${code} aberta. Passe o código para o outro piloto.`;
      if (els.linkLobbyMate) {
        els.linkLobbyMate.textContent = mate ? "Quando quiser, aperte INICIAR PARTIDA." : "Você pode iniciar sozinho ou esperar.";
      }
    } else {
      els.linkLobbyStatus.textContent = mate
        ? `Conectado com ${mate.name}`
        : "Você entrou na sala.";
      if (els.linkLobbyMate) {
        els.linkLobbyMate.textContent = "Aguardando o dono da sala iniciar…";
      }
    }
  }

  function openLinkLobby() {
    state = "link-lobby";
    linkLive = false;
    remote = null;
    remoteGoal = null;
    linkName = commitName(els.pilotName.value) || linkName || "Piloto";
    player = new Player(w * 0.5, h * 0.5, linkShip);
    setPilotSlot(player, Net.role() === "host" ? "host" : "guest");
    document.body.classList.toggle("link-role-host", Net.role() === "host");
    document.body.classList.toggle("link-role-guest", Net.role() === "guest");
    els.hud.classList.add("hidden");
    refreshLinkLobby();
    showView("link-lobby");
  }

  function hostStartLink() {
    if (Net.role() !== "host" || state !== "link-lobby") return;
    Net.send({ t: "start" });
    startLinkArena();
  }

  function leaveLinkLobby() {
    hangupLink();
    pendingMode = "survival";
    state = "link";
    showView("link");
    els.btnLinkHost.disabled = false;
    els.btnLinkJoin.disabled = false;
  }

  function startLinkArena() {
    if (linkLive) {
      attachMate();
      pilotHello();
      return;
    }
    linkLive = true;
    selectedShipId = linkShip;
    mode = "link";
    score = 0;
    stageStartScore = 0;
    resetArena();
    const side = Net.role() === "host" ? 0.38 : 0.62;
    player.x = w * side;
    player.y = h * 0.5;
    setPilotSlot(player, Net.role() === "host" ? "host" : "guest");
    attachMate();
    linkAcc = 0;
    state = "play";
    hideOverlay();
    els.hud.classList.remove("hidden");
    startHelloPulse(false);
  }

  function openLink() {
    AudioFx.resume();
    commitName(els.pilotName.value);
    hangupLink();
    state = "link";
    els.linkCode.value = "";
    els.linkRoom.textContent = "----";
    els.linkStatus.textContent = "Crie ou entre com o código. Você escolhe a nave na sequência.";
    els.btnLinkHost.disabled = false;
    els.btnLinkJoin.disabled = false;
    showView("link");
  }

  function createRoom() {
    commitName(els.pilotName.value);
    pendingMode = "link-host";
    selectedShipId = data().shipId || "lanca";
    state = "ships";
    syncShipSubtitle();
    paintShips();
    showView("ships");
  }

  function enterRoom() {
    commitName(els.pilotName.value);
    const room = els.linkCode.value.trim().toUpperCase();
    if (room.length < 4) {
      els.linkStatus.textContent = "O código tem 4 caracteres.";
      return;
    }
    linkPendingCode = room;
    pendingMode = "link-guest";
    selectedShipId = data().shipId || "lanca";
    state = "ships";
    syncShipSubtitle();
    paintShips();
    showView("ships");
  }

  function onNet(type, msg) {
    if (type === "ready") {
      els.linkRoom.textContent = msg.code || Net.code();
    }
    if (type === "joined") {
      if (state === "link-lobby" || pendingMode === "link-host" || pendingMode === "link-guest") {
        pendingMode = "survival";
        openLinkLobby();
        startHelloPulse(true);
      }
    }
    if (type === "peer") {
      if (state === "link-lobby") {
        refreshLinkLobby();
        pilotHello();
        return;
      }
      attachMate();
      pilotHello();
    }
    if (type === "start" && state === "link-lobby") {
      startLinkArena();
    }
    if (type === "ship" && remote) {
      remoteGoal = {
        x: Number(msg.x) * w,
        y: Number(msg.y) * h,
        aim: Number(msg.aim) || 0,
      };
      if (msg.shipId && msg.shipId !== remote.shipId) {
        const spec = shipById(msg.shipId);
        remote.shipId = spec.id;
        remote.color = spec.color;
        remote.r = spec.r;
      }
    }
    if (type === "shot" && linkHost()) spawnRemoteShot(msg);
    if (type === "world") applyWorld(msg);
    if (type === "down" && (state === "play" || state === "pause")) gameOver();
    if (type === "fail" && (state === "link" || state === "link-lobby" || (mode === "link" && !linkLive))) {
      if (state === "link-lobby") {
        if (els.linkLobbyStatus) els.linkLobbyStatus.textContent = msg.message || "Falha na sala.";
        leaveLinkLobby();
        return;
      }
      els.btnLinkHost.disabled = false;
      els.btnLinkJoin.disabled = false;
      if (els.viewLink) els.viewLink.classList.remove("hosting");
      els.linkStatus.textContent = msg.message || "Falha na sala.";
      state = "link";
      showView("link");
    }
    if (type === "gone" && (state === "play" || state === "pause") && mode === "link") {
      linkLive = false;
      remote = null;
      remoteGoal = null;
      clearInterval(linkHello);
      linkHello = 0;
      state = "link";
      els.hud.classList.add("hidden");
      els.btnLinkHost.disabled = false;
      els.btnLinkJoin.disabled = false;
      if (els.viewLink) els.viewLink.classList.remove("hosting");
      els.linkStatus.textContent = "A sala caiu. Crie de novo ou entre com o código.";
      showView("link");
    }
  }

  function strike(ship, dmg) {
    if (!ship || ship.hp <= 0) return;
    const local = ship === player;
    const hit = ship.hurt(dmg);
    if (hit.shield) {
      burst(ship.x, ship.y, "#4de8ff", 14, 200);
      burst(ship.x, ship.y, "#b8ffff", 10, 260);
      burst(ship.x + rand(-8, 8), ship.y + rand(-8, 8), "#ffffff", 6, 320);
      if (local) {
        AudioFx.shieldHit();
        shake = Math.max(shake, 8);
        rumble(70, 0.32);
      }
      return;
    }
    if (!hit.hull) return;
    burst(ship.x, ship.y, local ? "#4de8ff" : "#ff4d9a", 12, 220);
    if (local) {
      AudioFx.hit();
      shake = 10;
      rumble(120, 0.55);
    }
  }

  function grantPower(ship, power) {
    if (power.type === "rapid") ship.rapid = 6;
    if (power.type === "shield") ship.shield = 8;
    if (power.type === "multi") ship.multi = 7;
    if (power.type === "heal") ship.heal(36);
  }

  function collide() {
    const { rockMax } = caps();
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.ghost) continue;
      if (!b.fromPlayer) {
        const ships = linkHost() && remote ? [player, remote] : [player];
        for (let s = 0; s < ships.length; s++) {
          const ship = ships[s];
          if (dist2(b, ship) < (b.r + ship.r) * (b.r + ship.r)) {
            bullets.splice(i, 1);
            strike(ship, b.dmg || 16);
            break;
          }
        }
        continue;
      }
      let hit = false;
      for (let r = rocks.length - 1; r >= 0; r--) {
        const rock = rocks[r];
        if (dist2(b, rock) < (b.r + rock.r) * (b.r + rock.r)) {
          bullets.splice(i, 1);
          const bd = b.dmg || 16;
          // HP por tiro = bulletDmg/16 (16 = Lança); sem arredondamento para não colapsar Dardo vs Lança.
          rock.hp = Math.max(0, rock.hp - bd / 16);
          burst(b.x, b.y, "#ffb347", 6, 140);
          if (rock.hp <= 0) {
            AudioFx.explode(rock.size);
            addScore(40 * rock.size, rock.x, rock.y);
            const bits = rock.split();
            rocks.splice(r, 1);
            if (rocks.length + bits.length <= rockMax + 2) rocks.push(...bits);
            burst(rock.x, rock.y, "#ffb347", 14 + rock.size * 4, 200);
          }
          hit = true;
          break;
        }
      }
      if (hit) continue;
      for (let e = enemies.length - 1; e >= 0; e--) {
        const en = enemies[e];
        if (dist2(b, en) < (b.r + en.r) * (b.r + en.r)) {
          bullets.splice(i, 1);
          const bd = b.dmg || 16;
          en.hp -= bd / 16;
          burst(b.x, b.y, "#ff4d9a", 5, 160);
          if (en.hp <= 0) {
            AudioFx.explode(2);
            addScore(en.score || 120, en.x, en.y);
            enemies.splice(e, 1);
            burst(en.x, en.y, "#c084fc", 16, 240);
            rumble(40, 0.2);
          }
          hit = true;
          break;
        }
      }
      if (hit) continue;
      if (megaBossPlayerBulletHit(i, b)) continue;
      for (let k = bosses.length - 1; k >= 0; k--) {
        const boss = bosses[k];
        if (dist2(b, boss) < (b.r + boss.r) * (b.r + boss.r)) {
          bullets.splice(i, 1);
          const bd = b.dmg || 16;
          boss.hp = Math.max(0, boss.hp - bd / 16);
          burst(b.x, b.y, boss.color, 8, 160);
          if (boss.hp <= 0) {
            AudioFx.explode(4);
            addScore(boss.score, boss.x, boss.y);
            dropHeal(boss.x, boss.y);
            burst(boss.x, boss.y, boss.color, 28, 280);
            rumble(200, 0.7);
            bosses.splice(k, 1);
            if (mode === "story" && (Story.get(stageId).type === "boss" || bossPhase)) completeStage();
          }
          break;
        }
      }
    }

    const bodyShips = linkHost() && remote ? [player, remote] : [player];
    for (const rock of rocks) {
      bodyShips.forEach((ship) => {
        if (dist2(rock, ship) < (rock.r * 0.85 + ship.r) * (rock.r * 0.85 + ship.r)) strike(ship, 16);
      });
    }
    for (const en of enemies) {
      bodyShips.forEach((ship) => {
        if (dist2(en, ship) < (en.r + ship.r) * (en.r + ship.r)) strike(ship, 14);
      });
    }
    for (const boss of bosses) {
      bodyShips.forEach((ship) => {
        if (dist2(boss, ship) < (boss.r * 0.8 + ship.r) * (boss.r * 0.8 + ship.r)) strike(ship, 20);
      });
    }
    if (megaBoss && (bossState === "INTRO" || bossState === "FIGHT")) {
      bodyShips.forEach((ship) => {
        if (dist2(megaBoss, ship) < (megaBoss.r * 0.85 + ship.r) * (megaBoss.r * 0.85 + ship.r)) strike(ship, 22);
      });
    }
    for (let di = bossDrones.length - 1; di >= 0; di--) {
      const dr = bossDrones[di];
      let hitDrone = false;
      for (let si = 0; si < bodyShips.length && !hitDrone; si++) {
        const ship = bodyShips[si];
        if (dist2(dr, ship) < (dr.r + ship.r) * (dr.r + ship.r)) {
          if (dr.kind === "kamikaze") {
            strike(ship, 30);
            burst(dr.x, dr.y, "#ff3355", 14, 240);
            bossDrones.splice(di, 1);
            AudioFx.explode(2);
          } else {
            strike(ship, 8);
          }
          hitDrone = true;
        }
      }
    }
    for (let i = powers.length - 1; i >= 0; i--) {
      const p = powers[i];
      let took = false;
      if (dist2(p, player) < (p.r + player.r) * (p.r + player.r)) {
        grantPower(player, p);
        took = true;
        if (p.type === "heal") AudioFx.heal();
        else AudioFx.power();
      }
      if (linkHost() && remote && dist2(p, remote) < (p.r + remote.r) * (p.r + remote.r)) {
        grantPower(remote, p);
        took = true;
      }
      if (took) powers.splice(i, 1);
    }
  }

  function formatTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function update(dt, input) {
    if (state === "menu" || state === "brief" || state === "ranks" || state === "ships" || state === "link" || state === "link-lobby") return;
    if ((state === "dead" || state === "clear" || state === "win") && input.confirmPressed && !typing()) {
      if (state === "dead") document.getElementById("btn-retry").click();
      else if (state === "clear") document.getElementById("btn-next").click();
    }
    if (input.pausePressed && !typing()) {
      if (state === "play" || state === "pause") pauseToggle();
    }
    if (state === "pause" && input.confirmPressed && !typing()) pauseToggle();
    if (state !== "play") return;

    elapsed += dt;
    if (likeSurvival()) {
      const sec = Math.floor(elapsed);
      if (sec !== survJitterSec) {
        survJitterSec = sec;
        survJitter = 0.88 + Math.random() * 0.28;
      }
    }
    updateCombo(dt);

    if (likeSurvival() && !megaEncounterActive()) {
      if (input.debugMegaOrbita) announceSurvivalMega("orbita");
      else if (input.debugMegaPrisma) announceSurvivalMega("prisma");
      else if (input.debugMegaBoss) {
        const tid = typeof SurvivalMega !== "undefined" ? SurvivalMega.pickType(SurvivalMega.defeatedCount()) : "titan";
        announceSurvivalMega(tid);
      }
    }

    player.update(dt, input, w, h);
    const shot = tryShoot(input);
    if (mode === "link") {
      easeRemote(dt);
      linkAcc += dt;
      if (linkAcc >= 0.05) {
        linkAcc = 0;
        Net.send({
          t: "ship",
          x: player.x / w,
          y: player.y / h,
          aim: player.aim,
          shipId: player.shipId,
        });
        if (linkHost()) Net.send(packWorld());
      }
      if (shot) Net.send(shot);
      if (linkGuest()) {
        easeList(rocks, dt);
        easeList(enemies, dt);
        easeList(bosses, dt);
        easeList(powers, dt);
        bullets.forEach((b) => b.update(dt, w, h));
        bullets = bullets.filter((b) => b.life > 0 && b.x > -40 && b.x < w + 40 && b.y > -40 && b.y < h + 40);
        powers = powers.filter((p) => p.life > 0);
        shake *= 0.88;
        if (player.hp <= 0) {
          Net.send({ t: "down" });
          gameOver();
        }
        hud();
        return;
      }
    }
    if (mode !== "link" || linkHost()) spawnWaveStuff(dt);

    rocks.forEach((r) => r.update(dt, w, h));
    enemies.forEach((e) => e.update(dt, w, h, pilotTarget(e), bullets));
    bosses.forEach((b) => b.update(dt, w, h, pilotTarget(b), bullets));
    tickMegaBossEncounter(dt);
    bossDrones.forEach((d) => d.update(dt, w, h, player, megaBoss));
    bullets.forEach((b) => b.update(dt, w, h));
    particles.forEach((p) => p.update(dt));
    powers.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => b.life > 0 && b.x > -40 && b.x < w + 40 && b.y > -40 && b.y < h + 40);
    particles = particles.filter((p) => p.life > 0);
    powers = powers.filter((p) => p.life > 0);

    collide();
    shake *= 0.88;
    if (player.hp <= 0 || (linkHost() && remote && remote.hp <= 0)) {
      if (mode === "link") Net.send({ t: "down" });
      gameOver();
    }
    hud();
  }

  function hud() {
    els.score.textContent = score.toLocaleString("pt-BR");
    els.combo.textContent = `x${multiplier()}` + (combo > 1 ? `  (${combo})` : "");
    els.hp.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
    if (els.hpNum) els.hpNum.textContent = `${Math.max(0, Math.ceil(player.hp))}`;
    if (els.shipName) els.shipName.textContent = player.shipName || "LANÇA";
    els.time.textContent = formatTime(elapsed);
    if (mode === "story") {
      const st = Story.get(stageId);
      els.wave.textContent = `FASE ${st.id} · ${st.title}`;
      els.objective.textContent = Story.objectiveText(st, {
        score: stageScore,
        elapsed,
        bossPhase,
        bossAlive: bosses.length > 0 || megaEncounterActive(),
        bossName: (bosses[0] && bosses[0].name) || (megaBoss && megaBoss.name),
      });
    } else if (mode === "link") {
      els.wave.textContent = `ONDA ${wave} · T${diffTier}`;
      const mate = remote && remote.pilotName ? remote.pilotName : "PARCEIRO";
      els.objective.textContent = bosses.length
        ? `${mate} · BOSS: ${bosses[0].name}`
        : `${mate} · SOBREVIVÊNCIA`;
    } else {
      els.wave.textContent = `ONDA ${wave} · T${diffTier}`;
      if (bossState === "WARN" && typeof SurvivalMega !== "undefined") {
        const def = SurvivalMega.def(survivalMegaTypeId);
        els.objective.textContent = `MEGA: ${def.name}`;
      } else if (megaBoss && megaBoss.survivalMode && bossState === "FIGHT") {
        const vLeft = SurvivalMega.getVulnerableLeft();
        const ph = SurvivalMega.getPhase();
        els.objective.textContent =
          vLeft > 0
            ? `NÚCLEO EXPOSTO ${vLeft.toFixed(1)}s · F${ph}`
            : `FASE ${ph} — destrua os vitals`;
      } else {
        els.objective.textContent = bosses.length
          ? `BOSS: ${bosses[0].name}`
          : `PRESSÃO ${(1 + wave * 0.045 + elapsed * 0.0055).toFixed(1)} · + cura · surtos`;
      }
    }
    els.pad.textContent = Input.status();
    if (megaBoss && (bossState === "INTRO" || bossState === "FIGHT" || bossState === "OUTRO")) {
      if (els.bossHud) els.bossHud.classList.add("hidden");
      if (els.bossHudMega) els.bossHudMega.classList.remove("hidden");
      updateMegaBossHud();
    } else if (bosses[0]) {
      if (els.bossHud) els.bossHud.classList.remove("hidden");
      els.bossName.textContent = bosses[0].name;
      if (els.bossHp) els.bossHp.style.width = `${Math.max(0, (bosses[0].hp / bosses[0].maxHp) * 100)}%`;
      if (els.bossHudMega) els.bossHudMega.classList.add("hidden");
    } else {
      if (els.bossHud) els.bossHud.classList.add("hidden");
      if (els.bossHudMega) els.bossHudMega.classList.add("hidden");
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, w, h);
    const sx = shake ? rand(-shake, shake) : 0;
    const sy = shake ? rand(-shake, shake) : 0;
    ctx.translate(sx, sy);

    for (const st of stars) {
      ctx.fillStyle = `rgba(200,220,255,${0.25 + st.z * 0.5})`;
      ctx.fillRect(st.x, st.y, st.s, st.s);
      st.y += st.z * 12 * 0.016;
      if (st.y > h) st.y = 0;
    }

    rocks.forEach((r) => r.draw(ctx));
    enemies.forEach((e) => e.draw(ctx));
    bosses.forEach((b) => b.draw(ctx));
    if (megaBoss && (bossState === "INTRO" || bossState === "FIGHT" || bossState === "OUTRO")) megaBoss.draw(ctx, w, h);
    bossDrones.forEach((d) => d.draw(ctx));
    powers.forEach((p) => p.draw(ctx));
    bullets.forEach((b) => b.draw(ctx));
    particles.forEach((p) => p.draw(ctx));
    if (remote && mode === "link" && (state === "play" || state === "pause")) {
      remote.draw(ctx);
      ctx.save();
      ctx.fillStyle = "#d7f6ff";
      ctx.font = "13px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(remote.pilotName || "Piloto", remote.x, remote.y - remote.r - 16);
      ctx.restore();
    }
    if (player && state !== "menu" && state !== "link-lobby") {
      player.draw(ctx);
      ctx.save();
      ctx.strokeStyle = "rgba(77,232,255,0.25)";
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(player.x + Math.cos(player.aim) * 36, player.y + Math.sin(player.aim) * 36);
      ctx.stroke();
      ctx.restore();
    }
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - last) / 1000 || 0.016);
    last = t;
    const input = Input.snapshot();
    if (state === "menu" && els.menuPad) els.menuPad.textContent = Input.status();
    update(dt, input);
    draw();
    requestAnimationFrame(loop);
  }

  function readViewport() {
    const vv = window.visualViewport;
    if (!vv) {
      return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
    }
    return { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height };
  }

  function resize() {
    const box = readViewport();
    const root = document.documentElement;
    root.style.setProperty("--vv-top", box.top + "px");
    root.style.setProperty("--vv-left", box.left + "px");
    root.style.setProperty("--vv-width", box.width + "px");
    root.style.setProperty("--vv-height", box.height + "px");
    if (typeof Platform !== "undefined") Platform.sync();
    const handheld = typeof Platform !== "undefined" ? Platform.isMobile() : TouchControls.isTouchDevice();
    document.body.classList.toggle("short-screen", !!handheld && box.height < 430);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const nw = Math.max(1, Math.floor(box.width * dpr));
    const nh = Math.max(1, Math.floor(box.height * dpr));
    if (canvas.width === nw && canvas.height === nh) return;
    w = nw;
    h = nh;
    canvas.width = w;
    canvas.height = h;
    makeStars();
    if (player && state === "menu") {
      player.x = w / 2;
      player.y = h / 2;
    }
  }

  function shipMark(id) {
    const marks = {
      lanca: "32,10 46,50 32,40 18,50",
      dardo: "32,8 41,32 32,56 23,32",
      bastiao: "32,12 49,22 49,42 32,52 15,42 15,22",
    };
    const points = marks[id] || marks.lanca;
    return `<svg class="geo geo-${id}" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <polygon points="${points}" />
    </svg>`;
  }

  function paintShips() {
    els.shipGrid.innerHTML = SHIP_ROSTER.map((ship) => {
      const on = ship.id === selectedShipId ? " selected" : "";
      return `<button type="button" class="ship-card${on}" data-ship="${ship.id}">
        ${shipMark(ship.id)}
        <strong>${ship.name}</strong>
        <p>${ship.blurb}</p>
      </button>`;
    }).join("");
  }

  function openHangar(modeName) {
    AudioFx.resume();
    commitName(els.pilotName.value);
    pendingMode = modeName;
    selectedShipId = data().shipId || "lanca";
    state = "ships";
    syncShipSubtitle();
    paintShips();
    showView("ships");
  }

  function confirmShip() {
    selectedShipId = Save.setShip(selectedShipId);
    if (typeof Cloud !== "undefined") Cloud.sync();
    if (pendingMode === "story") {
      state = "brief";
      openStoryBrief();
      return;
    }
    if (pendingMode === "link-host") {
      linkShip = selectedShipId;
      linkName = commitName(els.pilotName.value) || "Piloto";
      if (els.viewLink) els.viewLink.classList.add("hosting");
      const room = Net.makeCode();
      els.linkRoom.textContent = room;
      Net.host(room);
      els.linkStatus.textContent = "Abrindo sala…";
      openLinkLobby();
      return;
    }
    if (pendingMode === "link-guest") {
      linkShip = selectedShipId;
      linkName = commitName(els.pilotName.value) || "Piloto";
      els.linkRoom.textContent = linkPendingCode;
      Net.join(linkPendingCode);
      els.linkStatus.textContent = "Entrando na sala…";
      openLinkLobby();
      return;
    }
    startSurvival(true);
  }

  function bind() {
    els.btnLink.addEventListener("click", openLink);
    els.btnLinkHost.addEventListener("click", createRoom);
    els.btnLinkJoin.addEventListener("click", enterRoom);
    els.btnLinkBack.addEventListener("click", goMenu);
    els.btnLinkStart.addEventListener("click", hostStartLink);
    els.btnLinkLobbyBack.addEventListener("click", leaveLinkLobby);
    els.linkCode.addEventListener("input", () => {
      els.linkCode.value = els.linkCode.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    });
    els.btnStory.addEventListener("click", () => openHangar("story"));
    els.btnSurvival.addEventListener("click", () => openHangar("survival"));
    els.btnShipGo.addEventListener("click", confirmShip);
    els.btnShipBack.addEventListener("click", () => {
      if (pendingMode === "link-host" || pendingMode === "link-guest") {
        pendingMode = "survival";
        state = "link";
        showView("link");
        return;
      }
      goMenu();
    });
    els.shipGrid.addEventListener("click", (ev) => {
      const card = ev.target.closest("[data-ship]");
      if (!card) return;
      selectedShipId = card.dataset.ship;
      paintShips();
    });
    els.btnContinue.addEventListener("click", continueSavedRun);
    els.btnEnter.addEventListener("click", enterHangar);
    els.btnHelp.addEventListener("click", () => {
      state = "help";
      showView("help");
    });
    els.btnHelpBack.addEventListener("click", goMenu);
    els.btnOptions.addEventListener("click", openOptions);
    els.btnPauseOptions.addEventListener("click", openOptions);
    els.btnOptBack.addEventListener("click", closeOptions);
    els.btnOptLayout.addEventListener("click", openLayoutEdit);
    els.btnOptReset.addEventListener("click", () => Settings.reset());
    const btnOptTestTouch = document.getElementById("btn-opt-test-touch");
    if (els.btnOptTest) els.btnOptTest.addEventListener("click", () => Settings.test());
    if (btnOptTestTouch) btnOptTestTouch.addEventListener("click", () => Settings.test());
    els.btnRanks.addEventListener("click", () => {
      fillRanks();
      state = "ranks";
      showView("ranks");
    });
    els.btnRanksBack.addEventListener("click", goMenu);
    els.btnBriefGo.addEventListener("click", () => startStoryStage(pendingStage));
    els.btnBriefBack.addEventListener("click", goMenu);
    els.btnResume.addEventListener("click", pauseToggle);
    els.btnPauseSave.addEventListener("click", () => {
      if (saveRunSession()) {
        els.flash.textContent = "SALVO";
        els.flash.style.opacity = "1";
        setTimeout(() => {
          els.flash.style.opacity = "0";
        }, 500);
      }
    });
    els.btnPauseMenu.addEventListener("click", () => {
      saveRunSession();
      goMenu();
    });
    els.btnSaveScore.addEventListener("click", () => {
      if (mode === "link") return;
      const name = commitName(els.overName.value);
      const shipId = data().shipId;
      const sig = saveRunSignature(name);
      if (scoreSaved && sig === lastSaveSignature) {
        els.saveMsg.textContent = "Essa combinação (nome e esta run) já foi salva.";
        return;
      }
      if (mode === "story") {
        Save.pushBoard("story", { name, score, extra: `fase ${stageId}`, shipId });
        if (typeof Cloud !== "undefined") Cloud.pushScore("story", { name, score, extra: `fase ${stageId}` });
      } else {
        Save.pushBoard("survival", { name, score, extra: `onda ${wave}`, shipId });
        if (typeof Cloud !== "undefined") Cloud.pushScore("survival", { name, score, extra: `onda ${wave}` });
      }
      scoreSaved = true;
      lastSaveSignature = sig;
      els.saveMsg.textContent = `Registro de ${name || "ANÔNIMO"} salvo.`;
    });
    els.btnRetry.addEventListener("click", () => {
      if (mode === "story") startStoryStage(stageId);
      else startSurvival();
    });
    els.btnOverMenu.addEventListener("click", goMenu);
    els.btnNext.addEventListener("click", () => startStoryStage(stageId + 1));
    els.btnClearMenu.addEventListener("click", goMenu);
    els.btnWinSave.addEventListener("click", () => {
      const name = commitName(els.winName.value);
      const sig = saveRunSignature(name);
      if (scoreSaved && sig === lastSaveSignature) {
        els.winMsg.textContent = "Essa combinação (nome e esta campanha) já foi salva.";
        return;
      }
      Save.pushBoard("story", { name, score, extra: "campanha" });
      if (typeof Cloud !== "undefined") Cloud.pushScore("story", { name, score, extra: "campanha" });
      scoreSaved = true;
      lastSaveSignature = sig;
      els.winMsg.textContent = `Vitória de ${name || "ANÔNIMO"} no ranking.`;
    });
    els.btnWinMenu.addEventListener("click", goMenu);
    els.pilotName.addEventListener("change", () => commitName(els.pilotName.value));
  }

  function init() {
    canvas = document.getElementById("game");
    ctx = canvas.getContext("2d");
    els.overlay = document.getElementById("overlay");
    els.hud = document.getElementById("hud");
    els.score = document.getElementById("score");
    els.combo = document.getElementById("combo");
    els.hp = document.getElementById("hp-bar");
    els.hpNum = document.getElementById("hp-num");
    els.shipName = document.getElementById("ship-name");
    els.shipGrid = document.getElementById("ship-grid");
    els.btnShipGo = document.getElementById("btn-ship-go");
    els.btnShipBack = document.getElementById("btn-ship-back");
    els.time = document.getElementById("time");
    els.wave = document.getElementById("wave");
    els.objective = document.getElementById("objective");
    els.pad = document.getElementById("pad-status");
    els.flash = document.getElementById("combo-flash");
    els.menuPad = document.getElementById("menu-pad");
    els.pilotName = document.getElementById("pilot-name");
    els.storySave = document.getElementById("story-save");
    els.btnStory = document.getElementById("btn-story");
    els.btnSurvival = document.getElementById("btn-survival");
    els.btnLink = document.getElementById("btn-link");
    els.btnLinkHost = document.getElementById("btn-link-host");
    els.btnLinkJoin = document.getElementById("btn-link-join");
    els.btnLinkBack = document.getElementById("btn-link-back");
    els.linkCode = document.getElementById("link-code");
    els.linkRoom = document.getElementById("link-room");
    els.linkStatus = document.getElementById("link-status");
    els.viewLink = document.getElementById("view-link");
    els.linkLobbyCode = document.getElementById("link-lobby-code");
    els.linkLobbyStatus = document.getElementById("link-lobby-status");
    els.linkLobbyMate = document.getElementById("link-lobby-mate");
    els.btnLinkStart = document.getElementById("btn-link-start");
    els.btnLinkLobbyBack = document.getElementById("btn-link-lobby-back");
    els.shipSubtitle = document.getElementById("ship-subtitle");
    els.btnContinue = document.getElementById("btn-continue");
    els.btnRanks = document.getElementById("btn-ranks");
    els.btnEnter = document.getElementById("btn-enter");
    els.btnHelp = document.getElementById("btn-help");
    els.btnHelpBack = document.getElementById("btn-help-back");
    els.btnOptions = document.getElementById("btn-options");
    els.btnPauseOptions = document.getElementById("btn-pause-options");
    els.btnOptBack = document.getElementById("btn-opt-back");
    els.btnOptLayout = document.getElementById("btn-opt-layout");
    els.btnOptReset = document.getElementById("btn-opt-reset");
    els.btnOptTest = document.getElementById("btn-opt-test");
    els.briefKicker = document.getElementById("brief-kicker");
    els.briefTitle = document.getElementById("brief-title");
    els.briefText = document.getElementById("brief-text");
    els.briefGoal = document.getElementById("brief-goal");
    els.btnBriefGo = document.getElementById("btn-brief-go");
    els.btnBriefBack = document.getElementById("btn-brief-back");
    els.rankSurvival = document.getElementById("rank-survival");
    els.rankStory = document.getElementById("rank-story");
    els.btnRanksBack = document.getElementById("btn-ranks-back");
    els.btnResume = document.getElementById("btn-resume");
    els.btnPauseSave = document.getElementById("btn-pause-save");
    els.btnPauseMenu = document.getElementById("btn-pause-menu");
    els.overText = document.getElementById("over-text");
    els.overName = document.getElementById("over-name");
    els.overNameRow = document.getElementById("over-name-row");
    els.btnSaveScore = document.getElementById("btn-save-score");
    els.rankNote = document.getElementById("rank-note");
    els.btnRetry = document.getElementById("btn-retry");
    els.btnOverMenu = document.getElementById("btn-over-menu");
    els.saveMsg = document.getElementById("save-msg");
    els.clearText = document.getElementById("clear-text");
    els.btnNext = document.getElementById("btn-next");
    els.btnClearMenu = document.getElementById("btn-clear-menu");
    els.winText = document.getElementById("win-text");
    els.winName = document.getElementById("win-name");
    els.btnWinSave = document.getElementById("btn-win-save");
    els.btnWinMenu = document.getElementById("btn-win-menu");
    els.winMsg = document.getElementById("win-msg");
    els.bossHud = document.getElementById("boss-hud");
    els.bossName = document.getElementById("boss-name");
    els.bossHp = document.getElementById("boss-hp");
    els.bossHudMega = document.getElementById("boss-hud-mega");
    els.wsLeftFill = document.getElementById("ws-left-fill");
    els.wsTopFill = document.getElementById("ws-top-fill");
    els.wsRightFill = document.getElementById("ws-right-fill");
    els.bossCoreFill = document.getElementById("boss-core-fill");
    els.bossShieldOverlay = document.getElementById("boss-shield-overlay");

    Input.attach(canvas);
    Settings.bind();
    selectedShipId = data().shipId || "lanca";
    resize();
    player = new Player(w / 2, h / 2, selectedShipId);
    window.addEventListener("resize", resize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", resize);
      window.visualViewport.addEventListener("scroll", resize);
    }
    bind();
    Net.on(onNet);
    refreshTitle();
    if (typeof Cloud !== "undefined") {
      Cloud.pull().then(() => refreshTitle());
    }
    if (data().options.introSeen) {
      state = "menu";
      showView("title");
    } else {
      state = "splash";
      showView("splash");
    }
    syncMenuPointer();
    requestAnimationFrame(loop);
  }

  return { init };
})();
