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
  let lastBossWave = 0;
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

  function showView(name) {
    document.querySelectorAll(".panel").forEach((p) => {
      p.classList.toggle("hidden", p.dataset.view !== name);
    });
    els.overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    els.overlay.classList.add("hidden");
  }

  function refreshTitle() {
    const s = data();
    els.pilotName.value = s.name;
    if (s.story.cleared >= Story.stages.length) {
      els.storySave.textContent = `${s.name || "Piloto"} · campanha completa · recorde local salvo`;
    } else {
      els.storySave.textContent = s.name
        ? `${s.name} · história na fase ${s.story.nextStage} / ${Story.stages.length} · score campanha ${s.story.campaignScore.toLocaleString("pt-BR")}`
        : "Digite um nome para gravar ranking e progresso da história.";
    }
  }

  function fillRanks() {
    const s = data();
    const line = (e) => `${e.name} — ${e.score.toLocaleString("pt-BR")}${e.extra ? " · " + e.extra : ""}`;
    els.rankSurvival.innerHTML = s.survivalBoard.length
      ? s.survivalBoard.map((e) => `<li>${line(e)}</li>`).join("")
      : "<li>Nenhum registro ainda</li>";
    els.rankStory.innerHTML = s.storyBoard.length
      ? s.storyBoard.map((e) => `<li>${line(e)}</li>`).join("")
      : "<li>Nenhum registro ainda</li>";
  }

  function caps() {
    const bossHere = bosses.length > 0;
    const rockMax = bossHere ? 6 : Math.min(12, 6 + Math.floor(wave / 3));
    const enemyMax = bossHere ? 3 : Math.min(7, 3 + Math.floor(wave / 4));
    return { rockMax, enemyMax };
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
    player = new Player(w * 0.5, h * 0.5);
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
    const n = mode === "story" ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const p = spawnEdge(w, h, 80);
      rocks.push(new Asteroid(p.x, p.y, 2 + (Math.random() < 0.5 ? 1 : 0)));
    }
  }

  function startSurvival() {
    AudioFx.resume();
    commitName(els.pilotName.value);
    mode = "survival";
    score = 0;
    stageStartScore = 0;
    lastBossWave = 0;
    resetArena();
    state = "play";
    hideOverlay();
    els.hud.classList.remove("hidden");
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
    mode = "story";
    stageId = id;
    const s = data();
    score = s.story.campaignScore || 0;
    stageStartScore = score;
    lastBossWave = 0;
    resetArena();
    if (Story.get(id).type === "boss") spawnEnemy = 2.5;
    state = "play";
    hideOverlay();
    els.hud.classList.remove("hidden");
  }

  function persistStory(partial) {
    const s = data();
    Save.saveStory({ ...s.story, ...partial });
    refreshTitle();
  }

  function commitName(value) {
    const name = Save.setName(value);
    if (els.pilotName) els.pilotName.value = name;
    if (els.overName && !els.overName.value) els.overName.value = name;
    if (els.winName && !els.winName.value) els.winName.value = name;
    return name;
  }

  function goMenu() {
    state = "menu";
    els.hud.classList.add("hidden");
    refreshTitle();
    showView("title");
  }

  function gameOver() {
    state = "dead";
    AudioFx.lose();
    rumble(280, 0.7);
    scoreSaved = false;
    els.saveMsg.textContent = "";
    const s = data();
    els.overName.value = s.name;
    if (mode === "story") {
      persistStory({ nextStage: stageId, campaignScore: stageStartScore });
      els.overText.textContent = `Fase ${stageId} · score da run ${score.toLocaleString("pt-BR")} · ao tentar de novo você volta ao início desta fase`;
    } else {
      els.overText.textContent = `Score ${score.toLocaleString("pt-BR")} · onda ${wave} · ${formatTime(elapsed)}`;
    }
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
    if (mode !== "survival") return;
    if (bosses.length) return;
    if (wave < 3) return;
    const miniEvery = 4;
    const bossEvery = 8;
    const atMini = wave % miniEvery === 0 && wave % bossEvery !== 0;
    const atBoss = wave % bossEvery === 0;
    if (!atMini && !atBoss) return;
    const already = bosses.length;
    if (already) return;
    if (wave === lastBossWave) return;
    lastBossWave = wave;
    spawnBoss(atBoss ? (wave >= 16 ? "core" : "cruiser") : wave >= 8 ? "mini_hunter" : "mini_rock");
  }

  function spawnWaveStuff(dt) {
    spawnRock -= dt;
    spawnEnemy -= dt;
    spawnHeal -= dt;
    const { rockMax, enemyMax } = caps();
    const rockRate = Math.max(1.15, 2.4 - elapsed * 0.012);
    const enemyRate = Math.max(2.1, 6.2 - elapsed * 0.018);
    if (spawnRock <= 0 && rocks.length < rockMax) {
      spawnRock = rockRate;
      const p = spawnEdge(w, h);
      const size = Math.random() < 0.45 ? 3 : Math.random() < 0.75 ? 2 : 1;
      const toward = Math.atan2(player.y - p.y, player.x - p.x) + rand(-0.5, 0.5);
      const spd = 36 + Math.min(wave, 12) * 5;
      rocks.push(new Asteroid(p.x, p.y, size, Math.cos(toward) * spd, Math.sin(toward) * spd));
    }
    const enemyStart = mode === "story" && Story.get(stageId).type === "boss" ? 1.2 : 7;
    if (elapsed > enemyStart && spawnEnemy <= 0 && enemies.length < enemyMax) {
      spawnEnemy = enemyRate;
      const p = spawnEdge(w, h);
      const type = elapsed > 22 && Math.random() < 0.38 ? "shooter" : "chaser";
      enemies.push(new Enemy(p.x, p.y, type));
    }
    if (spawnHeal <= 0 && player.hp < player.maxHp) {
      spawnHeal = player.hp < 40 ? 11 : 17;
      const p = spawnEdge(w, h, 60);
      dropHeal(Math.max(80, Math.min(w - 80, p.x)), Math.max(80, Math.min(h - 80, p.y)));
    }

    const newWave = 1 + Math.floor(elapsed / 22);
    if (newWave !== wave) {
      wave = newWave;
      if (mode === "survival") maybeSpawnSurvivalBoss();
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
    if (st.type === "boss" && elapsed > 2.2 && !bosses.length && !bossPhase) {
      bossPhase = true;
      spawnBoss(st.boss);
    }
  }

  function tryShoot(input) {
    let aimX = 0;
    let aimY = 0;
    let want = false;
    if (input.pad && (input.pad.right.mag > 0.18 || input.pad.r2 > 0.12)) {
      if (input.pad.right.mag > 0.18) {
        aimX = input.pad.right.x;
        aimY = input.pad.right.y;
      } else {
        aimX = Math.cos(player.aim);
        aimY = Math.sin(player.aim);
      }
      want = input.pad.shoot;
    } else {
      aimX = input.mouse.x - player.x;
      aimY = input.mouse.y - player.y;
      want = input.kbShoot;
    }
    if (Math.hypot(aimX, aimY) > 0.01) player.aim = Math.atan2(aimY, aimX);
    if (!want || player.cool > 0) return;
    player.cool = player.rapid > 0 ? 0.07 : 0.13;
    const n = player.multi > 0 ? 3 : 1;
    const spread = 0.18;
    for (let i = 0; i < n; i++) {
      const a = player.aim + (n === 1 ? 0 : (i - 1) * spread);
      bullets.push(
        new Bullet(player.x + Math.cos(a) * 18, player.y + Math.sin(a) * 18, a, 620, true, "#4de8ff")
      );
    }
    AudioFx.shoot();
  }

  function collide() {
    const { rockMax } = caps();
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (!b.fromPlayer) {
        if (dist2(b, player) < (b.r + player.r) * (b.r + player.r)) {
          bullets.splice(i, 1);
          if (player.hurt(b.dmg || 16)) {
            AudioFx.hit();
            shake = 10;
            rumble(120, 0.55);
            burst(player.x, player.y, "#4de8ff", 12, 220);
          }
        }
        continue;
      }
      let hit = false;
      for (let r = rocks.length - 1; r >= 0; r--) {
        const rock = rocks[r];
        if (dist2(b, rock) < (b.r + rock.r) * (b.r + rock.r)) {
          bullets.splice(i, 1);
          rock.hp -= 1;
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
          en.hp -= 1;
          burst(b.x, b.y, "#ff4d9a", 5, 160);
          if (en.hp <= 0) {
            AudioFx.explode(2);
            addScore(en.type === "shooter" ? 180 : 120, en.x, en.y);
            enemies.splice(e, 1);
            burst(en.x, en.y, "#c084fc", 16, 240);
            rumble(40, 0.2);
          }
          hit = true;
          break;
        }
      }
      if (hit) continue;
      for (let k = bosses.length - 1; k >= 0; k--) {
        const boss = bosses[k];
        if (dist2(b, boss) < (b.r + boss.r) * (b.r + boss.r)) {
          bullets.splice(i, 1);
          boss.hp -= 1;
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

    for (const rock of rocks) {
      if (dist2(rock, player) < (rock.r * 0.85 + player.r) * (rock.r * 0.85 + player.r)) {
        if (player.hurt(16)) {
          AudioFx.hit();
          shake = 12;
          rumble(140, 0.55);
        }
      }
    }
    for (const en of enemies) {
      if (dist2(en, player) < (en.r + player.r) * (en.r + player.r)) {
        if (player.hurt(14)) {
          AudioFx.hit();
          shake = 10;
          rumble(120, 0.5);
        }
      }
    }
    for (const boss of bosses) {
      if (dist2(boss, player) < (boss.r * 0.8 + player.r) * (boss.r * 0.8 + player.r)) {
        if (player.hurt(20)) {
          AudioFx.hit();
          shake = 16;
          rumble(180, 0.7);
        }
      }
    }
    for (let i = powers.length - 1; i >= 0; i--) {
      const p = powers[i];
      if (dist2(p, player) < (p.r + player.r) * (p.r + player.r)) {
        if (p.type === "rapid") player.rapid = 6;
        if (p.type === "shield") player.shield = 8;
        if (p.type === "multi") player.multi = 7;
        if (p.type === "heal") {
          player.heal(36);
          AudioFx.heal();
        } else AudioFx.power();
        powers.splice(i, 1);
      }
    }
  }

  function formatTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function update(dt, input) {
    if (state === "menu" || state === "brief" || state === "ranks") return;
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
    comboTime -= dt;
    if (comboTime <= 0) combo = 0;

    player.update(dt, input, w, h);
    tryShoot(input);
    spawnWaveStuff(dt);

    rocks.forEach((r) => r.update(dt, w, h));
    enemies.forEach((e) => e.update(dt, w, h, player, bullets));
    bosses.forEach((b) => b.update(dt, w, h, player, bullets));
    bullets.forEach((b) => b.update(dt, w, h));
    particles.forEach((p) => p.update(dt));
    powers.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => b.life > 0 && b.x > -40 && b.x < w + 40 && b.y > -40 && b.y < h + 40);
    particles = particles.filter((p) => p.life > 0);
    powers = powers.filter((p) => p.life > 0);

    collide();
    shake *= 0.88;
    if (player.hp <= 0) gameOver();
    hud();
  }

  function hud() {
    els.score.textContent = score.toLocaleString("pt-BR");
    els.combo.textContent = `x${multiplier()}` + (combo > 1 ? `  (${combo})` : "");
    els.hp.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
    els.time.textContent = formatTime(elapsed);
    if (mode === "story") {
      const st = Story.get(stageId);
      els.wave.textContent = `FASE ${st.id} · ${st.title}`;
      els.objective.textContent = Story.objectiveText(st, {
        score: stageScore,
        elapsed,
        bossPhase,
        bossAlive: bosses.length > 0,
        bossName: bosses[0] && bosses[0].name,
      });
    } else {
      els.wave.textContent = `ONDA ${wave}`;
      els.objective.textContent = bosses.length ? `BOSS: ${bosses[0].name}` : "SOBREVIVA · pegue + para curar";
    }
    els.pad.textContent = Input.status();
    if (bosses[0]) {
      els.bossHud.classList.remove("hidden");
      els.bossName.textContent = bosses[0].name;
      els.bossHp.style.width = `${Math.max(0, (bosses[0].hp / bosses[0].maxHp) * 100)}%`;
    } else {
      els.bossHud.classList.add("hidden");
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
    powers.forEach((p) => p.draw(ctx));
    bullets.forEach((b) => b.draw(ctx));
    particles.forEach((p) => p.draw(ctx));
    if (player && state !== "menu") {
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
    if (state === "menu") els.menuPad.textContent = Input.status();
    update(dt, input);
    draw();
    requestAnimationFrame(loop);
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.floor(window.innerWidth * dpr);
    h = Math.floor(window.innerHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    makeStars();
    if (player && state === "menu") {
      player.x = w / 2;
      player.y = h / 2;
    }
  }

  function bind() {
    els.btnStory.addEventListener("click", () => {
      state = "brief";
      openStoryBrief();
    });
    els.btnSurvival.addEventListener("click", startSurvival);
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
      commitName(els.pilotName.value || data().name);
      if (mode === "story") persistStory({ nextStage: stageId, campaignScore: score });
      els.flash.textContent = "SALVO";
      els.flash.style.opacity = "1";
      setTimeout(() => {
        els.flash.style.opacity = "0";
      }, 500);
    });
    els.btnPauseMenu.addEventListener("click", () => {
      if (mode === "story") persistStory({ nextStage: stageId, campaignScore: score });
      goMenu();
    });
    els.btnSaveScore.addEventListener("click", () => {
      const name = commitName(els.overName.value);
      if (scoreSaved) {
        els.saveMsg.textContent = "Essa run já foi salva.";
        return;
      }
      if (mode === "story") {
        Save.pushBoard("story", { name, score, extra: `fase ${stageId}` });
      } else {
        Save.pushBoard("survival", { name, score, extra: `onda ${wave}` });
      }
      scoreSaved = true;
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
      if (scoreSaved) {
        els.winMsg.textContent = "Já registrado.";
        return;
      }
      Save.pushBoard("story", { name, score, extra: "campanha" });
      scoreSaved = true;
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
    els.btnRanks = document.getElementById("btn-ranks");
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
    els.btnSaveScore = document.getElementById("btn-save-score");
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

    Input.attach(canvas);
    resize();
    player = new Player(w / 2, h / 2);
    window.addEventListener("resize", resize);
    bind();
    refreshTitle();
    showView("title");
    requestAnimationFrame(loop);
  }

  return { init };
})();
