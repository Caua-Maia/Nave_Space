/**
 * Titan Hexagonal — Núcleo Autônomo.
 * FSM + sub-núcleos + escudo reforçado. Prisma/Órbita permanecem classes irmãs.
 */
const BossFSM = {
  SPAWNING: "SPAWNING",
  SHIELD_ACTIVE: "SHIELD_ACTIVE",
  STAGGER: "STAGGER",
  DESPERATION_PHASE: "DESPERATION_PHASE",
  DEFEATED: "DEFEATED",
};

/** Equaliza DPS no megaboss (Lança = 1.00). Não altera dano em rochas/inimigos. */
const MEGA_SHIP_DMG_MUL = {
  lanca: 1,
  dardo: 0.5,
  bastiao: 0.68,
};

const TITAN_STAGGER = 1.5;
const TITAN_TELEGRAPH = 0.8;
const TITAN_DESPERATION = 0.25;

class MegaBoss {
  constructor(x, y, opts) {
    opts = opts || {};
    this.kindFlag = "mega";
    this.kind = "mega";
    this.survivalMode = !!opts.survivalMode;
    this.profileId = opts.profileId || "titan";
    this.name = "TITAN HEXAGONAL";
    this.tier = "boss";
    this.x = x;
    this.y = y;
    this.introStartY = -150;
    this.targetAnchorY = null;
    this.angle = Math.PI / 2;
    this.hexRot = 0;
    this.r = 70;
    this.hpMax = 560;
    this.hpCurrent = 560;
    this.maxCoreHp = 560;
    this.coreHp = 560;
    this.shieldMax = 3;
    this.shieldCurrent = 3;
    this.shieldActive = true;
    this.alive = true;
    this.score = 8000;
    this.t = 0;
    this.pulseAngle = 0;
    this.rotationSpeed = 0.55;
    this.attackTimer = 0.4;
    this.phase = 1;
    this.fsmState = BossFSM.SPAWNING;
    this.staggerLeft = 0;
    this.coreExposed = false;
    this.desperationPulseDone = false;
    this.shockwaveT = 0;
    this.shockwaveR = 0;
    this.shockTagged = [];
    this.focusId = "host";
    this.aggroHost = 0;
    this.aggroGuest = 0;
    this.subCores = this.buildSubCores();
    this.weakSpots = this.subCores;
    this.currentPattern = "IDLE";
    this.patternTimer = 0.4;
    this.beamAngle = Math.PI / 2;
    this.attackPhase = 0;
    this.introLerp = 0;
    this.survivalPhase = 1;
    this.patternScale = 1;
    this.telegraphScale = 1;
    this._pace = 1;
    this._focusShip = null;
  }

  buildSubCores() {
    const orbit = 58;
    const defs = [
      { id: "alpha", pattern: "HEX_PULSAR", hud: "left" },
      { id: "beta", pattern: "BEAM_LASER", hud: "top" },
      { id: "gamma", pattern: "ARC_BURST", hud: "right" },
    ];
    return defs.map((d, i) => {
      const a = -Math.PI / 2 + (i * TAU) / 3;
      return {
        id: d.id,
        pattern: d.pattern,
        hud: d.hud,
        localAngle: a,
        orbit,
        offsetX: Math.cos(a) * orbit,
        offsetY: Math.sin(a) * orbit,
        r: 18,
        hp: i === 1 ? 210 : 165,
        maxHp: i === 1 ? 210 : 165,
        alive: true,
      };
    });
  }

  orientRad() {
    return this.hexRot;
  }

  bulletHullRadius() {
    return this.shieldActive ? this.r + 16 : this.r * 0.72;
  }

  vitalHitRadius(spot) {
    return (spot.r || 18) + 16;
  }

  /** Posição mundial via matriz de rotação 2D (hexRot). */
  rotateLocal(lx, ly) {
    const cos = Math.cos(this.hexRot);
    const sin = Math.sin(this.hexRot);
    return {
      x: this.x + lx * cos - ly * sin,
      y: this.y + lx * sin + ly * cos,
    };
  }

  getWeakSpotWorldPos(spot) {
    const orbit = spot.orbit || 58;
    const la = spot.localAngle || 0;
    spot.offsetX = Math.cos(la) * orbit;
    spot.offsetY = Math.sin(la) * orbit;
    return this.rotateLocal(spot.offsetX, spot.offsetY);
  }

  patternEnabled(name) {
    const core = this.subCores.find((s) => s.pattern === name);
    return !core || core.alive;
  }

  livingCores() {
    let n = 0;
    for (let i = 0; i < this.subCores.length; i++) if (this.subCores[i].alive) n++;
    return n;
  }

  syncVitals() {
    this.hpMax = this.maxCoreHp || this.hpMax;
    this.hpCurrent = this.coreHp != null ? this.coreHp : this.hpCurrent;
    this.maxCoreHp = this.hpMax;
    this.coreHp = this.hpCurrent;
    this.shieldCurrent = this.livingCores();
    this.shieldMax = 3;
    let shieldOn = this.shieldCurrent > 0;
    if (this.survivalMode && typeof SurvivalMega !== "undefined" && SurvivalMega.coreOpen(this)) {
      shieldOn = false;
    }
    if (this.fsmState === BossFSM.DEFEATED) shieldOn = false;
    this.shieldActive = shieldOn;
  }

  syncShieldFromWeakSpots() {
    const before = this.shieldActive;
    this.syncVitals();
    if (before && !this.shieldActive) {
      if (this.survivalMode && typeof SurvivalMega !== "undefined") SurvivalMega.onAllVitalsDown(this);
      AudioFx.explode(4);
    }
  }

  setFsm(next) {
    if (this.fsmState === BossFSM.DEFEATED) return;
    this.fsmState = next;
    if (next === BossFSM.DESPERATION_PHASE) this.phase = 2;
    if (next === BossFSM.SHIELD_ACTIVE) this.phase = 1;
  }

  maybeEnterDesperation() {
    if (this.hpCurrent <= this.hpMax * TITAN_DESPERATION && this.fsmState !== BossFSM.STAGGER) {
      if (this.fsmState !== BossFSM.DESPERATION_PHASE && this.fsmState !== BossFSM.DEFEATED) {
        this.setFsm(BossFSM.DESPERATION_PHASE);
        this.rotationSpeed = 1.15;
        this.triggerRepulsionPulse();
      }
    }
  }

  onFightStart() {
    this.introLerp = 1;
    this.syncVitals();
    this.setFsm(this.shieldActive ? BossFSM.SHIELD_ACTIVE : BossFSM.DESPERATION_PHASE);
    this.currentPattern = "IDLE";
    this.patternTimer = 0.35;
    this.attackTimer = this.patternTimer;
  }

  onSurvivalPhaseRespawn() {
    this.subCores.forEach((s) => {
      s.alive = true;
    });
    this.desperationPulseDone = false;
    this.shockwaveT = 0;
    this.shockTagged = [];
    this.syncVitals();
    this.setFsm(BossFSM.SHIELD_ACTIVE);
    this.rotationSpeed = 0.55;
  }

  pickAggroTarget(player, remote) {
    const decay = 0.35;
    this.aggroHost = Math.max(0, this.aggroHost);
    this.aggroGuest = Math.max(0, this.aggroGuest);
    let guestOk = remote && remote.hp > 0;
    let hostOk = player && player.hp > 0;
    if (guestOk && this.aggroGuest > this.aggroHost + 18) this.focusId = "guest";
    else if (hostOk && this.aggroHost >= this.aggroGuest - 8) this.focusId = "host";
    else if (!hostOk && guestOk) this.focusId = "guest";
    else this.focusId = "host";
    const ship = this.focusId === "guest" && guestOk ? remote : player;
    this._focusShip = ship;
    this._aggroDecay = decay;
    return ship || player;
  }

  noteAggro(owner, dmg) {
    if (owner === 1 || owner === "guest") this.aggroGuest += dmg;
    else this.aggroHost += dmg;
  }

  scaledDamage(bullet) {
    if (typeof megaBulletDamage === "function") return megaBulletDamage(bullet);
    const raw = Math.max(1, bullet.dmg || 16);
    const id = bullet.shipId || "lanca";
    const mul = MEGA_SHIP_DMG_MUL[id] != null ? MEGA_SHIP_DMG_MUL[id] : 1;
    return Math.max(1, Math.round(raw * mul));
  }

  updateIntro(dt, w, h, player) {
    if (!this.alive) return;
    this.fsmState = BossFSM.SPAWNING;
    if (this.targetAnchorY == null) this.targetAnchorY = h * 0.22;
    const target = this.targetAnchorY;
    this.introLerp = Math.min(1, this.introLerp + dt / 3);
    this.y = this.introStartY + (target - this.introStartY) * this.introLerp;
    this.x = w * 0.5 + Math.sin(this.t * 0.9) * 8;
    this.hexRot += this.rotationSpeed * dt * 0.45;
    if (player) this.angle = Math.atan2(player.y - this.y, player.x - this.x);
    this.t += dt;
    this.pulseAngle += dt * 3;
  }

  updateFight(dt, w, h, player, bullets, remote) {
    if (!this.alive) return;
    this.t += dt;
    this.pulseAngle += dt * 3;
    this.aggroHost = Math.max(0, this.aggroHost - 0.35 * dt * 40);
    this.aggroGuest = Math.max(0, this.aggroGuest - 0.35 * dt * 40);

    const target = this.pickAggroTarget(player, remote) || player;
    if (target) this.angle = Math.atan2(target.y - this.y, target.x - this.x);
    if (
      target &&
      (this.currentPattern === "BEAM_CHARGE" || this.currentPattern === "BEAM_FIRE")
    ) {
      const track = this.currentPattern === "BEAM_CHARGE" ? 1.05 : 0.55;
      this.beamAngle = bossLeadAngle(this.x, this.y, target, 0, track);
    }

    const rotMul = this.fsmState === BossFSM.DESPERATION_PHASE ? 1.7 : 1;
    if (this.fsmState !== BossFSM.STAGGER) this.hexRot += this.rotationSpeed * rotMul * dt;

    if (this.currentPattern !== "BEAM_FIRE") {
      this.x += Math.sin(this.t * 1.1) * 28 * dt;
    }
    this.x = Math.max(this.r, Math.min(w - this.r, this.x));
    this.y = Math.max(this.r + 40, Math.min(h * 0.38, this.y));

    this.syncVitals();
    if (this.hpCurrent <= 0) {
      this.hpCurrent = 0;
      this.coreHp = 0;
      this.setFsm(BossFSM.DEFEATED);
      return;
    }

    if (this.shockwaveT > 0) {
      this.shockwaveT -= dt;
      this.shockwaveR += 520 * dt;
    }

    if (this.fsmState === BossFSM.STAGGER) {
      this.staggerLeft -= dt;
      this.coreExposed = true;
      this.patternTimer = Math.max(this.patternTimer, 0.05);
      this.attackTimer = this.patternTimer;
      if (this.staggerLeft <= 0) {
        this.coreExposed = false;
        if (this.hpCurrent <= this.hpMax * TITAN_DESPERATION) this.setFsm(BossFSM.DESPERATION_PHASE);
        else this.setFsm(this.shieldActive ? BossFSM.SHIELD_ACTIVE : BossFSM.DESPERATION_PHASE);
        this.currentPattern = "IDLE";
        this.patternTimer = 0.35;
      }
      return;
    }

    this.maybeEnterDesperation();
    this.tickPatterns(dt, w, h, target, bullets);
    this.attackTimer = this.patternTimer;
  }

  tickPatterns(dt, w, h, target, bullets) {
    this.patternTimer -= dt;
    const tele = (this.telegraphScale || 1) * TITAN_TELEGRAPH;
    const pace = this.patternScale || 1;
    this._pace = pace;
    const desperate = this.fsmState === BossFSM.DESPERATION_PHASE;

    if (this.currentPattern === "IDLE") {
      if (this.patternTimer > 0) return;
      const choices = [];
      if (this.patternEnabled("HEX_PULSAR")) choices.push("HEX_PULSAR");
      if (this.patternEnabled("BEAM_LASER")) choices.push("BEAM_CHARGE");
      if (this.patternEnabled("ARC_BURST")) choices.push("ARC_BURST");
      if (!choices.length) {
        if (desperate) choices.push("HEX_PULSAR");
        else {
          this.patternTimer = 0.5;
          return;
        }
      }
      let pickPat = choices[(Math.random() * choices.length) | 0];
      if (target) {
        const d = Math.hypot(target.x - this.x, target.y - this.y);
        const close = d < 300;
        const far = d > 440;
        const pool = [];
        for (const c of choices) {
          if (close && c === "HEX_PULSAR" && Math.random() < 0.55) continue;
          if (far && c === "HEX_PULSAR") pool.push(c);
          pool.push(c);
        }
        if (pool.length) pickPat = pool[(Math.random() * pool.length) | 0];
        if (close && choices.indexOf("ARC_BURST") >= 0 && Math.random() < 0.45) pickPat = "ARC_BURST";
        else if (close && choices.indexOf("BEAM_CHARGE") >= 0 && Math.random() < 0.35) pickPat = "BEAM_CHARGE";
      }
      if (pickPat === "BEAM_CHARGE") {
        this.currentPattern = "BEAM_CHARGE";
        this.patternTimer = tele;
        this.beamAngle = target ? bossLeadAngle(this.x, this.y, target, 0, 1) : Math.PI / 2;
      } else if (pickPat === "ARC_BURST") {
        this.currentPattern = "ARC_BURST";
        this.patternTimer = 0.01;
      } else {
        this.currentPattern = "HEX_PULSAR";
        this.patternTimer = 0.01;
      }
    } else if (this.currentPattern === "BEAM_CHARGE") {
      if (this.patternTimer <= 0) {
        this.currentPattern = "BEAM_FIRE";
        this.patternTimer = (desperate ? 0.95 : 0.75) / pace;
        AudioFx.beamLaser();
      }
    } else if (this.currentPattern === "BEAM_FIRE") {
      if (this.patternTimer <= 0) {
        AudioFx.beamLaserStop();
        this.currentPattern = "IDLE";
        this.patternTimer = (desperate ? 0.55 : 1.05) / pace;
      }
    } else if (this.currentPattern === "HEX_PULSAR") {
      this.fireHexPulsar(bullets, target);
      this.currentPattern = "IDLE";
      this.patternTimer = (desperate ? 0.72 : 1.25) / pace;
    } else if (this.currentPattern === "ARC_BURST") {
      this.fireArcBurst(bullets, target);
      this.currentPattern = "IDLE";
      this.patternTimer = (desperate ? 0.8 : 1.35) / pace;
    } else if (this.currentPattern === "BULLET_RING") {
      this.fireHexPulsar(bullets);
      this.currentPattern = "IDLE";
      this.patternTimer = 1.2 / pace;
    }
  }

  hexVertex(i, radius) {
    const a = this.hexRot + (i / 6) * TAU;
    return { x: this.x + Math.cos(a) * radius, y: this.y + Math.sin(a) * radius, a };
  }

  fireHexPulsar(bullets, target) {
    const rad = this.r + 8;
    const pace = this._pace || 1;
    for (let i = 0; i < 6; i++) {
      const v = this.hexVertex(i, rad);
      const spd = 248 * pace;
      const aim = target ? bossLeadAngle(v.x, v.y, target, spd, 1.05) : v.a + Math.PI;
      spawnPooledBullet(bullets, v.x, v.y, aim, spd, false, "#ff3399", 15);
    }
    for (const spot of this.subCores) {
      if (!spot.alive) continue;
      const pos = this.getWeakSpotWorldPos(spot);
      const spd = 252 * pace;
      const aim = target ? bossLeadAngle(pos.x, pos.y, target, spd, 1) : this.angle;
      spawnPooledBullet(bullets, pos.x, pos.y, aim, spd, false, "#ff5577", 14);
    }
    AudioFx.bossShootRing();
  }

  fireBulletRing(bullets) {
    this.fireHexPulsar(bullets);
  }

  fireArcBurst(bullets, target) {
    const pace = this._pace || 1;
    const spd = 265 * pace;
    const base = target ? bossLeadAngle(this.x, this.y, target, spd, 1.1) : this.angle;
    const spread = target && Math.hypot(target.x - this.x, target.y - this.y) < 320 ? 0.18 : 0.24;
    const n = this.fsmState === BossFSM.DESPERATION_PHASE ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      spawnPooledBullet(bullets, this.x, this.y, a, spd, false, "#ffe566", 14);
    }
    AudioFx.bossShootRing();
  }

  triggerRepulsionPulse() {
    if (this.desperationPulseDone) return;
    this.desperationPulseDone = true;
    this.shockwaveT = 0.55;
    this.shockwaveR = 40;
    this.shockTagged = [];
    AudioFx.explode(3);
  }

  applyKnockbackTo(ship) {
    if (!ship || ship.hp <= 0) return;
    if (this.shockTagged.indexOf(ship) >= 0) return;
    const dx = ship.x - this.x;
    const dy = ship.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const reach = Math.max(this.shockwaveR, 560);
    if (d > reach + ship.r) return;
    const force = 640;
    ship.vx += (dx / d) * force;
    ship.vy += (dy / d) * force;
    this.shockTagged.push(ship);
  }

  applyHazards(dt, w, h, player, remote) {
    this.applyBeamDamage(dt, w, player, remote);
    if (this.shockwaveT > 0) {
      this.applyKnockbackTo(player);
      this.applyKnockbackTo(remote);
    }
  }

  applyBeamDamage(dt, w, player, remote) {
    if (!this.alive || this.currentPattern !== "BEAM_FIRE") return;
    const dirx = Math.cos(this.beamAngle);
    const diry = Math.sin(this.beamAngle);
    const half = 22;
    const ships = remote ? [player, remote] : [player];
    for (const ship of ships) {
      if (!ship || ship.hp <= 0) continue;
      const px = ship.x - this.x;
      const py = ship.y - this.y;
      const along = px * dirx + py * diry;
      if (along < 28) continue;
      const cross = Math.abs(px * diry - py * dirx);
      if (cross > half + ship.r) continue;
      megaBeamDamage(ship, 25 * dt);
    }
  }

  hullBlocksShot() {
    if (this.coreExposed) return false;
    if (this.survivalMode && typeof SurvivalMega !== "undefined") {
      return !SurvivalMega.coreOpen(this);
    }
    return this.shieldActive;
  }

  /**
   * Colisão independente dos sub-núcleos. Núcleo só recebe dano se
   * um sub-núcleo acabou de cair (stagger) ou o escudo já quebrou.
   */
  handlePlayerBullet(b, hooks) {
    if (!this.alive || !b || !b.fromPlayer) return false;
    const dmg = this.scaledDamage(b);
    for (let i = 0; i < this.subCores.length; i++) {
      const spot = this.subCores[i];
      if (!spot.alive) continue;
      const pos = this.getWeakSpotWorldPos(spot);
      const vr = this.vitalHitRadius(spot);
      if (!circleHitsBullet(b, pos.x, pos.y, vr)) continue;
      spot.hp -= dmg;
      this.noteAggro(b.owner, dmg);
      hooks.burst(pos.x, pos.y, "#ffcc00", 8, 200);
      AudioFx.hit();
      if (spot.hp <= 0) {
        this.destroySubCore(spot, pos, hooks, b.shipId);
      }
      return true;
    }

    const hullR = this.bulletHullRadius();
    if (dist2(b, this) >= (b.r + hullR) * (b.r + hullR)) return false;

    const front = this.isFrontalImpact(b);
    if (this.hullBlocksShot() && front) {
      hooks.burst(b.x, b.y, "#00f0ff", 5, 220);
      AudioFx.shieldDeflect();
      return true;
    }
    if (this.hullBlocksShot() && !this.coreExposed) {
      hooks.burst(b.x, b.y, "#00f0ff", 5, 220);
      AudioFx.shieldDeflect();
      return true;
    }

    this.coreHp -= dmg;
    this.hpCurrent = this.coreHp;
    this.noteAggro(b.owner, dmg);
    hooks.burst(b.x, b.y, "#ff0055", 6, 200);
    AudioFx.hit();
    if (this.hpCurrent <= 0) {
      this.hpCurrent = 0;
      this.coreHp = 0;
      this.setFsm(BossFSM.DEFEATED);
      hooks.onCoreDown();
    } else {
      this.maybeEnterDesperation();
    }
    return true;
  }

  isFrontalImpact(b) {
    const fx = Math.cos(this.angle);
    const fy = Math.sin(this.angle);
    const ix = b.x - this.x;
    const iy = b.y - this.y;
    return ix * fx + iy * fy > 0;
  }

  destroySubCore(spot, pos, hooks, shipId) {
    spot.hp = 0;
    spot.alive = false;
    this.emitVectorBurst(pos.x, pos.y, hooks);
    AudioFx.explode(2);
    hooks.addScore(500, pos.x, pos.y, { vital: true, shipId });
    this.staggerLeft = TITAN_STAGGER;
    this.coreExposed = true;
    this.setFsm(BossFSM.STAGGER);
    this.currentPattern = "IDLE";
    this.patternTimer = TITAN_STAGGER;
    AudioFx.beamLaserStop();
    this.syncShieldFromWeakSpots();
  }

  emitVectorBurst(x, y, hooks) {
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      hooks.burst(x + Math.cos(a) * 6, y + Math.sin(a) * 6, i % 2 ? "#ff3366" : "#ffe566", 1, 280);
    }
    hooks.burst(x, y, "#ffffff", 10, 200);
  }

  hudModel() {
    this.syncVitals();
    return {
      cores: this.subCores,
      hp: this.hpCurrent,
      hpMax: this.hpMax,
      shield: this.shieldCurrent,
      shieldMax: this.shieldMax,
      shieldActive: this.shieldActive,
      state: this.fsmState,
    };
  }

  traceHex(ctx, radius) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const px = Math.cos(a) * radius;
      const py = Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  drawDiamondReactor(ctx, spot) {
    const r = spot.r;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.fillStyle = this.fsmState === BossFSM.STAGGER ? "#ffe566" : "#ff9900";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ff9900";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  draw(ctx, w, h) {
    if (!this.alive && this.fsmState !== BossFSM.DEFEATED) return;
    if (!this.alive) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.hexRot);

    this.traceHex(ctx, this.r);
    ctx.fillStyle = "#1a1d28";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = this.shieldActive ? "#ff0055" : "#00f0ff";
    ctx.stroke();

    this.traceHex(ctx, this.r * 0.42);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (this.shieldActive) {
      const shieldScale = 1 + Math.sin(this.pulseAngle) * 0.03;
      this.traceHex(ctx, (this.r + 16) * shieldScale);
      ctx.fillStyle = "rgba(0, 240, 255, 0.22)";
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 240, 255, 0.65)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    for (const spot of this.subCores) {
      if (!spot.alive) continue;
      const pos = this.getWeakSpotWorldPos(spot);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(this.hexRot);
      this.drawDiamondReactor(ctx, spot);
      ctx.restore();
    }

    if (this.currentPattern === "BEAM_CHARGE") {
      const len = Math.hypot(w, h);
      ctx.save();
      ctx.strokeStyle = "rgba(255, 0, 85, 0.55)";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 7]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(this.beamAngle) * len, this.y + Math.sin(this.beamAngle) * len);
      ctx.stroke();
      ctx.lineWidth = 14;
      ctx.strokeStyle = "rgba(255, 0, 85, 0.18)";
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    } else if (this.currentPattern === "BEAM_FIRE") {
      const len = Math.hypot(w, h);
      const x2 = this.x + Math.cos(this.beamAngle) * len;
      const y2 = this.y + Math.sin(this.beamAngle) * len;
      ctx.save();
      ctx.strokeStyle = "rgba(0, 240, 255, 0.85)";
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#00f0ff";
      ctx.lineWidth = 40;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.restore();
    }

    if (this.shockwaveT > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 80, 120, ${Math.max(0.12, this.shockwaveT * 1.4)})`;
      ctx.lineWidth = 4;
      this.traceHexAt(ctx, this.x, this.y, this.shockwaveR);
      ctx.stroke();
      ctx.restore();
    }
  }

  traceHexAt(ctx, x, y, radius) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = this.hexRot + (i / 6) * TAU;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
}
