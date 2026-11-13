const TAU = Math.PI * 2;

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

function wrap(p, w, h, m = 18) {
  if (p.x < -m) p.x = w + m;
  if (p.x > w + m) p.x = -m;
  if (p.y < -m) p.y = h + m;
  if (p.y > h + m) p.y = -m;
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** ~80 ms: shotgun do Bastião só aplica 1 hit por vital por janela. */
const VITAL_HIT_IFRAMES = 0.08;

function tickVitalIframes(spots, dt) {
  if (!spots || !spots.length) return;
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    if (s && s.hitIframes > 0) s.hitIframes -= dt;
  }
}

function vitalAcceptsHit(spot) {
  return !!(spot && spot.alive && !(spot.hitIframes > 0));
}

function markVitalHit(spot) {
  if (!spot) return;
  spot.hitIframes = VITAL_HIT_IFRAMES;
}

function applyVitalHp(spot, dmg) {
  const hp = Number(spot.hp);
  const next = (Number.isFinite(hp) ? hp : 0) - Math.max(0, dmg | 0);
  spot.hp = next > 0 ? next : 0;
  return spot.hp;
}

/** Colisão círculo × bala (frame atual + segmento do movimento). */
function circleHitsBullet(b, cx, cy, cr) {
  const br = b.r || 3;
  const R = cr + br;
  const R2 = R * R;
  if (dist2(b, { x: cx, y: cy }) <= R2) return true;
  const px = b.px != null ? b.px : b.x - (b.vx || 0) * 0.034;
  const py = b.py != null ? b.py : b.y - (b.vy || 0) * 0.034;
  const dx = b.x - px;
  const dy = b.y - py;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-4) return false;
  let t = ((cx - px) * dx + (cy - py) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const qx = px + t * dx;
  const qy = py + t * dy;
  const ddx = qx - cx;
  const ddy = qy - cy;
  return ddx * ddx + ddy * ddy <= R2;
}

/** Mira nos megabosses com antecipação da velocidade do alvo. */
function bossLeadAngle(sx, sy, target, bulletSpeed, leadScale) {
  if (!target) return Math.PI / 2;
  leadScale = leadScale == null ? 1 : leadScale;
  const sp = Math.max(140, bulletSpeed || 240);
  const vx = target.vx || 0;
  const vy = target.vy || 0;
  const vm = Math.hypot(vx, vy);
  let lead = 0.3 * leadScale;
  if (vm > 60) lead += Math.min(0.28, (vm / sp) * 0.42);
  const tx = target.x + vx * lead;
  const ty = target.y + vy * lead;
  return Math.atan2(ty - sy, tx - sx);
}

function spawnEdge(w, h, margin = 40) {
  const side = (Math.random() * 4) | 0;
  if (side === 0) return { x: rand(0, w), y: -margin };
  if (side === 1) return { x: rand(0, w), y: h + margin };
  if (side === 2) return { x: -margin, y: rand(0, h) };
  return { x: w + margin, y: rand(0, h) };
}

class Particle {
  constructor(x, y, color, speed = 180) {
    this.reset(x, y, color, speed);
  }
  reset(x, y, color, speed = 180) {
    const a = Math.random() * TAU;
    const s = rand(0.3, 1) * speed;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
    this.life = rand(0.25, 0.7);
    this.max = this.life;
    this.size = rand(1.5, 4);
    this.color = color;
    this._pooled = false;
    return this;
  }
  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.98;
    this.vy *= 0.98;
  }
  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.max);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class HeartProjectile {
  constructor(x, y, angle, speed) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(2.2, 3.1);
    this.rot = rand(0, TAU);
    this.spin = rand(-1.4, 1.4);
    this.scale = rand(1.7, 2.5);
    this.harmless = true;
  }
  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.spin * dt;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.scale(this.scale, this.scale);
    ctx.globalAlpha = Math.max(0.25, Math.min(1, this.life));
    ctx.beginPath();
    ctx.moveTo(0, 2.15);
    ctx.bezierCurveTo(0, 1.15, -2.35, 0.15, -2.35, -1.15);
    ctx.bezierCurveTo(-2.35, -2.55, -0.65, -3.05, 0, -1.75);
    ctx.bezierCurveTo(0.65, -3.05, 2.35, -2.55, 2.35, -1.15);
    ctx.bezierCurveTo(2.35, 0.15, 0, 1.15, 0, 2.15);
    ctx.closePath();
    ctx.fillStyle = "#FF69B4";
    ctx.shadowColor = "#ff69b4";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  }
}

class Bullet {
  constructor(x, y, angle, speed, fromPlayer, color, dmg = 16) {
    this.reset(x, y, angle, speed, fromPlayer, color, dmg);
  }
  reset(x, y, angle, speed, fromPlayer, color, dmg = 16) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.r = fromPlayer ? 3.2 : 3.8;
    this.life = fromPlayer ? 1.15 : 2.4;
    this.fromPlayer = fromPlayer;
    this.color = color;
    this.dmg = dmg;
    this.owner = undefined;
    this.ghost = false;
    this.shipId = undefined;
    this.pierce = 0;
    this.lancaFromShip = false;
    this.lancaDuplicated = false;
    this.lancaHomingLeft = 0;
    this.lancaHomingNid = 0;
    this.lancaIgnoreT = 0;
    this.lancaIgnoreNid = 0;
    this.lancaSpeed = 0;
    this._pooled = false;
    this.active = true;
    return this;
  }
  update(dt, w, h) {
    if (this.lancaIgnoreT > 0) this.lancaIgnoreT -= dt;
    this.life -= dt;
    this.px = this.x;
    this.py = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.fromPlayer) wrap(this, w, h, 8);
  }
  draw(ctx) {
    ctx.save();
    const chain = this.lancaDuplicated;
    ctx.fillStyle = chain ? "#b8ffff" : this.color;
    ctx.shadowColor = chain ? "#4de8ff" : this.color;
    ctx.shadowBlur = chain ? 14 : 10;
    const rr = chain ? this.r * 0.95 : this.r;
    ctx.beginPath();
    ctx.arc(this.x, this.y, rr, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

const LANCA_CHAIN_HOMING_SEC = 1.55;

const ParticlePool = (() => {
  const free = [];
  const MAX_FREE = 420;
  function obtain(x, y, color, speed) {
    const p = free.pop();
    if (p) return p.reset(x, y, color, speed);
    return new Particle(x, y, color, speed);
  }
  function release(p) {
    if (!p || p._pooled) return;
    p._pooled = true;
    p.life = 0;
    if (free.length < MAX_FREE) free.push(p);
  }
  return { obtain, release };
})();

const BulletPool = (() => {
  const free = [];
  const MAX_FREE = 384;
  const WARM = 192;
  function obtain(x, y, angle, speed, fromPlayer, color, dmg) {
    const b = free.pop();
    if (b) return b.reset(x, y, angle, speed, fromPlayer, color, dmg);
    return new Bullet(x, y, angle, speed, fromPlayer, color, dmg);
  }
  function release(b) {
    if (!b || b._pooled) return;
    b._pooled = true;
    b.active = false;
    b.life = 0;
    b.ghost = false;
    if (free.length < MAX_FREE) free.push(b);
  }
  function warm(n) {
    const count = Math.max(0, Math.min(MAX_FREE, n | 0));
    while (free.length < count) {
      const b = new Bullet(0, 0, 0, 0, true, "#000", 1);
      b._pooled = true;
      b.active = false;
      free.push(b);
    }
  }
  warm(WARM);
  return { obtain, release, warm };
})();

function spawnPooledBullet(list, x, y, angle, speed, fromPlayer, color, dmg) {
  const b = BulletPool.obtain(x, y, angle, speed, fromPlayer, color, dmg);
  if (list) list.push(b);
  return b;
}

const EnemyPool = (() => {
  const free = [];
  const MAX_FREE = 96;
  const WARM = 64;
  function obtain(x, y, type, scale) {
    const e = free.pop();
    if (e) return e.reset(x, y, type, scale);
    return new Enemy(x, y, type, scale);
  }
  function release(e) {
    if (!e || e._pooled) return;
    e._pooled = true;
    e.active = false;
    e.hp = 0;
    if (free.length < MAX_FREE) free.push(e);
  }
  function warm(n) {
    const count = Math.max(0, Math.min(MAX_FREE, n | 0));
    while (free.length < count) {
      const e = new Enemy(0, 0, "chaser", 1);
      e._pooled = true;
      e.active = false;
      free.push(e);
    }
  }
  return { obtain, release, warm };
})();

function spawnPooledEnemy(list, x, y, type, scale) {
  const e = EnemyPool.obtain(x, y, type, scale);
  if (list) list.push(e);
  return e;
}

class Asteroid {
  constructor(x, y, size, vx, vy) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.r = size === 3 ? 42 : size === 2 ? 26 : 14;
    this.vx = vx ?? rand(-70, 70);
    this.vy = vy ?? rand(-70, 70);
    this.rot = rand(0, TAU);
    this.spin = rand(-1.6, 1.6);
    this.hp = size;
    this.verts = this.makeVerts();
    this.kind = "rock";
  }
  makeVerts() {
    const n = 8 + this.size;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const jagged = rand(0.72, 1.08);
      pts.push({ a, r: this.r * jagged });
    }
    return pts;
  }
  update(dt, w, h) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.spin * dt;
    wrap(this, w, h, this.r);
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = "#ff9a3c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.verts.forEach((v, i) => {
      const x = Math.cos(v.a) * v.r;
      const y = Math.sin(v.a) * v.r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  split() {
    if (this.size <= 1) return [];
    const next = this.size - 1;
    const bits = [];
    for (let i = 0; i < 2; i++) {
      const a = rand(0, TAU);
      const s = rand(50, 110);
      bits.push(new Asteroid(this.x, this.y, next, Math.cos(a) * s, Math.sin(a) * s));
    }
    return bits;
  }
}

class Boss {
  constructor(x, y, kind) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.angle = 0;
    this.cool = 1.2;
    this.t = 0;
    this.kindFlag = "boss";
    if (kind === "mini_rock") {
      this.name = "FRAGMENTO-ALFA";
      this.tier = "mini";
      this.r = 52;
      this.hp = 48;
      this.maxHp = 48;
      this.speed = 55;
      this.color = "#ff8844";
      this.score = 900;
    } else if (kind === "mini_hunter") {
      this.name = "INTERCEPTADOR";
      this.tier = "mini";
      this.r = 24;
      this.hp = 40;
      this.maxHp = 40;
      this.speed = 125;
      this.color = "#c084fc";
      this.score = 1100;
    } else if (kind === "cruiser") {
      this.name = "CRUZADOR";
      this.tier = "boss";
      this.r = 40;
      this.hp = 92;
      this.maxHp = 92;
      this.speed = 70;
      this.color = "#ff4d9a";
      this.score = 2400;
    } else {
      this.name = "NÚCLEO";
      this.tier = "boss";
      this.r = 56;
      this.hp = 150;
      this.maxHp = 150;
      this.speed = 60;
      this.color = "#6688ff";
      this.score = 4000;
    }
  }
  update(dt, w, h, player, bullets) {
    this.t += dt;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    this.angle = Math.atan2(dy, dx);
    const d = Math.hypot(dx, dy) || 1;

    if (this.kind === "mini_rock") {
      this.x += Math.cos(this.angle) * this.speed * dt * 0.45;
      this.y += Math.sin(this.angle) * this.speed * dt * 0.45;
      this.x += Math.cos(this.t * 0.7) * 40 * dt;
      this.cool -= dt;
      if (this.cool <= 0) {
        this.cool = 1.6;
        for (let i = 0; i < 5; i++) {
          const a = this.t + (i / 5) * TAU;
          spawnPooledBullet(bullets, this.x, this.y, a, 180, false, this.color, 14);
        }
      }
    } else if (this.kind === "mini_hunter") {
      const dash = 0.7 + 0.3 * Math.sin(this.t * 2.2);
      this.x += Math.cos(this.angle) * this.speed * dash * dt;
      this.y += Math.sin(this.angle) * this.speed * dash * dt;
      this.cool -= dt;
      if (this.cool <= 0 && d < 480) {
        this.cool = 0.9;
        spawnPooledBullet(bullets, this.x, this.y, this.angle, 320, false, this.color, 16);
      }
    } else if (this.kind === "cruiser") {
      const want = 300;
      const step = d > want ? this.speed : d < want - 80 ? -this.speed * 0.5 : 0;
      this.x += Math.cos(this.angle) * step * dt;
      this.y += Math.sin(this.angle) * step * dt;
      this.x += Math.cos(this.angle + Math.PI / 2) * 70 * dt;
      this.cool -= dt;
      if (this.cool <= 0) {
        this.cool = 0.95;
        for (let i = -1; i <= 1; i++) {
          spawnPooledBullet(bullets, this.x, this.y, this.angle + i * 0.18, 280, false, this.color, 18);
        }
      }
    } else {
      const want = 340;
      const step = d > want ? this.speed : -this.speed * 0.3;
      this.x += Math.cos(this.angle) * step * dt;
      this.y += Math.sin(this.angle) * step * dt;
      this.cool -= dt;
      const phase2 = this.hp < this.maxHp * 0.45;
      if (this.cool <= 0) {
        this.cool = phase2 ? 0.55 : 0.85;
        const n = phase2 ? 10 : 6;
        for (let i = 0; i < n; i++) {
          const a = this.t * 1.4 + (i / n) * TAU;
          spawnPooledBullet(bullets, this.x, this.y, a, phase2 ? 240 : 200, false, this.color, 18);
        }
      }
    }

    this.x = Math.max(this.r, Math.min(w - this.r, this.x));
    this.y = Math.max(this.r, Math.min(h - this.r, this.y));
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.tier === "boss" ? 3 : 2.4;
    ctx.beginPath();
    if (this.kind === "mini_rock" || this.kind === "core") {
      const n = this.kind === "core" ? 8 : 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const rr = this.r * (0.78 + 0.18 * Math.sin(this.t * 2 + i));
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (this.kind === "mini_hunter" || this.kind === "cruiser") {
      const br = this.r * 0.82;
      ctx.rect(-br * 0.55, -br * 0.48, br * 1.1, br * 0.96);
    } else {
      const d = this.r * 0.95;
      ctx.moveTo(0, -d);
      ctx.lineTo(d * 0.62, d * 0.2);
      ctx.lineTo(d * 0.35, d * 0.88);
      ctx.lineTo(-d * 0.35, d * 0.88);
      ctx.lineTo(-d * 0.62, d * 0.2);
      ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();
  }
}

function megaBeamDamage(ship, amount) {
  if (!ship || ship.hp <= 0 || amount <= 0) return;
  const prev = ship.iframes;
  ship.iframes = 0;
  ship.hp -= amount;
  ship.iframes = prev;
}

/* MegaBoss (Titan Hexagonal) vive em js/megaboss-titan.js */

class BossDrone {
  constructor(x, y, kind, target) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.target = target;
    this.t = 0;
    this.spent = false;
    this.delivered = false;
    this.lockedSpot = null;
    if (kind === "repair") {
      this.hp = 22;
      this.r = 12;
      this.speed = 170;
      this.color = "#44ff99";
      this.healPct = 0.28;
    } else {
      this.hp = 15;
      this.r = 10;
      this.speed = 80;
      this.color = "#ff3355";
      this.lockedX = target && Number.isFinite(target.x) ? target.x : x;
      this.lockedY = target && Number.isFinite(target.y) ? target.y : y;
    }
  }

  pickRepairSpot(megaBoss) {
    if (this.lockedSpot && this.lockedSpot.alive) return this.lockedSpot;
    const spots = (megaBoss && megaBoss.weakSpots) || [];
    let best = null;
    let worst = 2;
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      if (!s.alive) continue;
      const ratio = s.hp / Math.max(1, s.maxHp);
      if (ratio < worst) {
        worst = ratio;
        best = s;
      }
    }
    this.lockedSpot = best;
    return best;
  }

  deliverRepair(spot) {
    const max = Math.max(1, spot.maxHp);
    const amount = max * this.healPct;
    spot.hp = Math.min(max, spot.hp + amount);
    this.delivered = true;
    this.spent = true;
  }

  update(dt, w, h, player, megaBoss) {
    this.t += dt;
    if (this.spent) return;
    if (this.kind === "repair") {
      const spot = this.pickRepairSpot(megaBoss);
      if (!spot) {
        this.spent = true;
        return;
      }
      const p =
        megaBoss && typeof megaBoss.getWeakSpotWorldPos === "function"
          ? megaBoss.getWeakSpotWorldPos(spot)
          : { x: megaBoss.x, y: megaBoss.y };
      const dx = p.x - this.x;
      const dy = p.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.x += (dx / d) * this.speed * dt;
      this.y += (dy / d) * this.speed * dt;
      if (d < 22) this.deliverRepair(spot);
      return;
    }
    const dx = this.lockedX - this.x;
    const dy = this.lockedY - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.speed = Math.min(420, this.speed + 140 * dt);
    this.x += (dx / d) * this.speed * dt;
    this.y += (dy / d) * this.speed * dt;
    wrap(this, w, h, this.r);
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (this.kind === "repair") {
      ctx.rect(-this.r, -this.r, this.r * 2, this.r * 2);
    } else {
      ctx.moveTo(this.r, 0);
      ctx.lineTo(-this.r, this.r * 0.75);
      ctx.lineTo(-this.r * 0.5, 0);
      ctx.lineTo(-this.r, -this.r * 0.75);
    }
    ctx.closePath();
    ctx.stroke();
    if (this.kind === "kamikaze") {
      ctx.strokeStyle = "rgba(255,50,80,0.5)";
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(-this.r * 2, 0);
      ctx.lineTo(-this.r * 4, 0);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

const ENEMY_TIER_COLORS = ["#e8c938", "#d932c4", "#52d95c", "#f0c020", "#c018b0", "#38e078", "#ff6a00"];

const PILOT_SLOT_COLORS = {
  host: "#5cffd1",
  guest: "#ff70dc",
};

function enemyTierColor(scale) {
  const i = Math.max(0, Math.min(ENEMY_TIER_COLORS.length - 1, Math.floor(scale) - 1));
  return ENEMY_TIER_COLORS[i];
}

function pickEnemyType(scale) {
  const bag = ["chaser", "chaser", "shooter"];
  if (scale > 1.35) bag.push("orbit", "swarm", "shooter");
  if (scale > 2.1) bag.push("sniper", "block");
  if (scale > 3.2) bag.push("sniper", "block", "orbit");
  return pick(bag);
}

class Enemy {
  constructor(x, y, type, scale = 1) {
    this.reset(x, y, type, scale);
  }
  reset(x, y, type, scale = 1) {
    this.active = true;
    this._pooled = false;
    this.x = x;
    this.y = y;
    this.type = type;
    this.scale = scale;
    this.color = enemyTierColor(scale);
    this.angle = 0;
    this.cool = rand(0.35, 1.2);
    this.kind = "enemy";
    this.orbit = rand(0, TAU);
    this.loveAng = undefined;
    this.nid = 0;
    const bonus = Math.max(0, Math.floor(scale - 1));
    const sm = 1 + Math.min(2.2, (scale - 1) * 0.14);
    const stats = {
      chaser: { r: 14, hp: 2, speed: rand(95, 140), score: 120 },
      shooter: { r: 16, hp: 3, speed: rand(55, 85), score: 180 },
      orbit: { r: 18, hp: 4, speed: rand(70, 100), score: 220 },
      sniper: { r: 13, hp: 2, speed: rand(40, 60), score: 260 },
      block: { r: 22, hp: 6, speed: rand(32, 48), score: 280 },
      swarm: { r: 9, hp: 1, speed: rand(150, 190), score: 70 },
    };
    const st = stats[type] || stats.chaser;
    this.r = st.r;
    this.hp = st.hp + (type === "swarm" ? 0 : bonus);
    this.speed = st.speed * sm;
    this.score = st.score;
    return this;
  }
  shoot(bullets, angle, speed, color, radius) {
    const b = spawnPooledBullet(null, this.x, this.y, angle, speed, false, color || this.color, 14);
    if (radius) b.r = radius;
    bullets.push(b);
  }
  shootHeart(hearts, angle, speed) {
    if (!hearts || hearts.length > 96) return;
    hearts.push(new HeartProjectile(this.x, this.y, angle + rand(-0.18, 0.18), speed));
  }
  cruiseLove(dt, w, h, hearts) {
    if (this.loveAng == null) {
      this.loveAng = this.x < w * 0.5 ? 0 : Math.PI;
      this.loveAng += rand(-0.28, 0.28);
      this.speed = rand(78, 128);
      this.cool = rand(0.15, 0.7);
    }
    this.angle = this.loveAng;
    this.x += Math.cos(this.loveAng) * this.speed * dt;
    this.y += Math.sin(this.loveAng) * this.speed * dt;
    this.cool -= dt;
    if (this.cool <= 0) {
      this.cool = rand(0.55, 1.15);
      this.shootHeart(hearts, this.loveAng + Math.PI * 0.5 * (Math.random() < 0.5 ? 1 : -1), rand(70, 140));
    }
    wrap(this, w, h, this.r);
  }
  update(dt, w, h, player, bullets, hearts) {
    if (hearts) {
      this.cruiseLove(dt, w, h, hearts);
      return;
    }
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.angle = Math.atan2(dy, dx);
    if (this.type === "chaser" || this.type === "swarm") {
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;
    } else if (this.type === "orbit") {
      this.orbit += dt * 1.4;
      const want = 240;
      const step = d > want ? this.speed : d < want - 50 ? -this.speed * 0.6 : 0;
      this.x += Math.cos(this.angle) * step * dt;
      this.y += Math.sin(this.angle) * step * dt;
      this.x += Math.cos(this.orbit) * 90 * dt;
      this.y += Math.sin(this.orbit) * 90 * dt;
      this.cool -= dt;
      if (this.cool <= 0 && d < 560) {
        this.cool = rand(1.1, 1.7);
        for (let i = -1; i <= 1; i++) this.shoot(bullets, this.angle + i * 0.35, 220, this.color, 3.2);
      }
    } else if (this.type === "sniper") {
      const want = 420;
      const step = d > want ? this.speed : d < want - 80 ? -this.speed * 0.8 : 0;
      this.x += Math.cos(this.angle) * step * dt;
      this.y += Math.sin(this.angle) * step * dt;
      this.cool -= dt;
      if (this.cool <= 0 && d < 720) {
        this.cool = rand(1.6, 2.3);
        this.shoot(bullets, this.angle, 460, "#fff6c2", 2.2);
      }
    } else if (this.type === "block") {
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;
      this.cool -= dt;
      if (this.cool <= 0 && d < 380) {
        this.cool = rand(1.3, 1.9);
        this.shoot(bullets, this.angle - 0.2, 160, this.color, 6.5);
        this.shoot(bullets, this.angle + 0.2, 160, this.color, 6.5);
      }
    } else {
      const want = 280;
      const step = d > want ? this.speed : d < want - 60 ? -this.speed * 0.7 : 0;
      this.x += Math.cos(this.angle) * step * dt;
      this.y += Math.sin(this.angle) * step * dt;
      this.x += Math.cos(this.angle + Math.PI / 2) * 40 * dt;
      this.cool -= dt;
      if (this.cool <= 0 && d < 520) {
        this.cool = rand(0.85, 1.4);
        this.shoot(bullets, this.angle, 260, this.color, 3.8);
      }
    }
    wrap(this, w, h, this.r);
  }
  traceShape(ctx) {
    const r = this.r;
    ctx.beginPath();
    if (this.type === "shooter") {
      const bw = r * 0.92;
      const bh = r * 0.78;
      const jaw = bh * 0.42;
      const open = bw * 0.34;
      ctx.moveTo(-bw * 0.42, -bh * 0.5);
      ctx.lineTo(bw * 0.38, -bh * 0.5);
      ctx.lineTo(bw * 0.48, -jaw);
      ctx.lineTo(open, -jaw);
      ctx.lineTo(open * 0.2, 0);
      ctx.lineTo(open, jaw);
      ctx.lineTo(bw * 0.48, jaw);
      ctx.lineTo(bw * 0.38, bh * 0.5);
      ctx.lineTo(-bw * 0.42, bh * 0.5);
      ctx.lineTo(-bw * 0.48, jaw * 0.55);
      ctx.lineTo(-bw * 0.48, -jaw * 0.55);
    } else if (this.type === "chaser") {
      const bw = r * 1.05;
      const bh = r * 0.72;
      const ix = bw * 0.22;
      ctx.moveTo(-bw * 0.5, -bh * 0.5);
      ctx.lineTo(bw * 0.42, -bh * 0.5);
      ctx.lineTo(bw * 0.5, -bh * 0.18);
      ctx.lineTo(ix, -bh * 0.18);
      ctx.lineTo(ix, bh * 0.18);
      ctx.lineTo(bw * 0.5, bh * 0.18);
      ctx.lineTo(bw * 0.42, bh * 0.5);
      ctx.lineTo(-bw * 0.5, bh * 0.5);
    } else if (this.type === "orbit") {
      const spike = r * 1.05;
      ctx.moveTo(0, -spike);
      ctx.lineTo(r * 0.72, -r * 0.15);
      ctx.lineTo(r * 0.95, r * 0.65);
      ctx.lineTo(0, r * 0.42);
      ctx.lineTo(-r * 0.95, r * 0.65);
      ctx.lineTo(-r * 0.72, -r * 0.15);
    } else if (this.type === "sniper") {
      const d = r * 0.92;
      ctx.moveTo(0, -d);
      ctx.lineTo(d * 0.55, 0);
      ctx.lineTo(0, d);
      ctx.lineTo(-d * 0.55, 0);
    } else if (this.type === "block") {
      ctx.rect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
    } else if (this.type === "swarm") {
      const u = r * 0.55;
      const top = -r * 0.9;
      ctx.moveTo(-u, top);
      ctx.lineTo(u, top);
      ctx.lineTo(r * 0.95, r * 0.75);
      ctx.lineTo(0, r * 0.35);
      ctx.lineTo(-r * 0.95, r * 0.75);
    } else {
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.75, r * 0.75);
      ctx.lineTo(-r * 0.75, -r * 0.75);
    }
    ctx.closePath();
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.type === "block" ? 3 : 2;
    this.traceShape(ctx);
    ctx.stroke();
    ctx.restore();
  }
}

if (typeof EnemyPool !== "undefined" && EnemyPool.warm) EnemyPool.warm(64);

/** Perks por nave (meta survival / score). */
const SHIP_PERKS = {
  lanca: {
    comboTimerExtra: 0.5,
    comboKillsPerMult: 3,
    scoreVitalMul: 1.15,
    scoreBossMul: 1.12,
    scoreFarmMul: 1.06,
    pierceRocks: 3,
    rapidGapScale: 0.82,
  },
  bastiao: {
    comboGuardCd: 14,
    scoreVitalMul: 1.08,
    scoreBossMul: 1.1,
    rapidGapScale: 0.82,
    shieldBonus: 2.5,
    scoreSurvivalInterval: 25,
    scoreSurvivalPoints: 38,
  },
  dardo: {
    incomingDmgMul: 2,
    scoreFarmMul: 1.1,
    rapidGapScale: 0.82,
  },
};

function shipPerks(shipId) {
  return SHIP_PERKS[shipId] || {};
}

function comboKillsPerMult(shipId) {
  const p = shipPerks(shipId);
  return p.comboKillsPerMult > 0 ? p.comboKillsPerMult : 4;
}

function megaBulletDamage(bullet) {
  const raw = Math.max(1, bullet.dmg || 10);
  return Math.max(1, Math.round(raw));
}

/** Ângulos locais (relativos à mira) para disparo no buff T — espelha o desenho vetorial. */
const SHIP_VERTEX_SHOT_ANGLES = {
  bastiao: (() => {
    const a = [];
    for (let i = 0; i < 6; i++) a.push((i / 6) * TAU);
    return a;
  })(),
  lanca: [0, Math.atan2(0.75, -0.85), Math.PI, Math.atan2(-0.75, -0.85)],
  dardo: [0, Math.PI / 2, Math.PI, -Math.PI / 2],
};

function shotAnglesDardoMulti(aim) {
  return SHIP_VERTEX_SHOT_ANGLES.dardo.map((la) => aim + la);
}

function shotAnglesLancaMulti(aim) {
  const tight = 0.035;
  const out = [aim - tight, aim, aim + tight];
  SHIP_VERTEX_SHOT_ANGLES.lanca.forEach((la) => out.push(aim + la));
  return out;
}

function shotgunFanAngles(aim, n, spread) {
  let count = Math.max(1, n | 0);
  if (count % 2 === 0) count += 1;
  const mid = (count - 1) / 2;
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(aim + (i - mid) * spread);
  }
  return out;
}

function shotAnglesBastiaoMulti(aim) {
  const verts = SHIP_VERTEX_SHOT_ANGLES.bastiao.map((la) => aim + la);
  return [aim, aim].concat(verts);
}

const SHIP_ROSTER = [
  {
    id: "lanca",
    name: "Lança",
    blurb: "Equilibrada. 1 tiro reto, 200 ms, 10 de dano. T: rajada + vértices.",
    hp: 100,
    speed: 340,
    acc: 1000,
    r: 14,
    fireRateMs: 200,
    gap: 0.2,
    shots: 1,
    spread: 0,
    bulletSpeed: 640,
    bulletDmg: 10,
    color: "#4de8ff",
  },
  {
    id: "dardo",
    name: "Dardo",
    blurb: "Metralhadora frágil. 80 ms, 3 de dano, projétil +50% vel. T: vértices.",
    hp: 50,
    speed: 442,
    acc: 1500,
    r: 10,
    fireRateMs: 80,
    gap: 0.08,
    shots: 1,
    spread: 0,
    aimJitterDeg: 2,
    bulletSpeed: 960,
    bulletDmg: 3,
    color: "#58d4ff",
  },
  {
    id: "bastiao",
    name: "Bastião",
    blurb: "Shotgun pesada. 5 tiros, 600 ms, 4 dano cada. Errou, espera. T: hex.",
    hp: 300,
    speed: 272,
    acc: 680,
    r: 21,
    fireRateMs: 600,
    gap: 0.6,
    shots: 5,
    spread: 0.26,
    bulletSpeed: 500,
    bulletDmg: 4,
    color: "#ffb347",
  },
];

function shipById(id) {
  return SHIP_ROSTER.find((s) => s.id === id) || SHIP_ROSTER[0];
}

function pilotColorFor(slot) {
  return slot === "host" || slot === "guest" ? PILOT_SLOT_COLORS[slot] : "";
}

function setPilotSlot(ship, slot) {
  if (!ship) return;
  const tint = pilotColorFor(slot);
  ship.pilotColor = tint || ship.color;
  ship.pilotRing = tint ? "#ffffff" : "rgba(255,255,255,0.55)";
}

class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.r = 12;
    this.life = 12;
    this.kind = "power";
  }
  update(dt) {
    this.life -= dt;
  }
  draw(ctx) {
    const colors = { rapid: "#4de8ff", shield: "#7cffb2", multi: "#ffe566", heal: "#7dff9a" };
    const letters = { rapid: "R", shield: "E", multi: "T", heal: "+" };
    ctx.save();
    ctx.strokeStyle = colors[this.type] || "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + Math.sin(this.life * 6) * 2, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = colors[this.type] || "#fff";
    ctx.font = "12px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letters[this.type] || "?", this.x, this.y + 1);
    ctx.restore();
  }
}

class Player {
  constructor(x, y, shipId) {
    const spec = shipById(shipId);
    this.shipId = spec.id;
    this.shipName = spec.name;
    this.color = spec.color;
    this.pilotColor = spec.color;
    this.pilotRing = "rgba(255,255,255,0.55)";
    this.bulletDmg = spec.bulletDmg || 10;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.aim = 0;
    this.r = spec.r;
    this.maxSpeed = spec.speed;
    this.acc = spec.acc;
    this.fireRateMs = spec.fireRateMs > 0 ? spec.fireRateMs : Math.round((spec.gap || 0.2) * 1000);
    this.gap = this.fireRateMs / 1000;
    this.aimJitterDeg = spec.aimJitterDeg || 0;
    this.shots = spec.shots;
    this.spread = spec.spread;
    this.bulletSpeed = spec.bulletSpeed;
    this.hp = spec.hp;
    this.maxHp = spec.hp;
    this.iframes = 0;
    this.cool = 0;
    this.rapid = 0;
    this.shield = 0;
    this.multi = 0;
    this.starBlessing = 0;
    this.comboGuardReady = 0;
    this.survivalScoreAcc = 0;
  }
  update(dt, input, w, h) {
    this.comboGuardReady = Math.max(0, this.comboGuardReady - dt);
    const acc = this.acc;
    const max = this.maxSpeed;
    this.vx += input.move.x * acc * dt;
    this.vy += input.move.y * acc * dt;
    this.vx *= Math.pow(0.08, dt);
    this.vy *= Math.pow(0.08, dt);
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > max) {
      this.vx = (this.vx / sp) * max;
      this.vy = (this.vy / sp) * max;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    wrap(this, w, h, this.r);
    this.iframes = Math.max(0, this.iframes - dt);
    this.rapid = Math.max(0, this.rapid - dt);
    this.shield = Math.max(0, this.shield - dt);
    this.multi = Math.max(0, this.multi - dt);
    this.cool = Math.max(0, this.cool - dt);
  }
  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }
  hurt(n) {
    if (this.iframes > 0) return { hull: false, shield: false };
    if (this.shield > 0) {
      this.shield = Math.max(0, this.shield - 1.2);
      this.iframes = 0.35;
      return { hull: false, shield: true };
    }
    this.hp -= n;
    this.iframes = 1.05;
    return { hull: true, shield: false };
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.aim);
    if (this.iframes > 0 && ((this.iframes * 18) | 0) % 2 === 0) ctx.globalAlpha = 0.35;
    const stroke = this.pilotColor || this.color;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.8;
    ctx.shadowColor = stroke;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    const r = this.r + 2;
    if (this.shipId === "dardo") {
      ctx.moveTo(r + 4, 0);
      ctx.lineTo(0, r * 0.45);
      ctx.lineTo(-r, 0);
      ctx.lineTo(0, -r * 0.45);
    } else if (this.shipId === "bastiao") {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else {
      ctx.moveTo(r + 2, 0);
      ctx.lineTo(-r * 0.85, r * 0.75);
      ctx.lineTo(-r * 0.4, 0);
      ctx.lineTo(-r * 0.85, -r * 0.75);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = this.pilotRing || "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    if (this.shield > 0) {
      const bless = this.starBlessing > 0;
      ctx.strokeStyle = bless ? "rgba(255,105,180,0.85)" : "rgba(124,255,178,0.7)";
      ctx.shadowColor = bless ? "#da70d6" : "transparent";
      ctx.shadowBlur = bless ? 14 : 0;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, TAU);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
}
