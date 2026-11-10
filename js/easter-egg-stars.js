/**
 * Mini-Quest das Estrelas — Easter egg do Modo Sobrevivência.
 * Ajuste NAME_OR_INITIALS antes de publicar a homenagem.
 */
const EasterEggStars = (() => {
  const CONFIG = {
    TRIGGER_WAVE: 2,
    NAME_OR_INITIALS: "Emilly",
    BLESSING_PHRASE: "Meu anjo",
    STAR_COLOR: "#ff69b4",
    STAR_COLOR_ALT: "#da70d6",
    BUFF_DURATION: 10000,
    EVENT_MS: 180000,
    STAR_RADIUS: 7,
    COLLECT_DIST_PAD: 5,
    STEALTH_DRIFT: true,
    HINT_SIZE: [1.35, 2.45],
    HINT_ALPHA: [0.52, 0.88],
    STARFIELD_SLOW_SEC: 3,
    STARFIELD_SLOW_MUL: 0.22,
    CELEBRATION_SEC: 5.4,
    MARGIN_X: 0.1,
    MARGIN_Y: 0.1,
  };

  let api = null;
  let completed = false;
  let missed = false;
  let spawned = false;
  let stars = [];
  let collectOrder = [];
  let celebrationT = 0;
  let starfieldSlowT = 0;
  let buffT = 0;
  let isEmillyBuffActive = false;
  let emillyBuffTimer = 0;
  let glowT = 0;
  let playerRef = null;
  const easterEggParticles = [];

  function bind(hooks) {
    api = hooks;
  }

  function reset() {
    completed = false;
    missed = false;
    spawned = false;
    stars = [];
    collectOrder = [];
    celebrationT = 0;
    starfieldSlowT = 0;
    buffT = 0;
    isEmillyBuffActive = false;
    emillyBuffTimer = 0;
    glowT = 0;
    playerRef = null;
    easterEggParticles.length = 0;
  }

  function isSurvivalActive(ctx) {
    return ctx && ctx.likeSurvival && ctx.likeSurvival();
  }

  function spawnCornerStars(w, h) {
    const mx = w * CONFIG.MARGIN_X;
    const my = h * CONFIG.MARGIN_Y;
    const pts = [
      { x: mx, y: my },
      { x: w - mx, y: my },
      { x: mx, y: h - my },
      { x: w - mx, y: h - my },
    ];
    stars = pts.map((p) => ({
      x: p.x + rand(-12, 12),
      y: p.y + rand(-12, 12),
      radius: CONFIG.STAR_RADIUS,
      collected: false,
      glowPhase: Math.random() * Math.PI * 2,
      s: rand(CONFIG.HINT_SIZE[0], CONFIG.HINT_SIZE[1]),
      z: rand(0.55, 1.05),
    }));
    spawned = true;
    collectOrder = [];
  }

  function onWave(wave, w, h, ctx) {
    if (!isSurvivalActive(ctx) || completed || missed) return;
    if (wave === CONFIG.TRIGGER_WAVE && !spawned) spawnCornerStars(w, h);
    if (wave > CONFIG.TRIGGER_WAVE && spawned && !completed) {
      missed = true;
      stars = [];
      spawned = false;
    }
  }

  function collectRadius(player, star) {
    const r = player.r + star.radius + CONFIG.COLLECT_DIST_PAD;
    return r * r;
  }

  function collectOne(star, ctx) {
    star.collected = true;
    collectOrder.push({ x: star.x, y: star.y });
    if (api && api.burst) {
      api.burst(star.x, star.y, "rgba(210,225,255,0.9)", 4, 95);
    }
    if (collectOrder.length >= 4) activateBlessing(ctx);
  }

  function activateBlessing(ctx) {
    completed = true;
    celebrationT = CONFIG.CELEBRATION_SEC;
    starfieldSlowT = CONFIG.STARFIELD_SLOW_SEC;
    buffT = CONFIG.BUFF_DURATION / 1000;
    isEmillyBuffActive = true;
    emillyBuffTimer = CONFIG.EVENT_MS;
    const p = ctx.player;
    playerRef = p;
    if (p) {
      p.heal(p.maxHp * 0.5);
      const shieldSec = CONFIG.BUFF_DURATION / 1000;
      p.shield = Math.max(p.shield, shieldSec);
      p.starBlessing = shieldSec;
    }
    if (api && api.burst) api.burst(p.x, p.y, CONFIG.STAR_COLOR, 24, 260);
    if (typeof AudioFx !== "undefined") {
      if (AudioFx.starCollect) AudioFx.starCollect();
      if (AudioFx.heal) AudioFx.heal();
    }
  }

  function emitBlessingTrail(p, dt) {
    if (buffT <= 0 || !api || !api.burst) return;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp < 12) return;
    if (Math.random() > 0.55) return;
    const back = Math.atan2(p.vy, p.vx) + Math.PI;
    const dist = p.r + 6;
    const x = p.x + Math.cos(back) * dist;
    const y = p.y + Math.sin(back) * dist;
    const c = Math.random() < 0.35 ? CONFIG.STAR_COLOR : CONFIG.STAR_COLOR_ALT;
    api.burst(x, y, c, 1, 90);
  }

  function update(dt, ctx) {
    if (!isSurvivalActive(ctx)) return;
    glowT += dt;

    if (buffT > 0) {
      buffT -= dt;
      if (ctx.player) {
        ctx.player.starBlessing = Math.max(buffT, ctx.player.starBlessing || 0);
        if (completed) emitBlessingTrail(ctx.player, dt);
      }
    } else if (ctx.player) {
      ctx.player.starBlessing = 0;
    }

    if (isEmillyBuffActive) {
      emillyBuffTimer -= dt * 1000;
      if (emillyBuffTimer <= 0) {
        emillyBuffTimer = 0;
        isEmillyBuffActive = false;
      }
    }

    if (celebrationT > 0) celebrationT -= dt;
    if (starfieldSlowT > 0) starfieldSlowT -= dt;

    if (spawned && !completed && !missed && CONFIG.STEALTH_DRIFT) {
      const driftMul = starfieldSlowT > 0 ? CONFIG.STARFIELD_SLOW_MUL : 1;
      const step = driftMul * dt;
      for (const st of stars) {
        if (st.collected) continue;
        st.y += st.z * 12 * step;
        if (st.y > ctx.h) st.y = 0;
      }
    }

    if (completed || missed || !spawned) return;
    if (ctx.wave !== CONFIG.TRIGGER_WAVE) return;

    const p = ctx.player;
    if (!p) return;
    for (const st of stars) {
      if (st.collected) continue;
      if (dist2(p, st) <= collectRadius(p, st)) collectOne(st, ctx);
    }
  }

  function starfieldSpeed() {
    if (starfieldSlowT > 0) return CONFIG.STARFIELD_SLOW_MUL;
    return 1;
  }

  function drawSoftHintStar(ctx, x, y, size, alpha) {
    const r = size * 2.6;
    const inner = r * 0.38;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(glowT * 0.35);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(220, 210, 255, 0.95)";
    ctx.shadowColor = "rgba(255, 160, 220, 0.55)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? r : inner;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Um tiquinho acima do fundo: quem olhar o canto enxerga, sem gritar “missão”. */
  function drawCollectibles(ctx) {
    if (completed || missed || !stars.length) return;
    for (const st of stars) {
      if (st.collected) continue;
      const pulse = 1 + Math.sin(glowT * 2.4 + st.glowPhase) * 0.14;
      const size = st.s * pulse * 1.15;
      const t = (st.z - CONFIG.HINT_ALPHA[0]) / (CONFIG.HINT_ALPHA[1] - CONFIG.HINT_ALPHA[0]);
      const a = CONFIG.HINT_ALPHA[0] + Math.max(0, Math.min(1, t)) * (CONFIG.HINT_ALPHA[1] - CONFIG.HINT_ALPHA[0]);
      const tw = size * 1.1;
      ctx.fillStyle = `rgba(195, 215, 255, ${a * 0.35})`;
      ctx.fillRect(st.x - 1, st.y - 1, tw + 2, tw + 2);
      drawSoftHintStar(ctx, st.x + tw * 0.5, st.y + tw * 0.5, size, a);
    }
  }

  function celebrationAge() {
    return CONFIG.CELEBRATION_SEC - celebrationT;
  }

  function celebrationAlpha() {
    const age = celebrationAge();
    const fadeIn = Math.min(1, age / 0.4);
    const fadeOut = Math.min(1, celebrationT / 0.75);
    const inE = 1 - Math.pow(1 - fadeIn, 3);
    return inE * fadeOut;
  }

  function drawVignette(ctx, w, h, alpha) {
    const cx = w * 0.5;
    const cy = h * 0.48;
    const g = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.08, cx, cy, Math.max(w, h) * 0.55);
    g.addColorStop(0, `rgba(12, 6, 18, ${0.62 * alpha})`);
    g.addColorStop(0.55, `rgba(5, 7, 15, ${0.28 * alpha})`);
    g.addColorStop(1, "rgba(5, 7, 15, 0)");
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawEmillyEasterEgg(ctx, x, y, player, gameTime, alphaMul, viewW, viewH) {
    ctx.save();
    if (alphaMul < 1) ctx.globalAlpha *= alphaMul;

    if (player) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      const controlX = (x + player.x) / 2 + Math.sin(gameTime * 2) * 20;
      const controlY = (y + player.y) / 2 + Math.cos(gameTime * 2) * 20;
      ctx.quadraticCurveTo(controlX, controlY, player.x, player.y);
      ctx.strokeStyle = "rgba(255, 105, 180, 0.35)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const pulseScale = 1 + Math.sin(gameTime * 5) * 0.1;
    const heartScale = Math.min(viewW, viewH) * 0.0048 + 1.1;

    ctx.shadowColor = "#FF1493";
    ctx.shadowBlur = 18 + Math.sin(gameTime * 4) * 6;
    ctx.fillStyle = "#FF69B4";

    ctx.translate(x, y);
    ctx.scale(pulseScale * heartScale, pulseScale * heartScale);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-12, -12, -20, 5, 0, 20);
    ctx.bezierCurveTo(20, 5, 12, -12, 0, 0);
    ctx.fill();

    ctx.scale(1 / (pulseScale * heartScale), 1 / (pulseScale * heartScale));
    ctx.translate(-x, -y);
    ctx.shadowBlur = 0;

    if (Math.random() < 0.4) {
      easterEggParticles.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y + 5,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -Math.random() * 1.2 - 0.4,
        size: Math.random() * 2 + 1,
        alpha: 1,
        color: Math.random() > 0.5 ? "#FFE4EF" : "#FF69B4",
      });
    }

    for (let i = easterEggParticles.length - 1; i >= 0; i--) {
      const p = easterEggParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.015;
      if (p.alpha <= 0) {
        easterEggParticles.splice(i, 1);
        continue;
      }
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alphaMul * p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = alphaMul;

    const title = `${CONFIG.NAME_OR_INITIALS} — ${CONFIG.BLESSING_PHRASE}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = "bold 15px 'Segoe UI', sans-serif";
    ctx.fillStyle = "#FFE4EF";
    ctx.shadowColor = "#FF1493";
    ctx.shadowBlur = 10;
    ctx.fillText(title, x, y + 36);
    ctx.font = "11px 'Segoe UI', sans-serif";
    ctx.fillStyle = "#FFB6C1";
    ctx.shadowBlur = 4;
    ctx.fillText("Bênção das estrelas", x, y + 52);

    ctx.restore();
  }

  function drawCelebration(ctx, w, h) {
    if (celebrationT <= 0) return;
    const alpha = celebrationAlpha();
    drawVignette(ctx, w, h, alpha * 0.65);

    const cx = w * 0.5;
    const cy = h * 0.42;
    drawEmillyEasterEgg(ctx, cx, cy, playerRef, glowT, alpha, w, h);
  }

  function objectiveOverride() {
    if (!isEmillyBuffActive) return null;
    const sec = Math.max(0, Math.ceil(emillyBuffTimer / 1000));
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, "0");
    return `EMILLY · combo travado · ${m}:${s}`;
  }

  return {
    CONFIG,
    bind,
    reset,
    onWave,
    update,
    starfieldSpeed,
    drawCollectibles,
    drawCelebration,
    objectiveOverride,
    isEmillyBuffActive() {
      return isEmillyBuffActive;
    },
    emillyBuffTimer() {
      return emillyBuffTimer;
    },
  };
})();
