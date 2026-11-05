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

function spawnEdge(w, h, margin = 40) {
  const side = (Math.random() * 4) | 0;
  if (side === 0) return { x: rand(0, w), y: -margin };
  if (side === 1) return { x: rand(0, w), y: h + margin };
  if (side === 2) return { x: -margin, y: rand(0, h) };
  return { x: w + margin, y: rand(0, h) };
}

class Particle {
  constructor(x, y, color, speed = 180) {
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

class Bullet {
  constructor(x, y, angle, speed, fromPlayer, color, dmg = 16) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.r = fromPlayer ? 3.2 : 3.8;
    this.life = fromPlayer ? 1.15 : 2.4;
    this.fromPlayer = fromPlayer;
    this.color = color;
    this.dmg = dmg;
  }
  update(dt, w, h) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.fromPlayer) wrap(this, w, h, 8);
  }
  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
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
    ctx.strokeStyle = "#ffb347";
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
          bullets.push(new Bullet(this.x, this.y, a, 180, false, this.color, 14));
        }
      }
    } else if (this.kind === "mini_hunter") {
      const dash = 0.7 + 0.3 * Math.sin(this.t * 2.2);
      this.x += Math.cos(this.angle) * this.speed * dash * dt;
      this.y += Math.sin(this.angle) * this.speed * dash * dt;
      this.cool -= dt;
      if (this.cool <= 0 && d < 480) {
        this.cool = 0.9;
        bullets.push(new Bullet(this.x, this.y, this.angle, 320, false, this.color, 16));
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
          bullets.push(new Bullet(this.x, this.y, this.angle + i * 0.18, 280, false, this.color, 18));
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
          bullets.push(new Bullet(this.x, this.y, a, phase2 ? 240 : 200, false, this.color, 18));
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
    } else {
      ctx.moveTo(this.r, 0);
      ctx.lineTo(-this.r * 0.7, this.r * 0.55);
      ctx.lineTo(-this.r * 0.35, 0);
      ctx.lineTo(-this.r * 0.7, -this.r * 0.55);
      ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();
  }
}

const ENEMY_TIER_COLORS = ["#9dffb8", "#b088ff", "#6688ff", "#ffcc44", "#ff8844", "#ff4466", "#ff2200"];

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
    this.x = x;
    this.y = y;
    this.type = type;
    this.scale = scale;
    this.color = enemyTierColor(scale);
    this.angle = 0;
    this.cool = rand(0.35, 1.2);
    this.kind = "enemy";
    this.orbit = rand(0, TAU);
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
  }
  shoot(bullets, angle, speed, color, radius) {
    const b = new Bullet(this.x, this.y, angle, speed, false, color || this.color, 14);
    if (radius) b.r = radius;
    bullets.push(b);
  }
  update(dt, w, h, player, bullets) {
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
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.65, r * 0.7);
      ctx.lineTo(-r * 0.25, 0);
      ctx.lineTo(-r * 0.65, -r * 0.7);
    } else if (this.type === "orbit") {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU - Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else if (this.type === "sniper") {
      ctx.moveTo(r, 0);
      ctx.lineTo(0, r * 0.65);
      ctx.lineTo(-r, 0);
      ctx.lineTo(0, -r * 0.65);
    } else if (this.type === "block") {
      ctx.rect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
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

const SHIP_ROSTER = [
  {
    id: "lanca",
    name: "Lança",
    blurb: "Equilíbrio. Com o T, três tiros em leque. Boa para quem quer controle e dano constante.",
    hp: 105,
    speed: 350,
    acc: 1000,
    r: 14,
    gap: 0.12,
    shots: 1,
    spread: 0.2,
    bulletSpeed: 640,
    bulletDmg: 16,
    color: "#4de8ff",
  },
  {
    id: "dardo",
    name: "Dardo",
    blurb: "Rápida e frágil. Com o T, dispara para frente e para trás ao mesmo tempo.",
    hp: 78,
    speed: 480,
    acc: 1500,
    r: 10,
    gap: 0.065,
    shots: 1,
    spread: 0,
    bulletSpeed: 940,
    bulletDmg: 19,
    color: "#d4ff4d",
  },
  {
    id: "bastiao",
    name: "Bastião",
    blurb: "Hexágono pesado. Mais vida, anda devagar e dispara dois canhões laterais o tempo todo.",
    hp: 150,
    speed: 250,
    acc: 720,
    r: 18,
    gap: 0.18,
    shots: 2,
    spread: 0.28,
    bulletSpeed: 520,
    bulletDmg: 16,
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
    this.bulletDmg = spec.bulletDmg || 16;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.aim = 0;
    this.r = spec.r;
    this.maxSpeed = spec.speed;
    this.acc = spec.acc;
    this.gap = spec.gap;
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
  }
  update(dt, input, w, h) {
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
    if (this.iframes > 0) return false;
    if (this.shield > 0) {
      this.shield = Math.max(0, this.shield - 1.2);
      this.iframes = 0.35;
      return false;
    }
    this.hp -= n;
    this.iframes = 1.05;
    return true;
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
      ctx.strokeStyle = "rgba(124,255,178,0.7)";
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}
