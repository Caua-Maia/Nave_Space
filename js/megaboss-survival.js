/**
 * Mega bosses — modo Sobrevivência (Etapa 1: infraestrutura orientada a dados).
 * Titan, Prisma e Órbita jogáveis; demais no rodízio quando implementados.
 */
const SurvivalMega = (() => {
  const WARN_SEC = 2.5;
  const VULN_SEC = 7;
  const WAVE_INTERVAL = 12;
  const MIN_WAVE = 8;
  const COMBO_GRACE = 8;
  const COMBO_TIMER_MAX = 2.1;
  const MAX_PHASE = 3;

  const CATALOG = {
    titan: {
      id: "titan",
      name: "TITAN HEXAGONAL",
      subtitle: "Núcleo autônomo",
      shape: "hex",
      implemented: true,
      palette: { stroke: "#00f0ff", fill: "#1a1d28", vital: "#ff9900" },
    },
    prisma: {
      id: "prisma",
      name: "PRISMA",
      subtitle: "Varredura triangular",
      shape: "triangle",
      implemented: true,
      palette: { stroke: "#4de8ff", fill: "#0a1420", vital: "#ffb347" },
    },
    orbita: {
      id: "orbita",
      name: "ÓRBITA",
      subtitle: "Anel octogonal",
      shape: "octagon",
      implemented: true,
      palette: { stroke: "#ff4d9a", fill: "#140a12", vital: "#ff4d9a" },
    },
    muralha: {
      id: "muralha",
      name: "MURALHA",
      subtitle: "Painéis quadrados",
      shape: "square",
      implemented: false,
      palette: { stroke: "#ffb347", fill: "#1a1408", vital: "#4de8ff" },
    },
    olho: {
      id: "olho",
      name: "OLHO",
      subtitle: "Núcleo circular",
      shape: "circle",
      implemented: false,
      palette: { stroke: "#6688ff", fill: "#0a0f1a", vital: "#4de8ff" },
    },
  };

  const ROTATION = ["titan", "prisma", "orbita", "muralha", "olho"];

  let defeatedCount = 0;
  let phase = 1;
  let vulnerableLeft = 0;

  function def(id) {
    return CATALOG[id] || CATALOG.titan;
  }

  function pickType(rotationIndex) {
    const id = ROTATION[rotationIndex % ROTATION.length];
    const entry = def(id);
    return entry.implemented ? id : "titan";
  }

  function telegraphMul() {
    if (typeof document !== "undefined" && document.body && document.body.classList.contains("touch-play")) return 1.35;
    return 1;
  }

  function scaleBoss(boss, cycle) {
    const m = 1 + Math.max(0, cycle) * 0.14;
    boss.maxCoreHp = Math.round(boss.maxCoreHp * m);
    boss.coreHp = boss.maxCoreHp;
    boss.score = Math.round(boss.score * m);
    boss.weakSpots.forEach((s) => {
      const base = s.maxHp;
      s.maxHp = Math.round(base * m);
      s.hp = s.maxHp;
    });
    boss.patternScale = 1 + cycle * 0.08;
    boss.telegraphScale = telegraphMul();
  }

  function respawnVitals(boss, phaseNum) {
    const m = 1 + (phaseNum - 1) * 0.22;
    boss.weakSpots.forEach((s) => {
      const baseMax = s.maxHp / (phaseNum > 1 ? 1 + (phaseNum - 2) * 0.22 : 1);
      const maxHp = Math.round(Math.max(40, baseMax) * m);
      s.maxHp = maxHp;
      s.hp = maxHp;
      s.alive = true;
    });
    boss.shieldActive = true;
    boss.currentPattern = "IDLE";
    boss.patternTimer = Math.max(0.15, 0.5 - phaseNum * 0.12);
    if (typeof boss.onSurvivalPhaseRespawn === "function") boss.onSurvivalPhaseRespawn(phaseNum);
  }

  function applyProfile(boss, typeId) {
    const entry = def(typeId);
    boss.profileId = typeId;
    boss.name = entry.name.toUpperCase();
    boss.displaySubtitle = entry.subtitle;
    boss.palette = entry.palette;
  }

  function anchorY(typeId, h) {
    if (typeId === "prisma") return h * 0.14;
    if (typeId === "orbita") return h * 0.48;
    return h * 0.22;
  }

  function createInstance(typeId, x, y, cycle, viewportW, viewportH) {
    const tid = CATALOG[typeId] && CATALOG[typeId].implemented ? typeId : "titan";
    let boss;
    if (tid === "prisma" && typeof PrismaMega !== "undefined") {
      boss = new PrismaMega(x, y, { survivalMode: true });
    } else if (tid === "orbita" && typeof OrbitaMega !== "undefined") {
      boss = new OrbitaMega(x, y, { survivalMode: true });
      if (viewportW != null && viewportH != null) boss.initArena(viewportW, viewportH);
    } else {
      boss = new MegaBoss(x, y, { survivalMode: true, profileId: tid });
    }
    applyProfile(boss, tid);
    boss.survivalPhase = 1;
    scaleBoss(boss, cycle);
    if (viewportH != null && viewportH > 0) boss.targetAnchorY = anchorY(tid, viewportH);
    return boss;
  }

  function onAllVitalsDown(boss) {
    if (!boss.survivalMode) {
      boss.shieldActive = false;
      return;
    }
    boss.shieldActive = false;
    vulnerableLeft = VULN_SEC;
  }

  function tickPhase(dt, boss) {
    if (!boss || !boss.survivalMode || vulnerableLeft <= 0) return;
    vulnerableLeft -= dt;
    if (vulnerableLeft > 0) return;
    if (boss.coreHp <= 0) return;
    if (phase >= MAX_PHASE) {
      boss.shieldActive = false;
      return;
    }
    phase += 1;
    boss.survivalPhase = phase;
    respawnVitals(boss, phase);
  }

  function coreOpen(boss) {
    if (!boss) return false;
    if (!boss.survivalMode) return !boss.shieldActive;
    return vulnerableLeft > 0 && !boss.shieldActive;
  }

  function bodyBlocksShots(boss) {
    if (!boss.survivalMode) return boss.shieldActive;
    return boss.shieldActive || vulnerableLeft <= 0;
  }

  function resetEncounterState() {
    phase = 1;
    vulnerableLeft = 0;
  }

  function startEncounter() {
    resetEncounterState();
  }

  function onVictory() {
    defeatedCount += 1;
    resetEncounterState();
    return defeatedCount;
  }

  return {
    WARN_SEC,
    VULN_SEC,
    WAVE_INTERVAL,
    MIN_WAVE,
    COMBO_GRACE,
    COMBO_TIMER_MAX,
    CATALOG,
    ROTATION,
    def,
    pickType,
    createInstance,
    startEncounter,
    onAllVitalsDown,
    tickPhase,
    coreOpen,
    bodyBlocksShots,
    onVictory,
    defeatedCount: () => defeatedCount,
    getPhase: () => phase,
    getVulnerableLeft: () => vulnerableLeft,
    telegraphMul,
  };
})();
