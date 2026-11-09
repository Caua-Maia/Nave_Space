/**
 * Mega boss ÓRBITA — anel octogonal fixo; zona interna radioativa; nós nos vértices.
 */
class OrbitaMega {
  constructor(x, y, opts) {
    opts = opts || {};
    this.kindFlag = "mega";
    this.kind = "mega";
    this.survivalMode = !!opts.survivalMode;
    this.profileId = "orbita";
    this.name = "ÓRBITA";
    this.tier = "boss";
    this.x = x;
    this.y = y;
    this.introStartY = -80;
    this.targetAnchorY = null;
    this.ringSpin = 0;
    this.startRadius = 0;
    this.ringRadius = 0;
    this.r = 36;
    this.vitalHitPad = 11;
    this.coreHp = 380;
    this.maxCoreHp = 380;
    this.shieldActive = true;
    this.alive = true;
    this.score = 9600;
    this.t = 0;
    this.pulseAngle = 0;
    this.weakSpots = [];
    for (let i = 0; i < 8; i++) {
      const baseAngle = (i / 8) * TAU - Math.PI / 2;
      this.weakSpots.push({
        id: `n${i}`,
        sector: i,
        baseAngle,
        offsetX: 0,
        offsetY: 0,
        r: 19,
        hp: 88,
        maxHp: 88,
        alive: true,
        shootTimer: 0.9 + i * 0.12,
        telegraph: 0,
        burstLeft: 0,
      });
    }
    this.patternScale = 1;
    this.telegraphScale = 1;
    this.survivalPhase = 1;
    this.introLerp = 0;
    this.palette = { stroke: "#ff4d9a", fill: "#140a12", vital: "#ff4d9a" };
    this._pace = 1;
    this.wallThickness = 24;
    this.salvoTimer = 5.5;
    this.spiralTimer = 9;
  }

  initArena(w, h) {
    const base = Math.min(w, h);
    this.startRadius = base * 0.38;
    this.ringRadius = this.startRadius;
    this.x = w * 0.5;
    this.y = h * 0.48;
  }

  orientRad() {
    return this.ringSpin;
  }

  bulletHullRadius() {
    return this.shieldActive ? 26 : 34;
  }

  vitalHitRadius(spot) {
    return (spot.r || 19) + (this.vitalHitPad || 10);
  }

  getWeakSpotWorldPos(spot) {
    const a = spot.baseAngle + this.ringSpin * 0.35;
    return {
      x: this.x + Math.cos(a) * this.ringRadius,
      y: this.y + Math.sin(a) * this.ringRadius,
    };
  }

  aliveSectors() {
    let n = 0;
    this.weakSpots.forEach((s) => {
      if (s.alive) n += 1;
    });
    return n;
  }

  ringBorderAt(worldAngle, radius) {
    const a = worldAngle - this.ringSpin * 0.35;
    const sector = Math.PI / 4;
    let u = ((a % TAU) + TAU) % TAU;
    let s = u % sector;
    if (s > sector / 2) s = sector - s;
    const local = s - sector / 2;
    const cosEdge = Math.cos(Math.PI / 8);
    const denom = Math.max(0.22, Math.cos(local));
    return (radius * cosEdge) / denom;
  }

  /** Dentro do preenchimento rosa (field radioativo). */
  isInsideRadiation(px, py, shipR) {
    if (!this.ringRadius || this.ringRadius < 40) return false;
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const border = this.ringBorderAt(ang, this.ringRadius);
    return dist <= border - (shipR || 14) * 0.35;
  }

  hitsRingWall(px, py, shipR) {
    if (!this.ringRadius || this.ringRadius < 56) return false;
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) return false;
    const ang = Math.atan2(dy, dx);
    const border = this.ringBorderAt(ang, this.ringRadius);
    const half = (this.wallThickness || 24) * 0.5 + (shipR || 14) * 0.65;
    return Math.abs(dist - border) <= half;
  }

  radiationDps(ship, dist) {
    const ph = this.survivalPhase || 1;
    const touch =
      typeof document !== "undefined" && document.body && document.body.classList.contains("touch-play");
    let dps = 22 + ph * 6;
    if (touch) dps *= 0.82;
    const R = Math.max(this.ringRadius, 80);
    const depth = 1 - Math.min(1, dist / (R * 0.92));
    return dps * (0.55 + depth * 0.75);
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

  onSurvivalPhaseRespawn(phaseNum) {
    this.salvoTimer = Math.max(2.5, 5 - phaseNum * 0.8);
  }

  updateIntro(dt, w, h) {
    if (!this.alive) return;
    this.initArena(w, h);
    if (this.targetAnchorY == null) this.targetAnchorY = h * 0.48;
    this.introLerp = Math.min(1, this.introLerp + dt / 3);
    const fromR = this.startRadius * 1.35;
    this.ringRadius = fromR + (this.startRadius - fromR) * this.introLerp;
    this.y = this.introStartY + (this.targetAnchorY - this.introStartY) * this.introLerp;
    this.x = w * 0.5;
    this.ringSpin += dt * 0.12;
    this.t += dt;
    this.pulseAngle += dt * 2;
  }

  updateFight(dt, w, h, player, bullets) {
    if (!this.alive) return;
    if (this.ringRadius <= 0) this.initArena(w, h);
    if (this.startRadius > 0) this.ringRadius = this.startRadius;
    this.t += dt;
    this.pulseAngle += dt * 2.2;
    this.ringSpin += dt * (0.12 + this.survivalPhase * 0.05);
    this.x = w * 0.5;
    this.y = h * 0.48;
    this.syncShieldFromWeakSpots();
    const tele = (this.telegraphScale || 1) * (0.82 + Math.random() * 0.22);
    const pace = this.patternScale || 1;
    this._pace = pace;
    const alive = this.aliveSectors();

    this.salvoTimer -= dt;
    if (this.salvoTimer <= 0 && alive > 0) {
      this.salvoTimer = (5.8 + Math.random() * 1.4) / pace;
      this.fireCenterSalvo(bullets);
    }
    this.spiralTimer -= dt;
    if (this.spiralTimer <= 0 && alive >= 3) {
      this.spiralTimer = (8.5 + Math.random() * 2) / pace;
      this.fireNodeCrossfire(bullets, player);
    }

    for (const spot of this.weakSpots) {
      if (!spot.alive) continue;
      if (spot.burstLeft > 0) {
        spot.burstLeft -= dt;
        if (spot.burstLeft <= 0) this.fireNodePattern(spot, bullets, player, true);
        continue;
      }
      spot.shootTimer -= dt;
      if (spot.telegraph > 0) {
        spot.telegraph -= dt;
        if (spot.telegraph <= 0) {
          this.fireNodePattern(spot, bullets, player, false);
          if (this.survivalPhase >= 2 && Math.random() < 0.45) {
            spot.burstLeft = 0.35 / pace;
          }
        }
        continue;
      }
      if (spot.shootTimer <= 0) {
        spot.telegraph = 0.72 * tele;
        const base = this.survivalPhase >= 3 ? 1.35 : 1.85;
        spot.shootTimer = (base + Math.random() * 0.7) / pace;
      }
    }
  }

  fireCenterSalvo(bullets) {
    const total = 24;
    const g1 = (Math.random() * total) | 0;
    const g2 = (g1 + 2) % total;
    const g3 = (g1 + 11) % total;
    for (let i = 0; i < total; i++) {
      if (i === g1 || i === g2 || i === g3) continue;
      const a = (i / total) * TAU + this.ringSpin * 0.4;
      bullets.push(new Bullet(this.x, this.y, a, 175 * this._pace, false, "#ff66bb", 15));
    }
    AudioFx.bossShootRing();
  }

  fireNodeCrossfire(bullets, player) {
    let fired = 0;
    for (const spot of this.weakSpots) {
      if (!spot.alive) continue;
      const pos = this.getWeakSpotWorldPos(spot);
      const toP = Math.atan2(player.y - pos.y, player.x - pos.x);
      const along = spot.baseAngle + this.ringSpin * 0.35;
      bullets.push(new Bullet(pos.x, pos.y, toP, 210 * this._pace, false, "#ff4d9a", 14));
      bullets.push(new Bullet(pos.x, pos.y, along + Math.PI / 2, 165, false, "#ffb347", 12));
      if (++fired >= 4) break;
    }
    AudioFx.bossShootRing();
  }

  fireNodePattern(spot, bullets, player, isFollowUp) {
    const pos = this.getWeakSpotWorldPos(spot);
    const aim = Math.atan2(player.y - pos.y, player.x - pos.x);
    const pace = this._pace || 1;
    const ph = this.survivalPhase || 1;
    const n = isFollowUp ? 3 : ph >= 3 ? 7 : ph >= 2 ? 5 : 4;
    const spread = ph >= 3 ? 0.32 : 0.22;
  const speed = (isFollowUp ? 240 : 215) * pace;
    for (let i = 0; i < n; i++) {
      const a = aim + (i - (n - 1) / 2) * spread;
      const b = new Bullet(pos.x, pos.y, a, speed, false, isFollowUp ? "#ffb347" : "#ff4d9a", isFollowUp ? 15 : 14);
      bullets.push(b);
    }
    if (!isFollowUp) AudioFx.bossShootRing();
  }

  applyHazards(dt, w, h, player, remote) {
    if (!this.alive) return;
    const ships = remote ? [player, remote] : [player];
    for (const ship of ships) {
      if (!ship || ship.hp <= 0) continue;
      const sr = ship.r || 14;
      const dx = ship.x - this.x;
      const dy = ship.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (this.hitsRingWall(ship.x, ship.y, sr)) {
        megaBeamDamage(ship, 26 * dt);
        const inward = dist > this.ringRadius ? -1 : 1;
        ship.x += (dx / dist) * inward * 50 * dt;
        ship.y += (dy / dist) * inward * 50 * dt;
        continue;
      }

      if (this.isInsideRadiation(ship.x, ship.y, sr)) {
        megaBeamDamage(ship, this.radiationDps(ship, dist) * dt);
      }
    }
  }

  drawNodeVital(ctx, spot) {
    const r = spot.r;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.fillStyle = this.palette.vital || "#ff4d9a";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ff4d9a";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  traceOctagon(ctx, radius) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU - Math.PI / 2 + this.ringSpin * 0.35;
      const px = Math.cos(a) * radius;
      const py = Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  draw(ctx, w, h) {
    if (!this.alive) return;
    if (this.ringRadius <= 0) this.initArena(w, h);

    ctx.save();
    ctx.translate(this.x, this.y);

    const pulse = 0.12 + Math.sin(this.pulseAngle) * 0.04;
    this.traceOctagon(ctx, this.ringRadius);
    ctx.fillStyle = `rgba(255, 40, 120, ${pulse})`;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = this.shieldActive ? "rgba(255, 77, 154, 0.95)" : this.palette.stroke;
    ctx.shadowBlur = this.shieldActive ? 8 : 14;
    ctx.shadowColor = "#ff4d9a";
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.fillStyle = "#140a12";
    ctx.fill();
    ctx.strokeStyle = "rgba(77, 232, 255, 0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    for (const spot of this.weakSpots) {
      if (!spot.alive) continue;
      const pos = this.getWeakSpotWorldPos(spot);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      this.drawNodeVital(ctx, spot);
      ctx.restore();
    }
  }
}
