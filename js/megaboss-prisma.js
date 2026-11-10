/**
 * Mega boss PRISMA — triângulo no topo, 3 canhões-vital, varredura com laser telegrafado.
 */
class PrismaMega {
  constructor(x, y, opts) {
    opts = opts || {};
    this.kindFlag = "mega";
    this.kind = "mega";
    this.survivalMode = !!opts.survivalMode;
    this.profileId = "prisma";
    this.name = "PRISMA";
    this.tier = "boss";
    this.x = x;
    this.y = y;
    this.introStartY = -160;
    this.targetAnchorY = null;
    this.spin = 0;
    this.triRadius = 92;
    this.r = this.triRadius + 24;
    this.vitalHitPad = 16;
    this.coreHp = 520;
    this.maxCoreHp = 520;
    this.shieldActive = true;
    this.alive = true;
    this.score = 9200;
    this.goalX = null;
    this.goalY = null;
    this.wanderWait = 0;
    this.moveSpeed = 56;
    this.t = 0;
    this.pulseAngle = 0;
    this.vAngles = [-Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2) / 3, (-Math.PI / 2) + ((Math.PI * 4) / 3)];
    this.weakSpots = this.vAngles.map((a, i) => ({
      id: `v${i}`,
      offsetX: Math.cos(a) * this.triRadius,
      offsetY: Math.sin(a) * this.triRadius,
      r: 20,
      hp: 170,
      maxHp: 170,
      alive: true,
      cannonAngle: a,
    }));
    this.currentPattern = "IDLE";
    this.patternTimer = 0.6;
    this.patternScale = 1;
    this.telegraphScale = 1;
    this.survivalPhase = 1;
    this.introLerp = 0;
    this._pace = 1;
    this.sweepCanon = 0;
    this.sweepStart = 0;
    this.sweepEnd = 0;
    this.sweepPos = 0;
    this.sweepOrigin = { x: 0, y: 0 };
    this.palette = { stroke: "#4de8ff", fill: "#0a1420", vital: "#ffb347" };
  }

  orientRad() {
    return this.spin;
  }

  /** Raio para ricochete no núcleo — sem “bolha” em volta do triângulo. */
  bulletHullRadius() {
    return this.shieldActive ? 22 : 30;
  }

  vitalHitRadius(spot) {
    return (spot.r || 20) + (this.vitalHitPad || 10);
  }

  getWeakSpotWorldPos(spot) {
    const cos = Math.cos(this.spin);
    const sin = Math.sin(this.spin);
    return {
      x: this.x + spot.offsetX * cos - spot.offsetY * sin,
      y: this.y + spot.offsetX * sin + spot.offsetY * cos,
    };
  }

  syncShieldFromWeakSpots() {
    if (!this.shieldActive) return;
    const anyAlive = this.weakSpots.some((s) => s.alive);
    if (!anyAlive) {
      if (this.survivalMode && typeof SurvivalMega !== "undefined") SurvivalMega.onAllVitalsDown(this);
      else this.shieldActive = false;
      AudioFx.explode(4);
    }
  }

  pickWanderGoal(w, h) {
    const m = this.r + 28;
    this.goalX = rand(m, Math.max(m + 8, w - m));
    this.goalY = rand(h * 0.16, h * 0.62);
    this.wanderWait = rand(2.4, 4.6);
  }

  wander(dt, w, h) {
    if (this.goalX == null) this.pickWanderGoal(w, h);
    this.wanderWait -= dt;
    const dx = this.goalX - this.x;
    const dy = this.goalY - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 22 || this.wanderWait <= 0) this.pickWanderGoal(w, h);
    const speed = this.currentPattern === "SWEEP_FIRE" ? 36 : this.moveSpeed;
    this.x += (dx / d) * speed * dt;
    this.y += (dy / d) * speed * dt;
    this.x = Math.max(this.r + 16, Math.min(w - this.r - 16, this.x));
    this.y = Math.max(this.r + 18, Math.min(h * 0.68, this.y));
  }

  refreshSweepOrigin() {
    const spot = this.weakSpots[this.sweepCanon];
    if (!spot || !spot.alive) return;
    this.sweepOrigin = this.getWeakSpotWorldPos(spot);
  }

  updateIntro(dt, w, h) {
    if (!this.alive) return;
    if (this.targetAnchorY == null) this.targetAnchorY = h * 0.22;
    this.introLerp = Math.min(1, this.introLerp + dt / 2.8);
    this.y = this.introStartY + (this.targetAnchorY - this.introStartY) * this.introLerp;
    this.x = w * 0.5 + Math.sin(this.t * 0.55) * 36;
    this.spin += dt * 0.2;
    this.t += dt;
    this.pulseAngle += dt * 2.5;
  }

  aliveCannons() {
    const out = [];
    this.weakSpots.forEach((s, i) => {
      if (s.alive) out.push(i);
    });
    return out;
  }

  pickNextSweep(player) {
    const live = this.aliveCannons();
    if (!live.length) return;
    this.sweepCanon = live[(Math.random() * live.length) | 0];
    const spot = this.weakSpots[this.sweepCanon];
    this.sweepOrigin = this.getWeakSpotWorldPos(spot);
    const localA = this.spin + spot.cannonAngle;
    const spread = 0.72 / (this.patternScale || 1);
    let mid = localA;
    if (player && player.hp > 0) {
      const p = this.sweepOrigin;
      mid = bossLeadAngle(p.x, p.y, player, 0, 0.65);
    }
    this.sweepStart = mid - spread * 0.5;
    this.sweepEnd = mid + spread * 0.5;
    this.sweepPos = 0;
  }

  beamHalfWidth() {
    const touch =
      typeof document !== "undefined" && document.body && document.body.classList.contains("touch-play");
    return touch ? 0.1 : 0.15;
  }

  updateFight(dt, w, h, player, bullets) {
    if (!this.alive) return;
    this.t += dt;
    this.pulseAngle += dt * 2.5;
    const spinRate = (0.22 + this.survivalPhase * 0.06) * (this.patternScale || 1);
    if (this.currentPattern !== "SWEEP_FIRE") this.spin += dt * spinRate;
    this.wander(dt, w, h);
    if (this.currentPattern === "SWEEP_CHARGE" || this.currentPattern === "SWEEP_FIRE") {
      this.refreshSweepOrigin();
    }
    this.syncShieldFromWeakSpots();

    this.patternTimer -= dt;
    const tele = (this.telegraphScale || 1) * (0.85 + Math.random() * 0.25);
    const pace = this.patternScale || 1;
    this._pace = pace;

    if (this.currentPattern === "IDLE") {
      if (this.patternTimer <= 0) {
        if (!this.aliveCannons().length) {
          this.patternTimer = 0.35;
          return;
        }
        this.pickNextSweep(player);
        this.currentPattern = "SWEEP_CHARGE";
        this.patternTimer = 1 * tele;
      }
    } else if (this.currentPattern === "SWEEP_CHARGE") {
      if (this.patternTimer <= 0) {
        this.currentPattern = "SWEEP_FIRE";
        this.patternTimer = 0.78 / pace;
        this.sweepPos = 0;
        AudioFx.beamLaser();
      }
    } else if (this.currentPattern === "SWEEP_FIRE") {
      const dur = 0.78 / pace;
      this.sweepPos = Math.min(1, this.sweepPos + dt / dur);
      if (this.patternTimer <= 0) {
        AudioFx.beamLaserStop();
        this.currentPattern = "IDLE";
        this.patternTimer = (1.05 + Math.random() * 0.45) / pace;
        if (this.survivalPhase >= 2 && Math.random() < 0.35) {
          this.fireVitalVolley(bullets, player);
        }
      }
    }
  }

  fireVitalVolley(bullets, target) {
    for (const spot of this.weakSpots) {
      if (!spot.alive) continue;
      const p = this.getWeakSpotWorldPos(spot);
      const spd = 248 * (this._pace || 1);
      const base = target ? bossLeadAngle(p.x, p.y, target, spd, 1.05) : this.spin + spot.cannonAngle;
      for (let k = -1; k <= 1; k++) {
        const ang = base + k * 0.2;
        spawnPooledBullet(bullets, p.x, p.y, ang, spd, false, "#ffb347", 12);
      }
    }
    AudioFx.bossShootRing();
  }

  currentSweepAngle() {
    return this.sweepStart + (this.sweepEnd - this.sweepStart) * this.sweepPos;
  }

  applyHazards(dt, w, h, player, remote) {
    if (!this.alive) return;
    if (this.currentPattern !== "SWEEP_FIRE") return;
    const ships = remote ? [player, remote] : [player];
    const ox = this.sweepOrigin.x;
    const oy = this.sweepOrigin.y;
    const beamA = this.currentSweepAngle();
    const half = this.beamHalfWidth();
    const reach = Math.max(w, h) * 1.4;
    for (const ship of ships) {
      if (!ship || ship.hp <= 0) continue;
      const dx = ship.x - ox;
      const dy = ship.y - oy;
      const dist = Math.hypot(dx, dy);
      if (dist < 28 || dist > reach) continue;
      let a = Math.atan2(dy, dx);
      let da = a - beamA;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) <= half) megaBeamDamage(ship, 22 * dt);
    }
  }

  traceTriangle(ctx) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = this.vAngles[i];
      const px = Math.cos(a) * this.triRadius;
      const py = Math.sin(a) * this.triRadius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  drawVital(ctx, spot) {
    const r = spot.r;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = this.palette.vital || "#ffb347";
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#ffb347";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, TAU);
    ctx.strokeStyle = "rgba(77, 232, 255, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  drawSweepTelegraph(ctx, w, h) {
    const ox = this.sweepOrigin.x;
    const oy = this.sweepOrigin.y;
    const len = Math.max(w, h) * 1.2;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 179, 71, 0.75)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    for (const a of [this.sweepStart, this.sweepEnd]) {
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(a) * len, oy + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "rgba(255, 179, 71, 0.2)";
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, len, this.sweepStart, this.sweepEnd, this.sweepEnd < this.sweepStart);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawSweepBeam(ctx, w, h) {
    const ox = this.sweepOrigin.x;
    const oy = this.sweepOrigin.y;
    const len = Math.max(w, h) * 1.2;
    const a = this.currentSweepAngle();
    const half = this.beamHalfWidth();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(a);
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#4de8ff";
    ctx.fillStyle = "rgba(77, 232, 255, 0.55)";
    const bw = Math.tan(half) * len * 0.35 + 18;
    ctx.fillRect(0, -bw * 0.5, len, bw);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.shadowBlur = 0;
    ctx.fillRect(0, -4, len, 8);
    ctx.restore();
  }

  draw(ctx, w, h) {
    if (!this.alive) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.spin);

    this.traceTriangle(ctx);
    ctx.fillStyle = this.palette.fill || "#0a1420";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = this.shieldActive ? "rgba(255, 77, 154, 0.85)" : this.palette.stroke || "#4de8ff";
    ctx.shadowBlur = this.shieldActive ? 0 : 12;
    ctx.shadowColor = "#4de8ff";
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (this.shieldActive) {
      const pulse = 1 + Math.sin(this.pulseAngle) * 0.04;
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = "rgba(77, 232, 255, 0.7)";
      ctx.lineWidth = 2;
      this.traceTriangle(ctx);
      ctx.save();
      ctx.scale(pulse, pulse);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, TAU);
    ctx.strokeStyle = "rgba(77, 232, 255, 0.35)";
    ctx.stroke();
    ctx.restore();

    for (const spot of this.weakSpots) {
      if (!spot.alive) continue;
      const pos = this.getWeakSpotWorldPos(spot);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      this.drawVital(ctx, spot);
      ctx.restore();
    }

    if (this.currentPattern === "SWEEP_CHARGE") this.drawSweepTelegraph(ctx, w, h);
    else if (this.currentPattern === "SWEEP_FIRE") this.drawSweepBeam(ctx, w, h);
  }
}
