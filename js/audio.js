const AudioFx = (() => {
  let ctx = null;
  let master = null;
  let started = false;
  let volume = 0.7;
  let wantMusic = false;
  let music = null;

  function ensure() {
    if (started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume * 0.26;
    master.connect(ctx.destination);
    started = true;
    if (wantMusic) startMusic();
  }

  function startMusic() {
    if (!started || music) return;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    g.connect(master);
    const low = ctx.createOscillator();
    const high = ctx.createOscillator();
    low.type = "sine";
    high.type = "triangle";
    low.frequency.value = 55;
    high.frequency.value = 110;
    low.connect(g);
    high.connect(g);
    low.start();
    high.start();
    music = { low, high, g };
  }

  function stopMusic() {
    if (!music) return;
    try {
      music.low.stop();
      music.high.stop();
    } catch (err) {}
    music = null;
  }

  function beep(freq, dur, type, gain) {
    if (!started) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain ?? 0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    resume() {
      ensure();
      if (ctx && ctx.state === "suspended") ctx.resume();
    },
    setVolume(percent) {
      const n = Number(percent);
      volume = (Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 70) / 100;
      if (master) master.gain.value = volume * 0.26;
    },
    setMusic(on) {
      wantMusic = !!on;
      if (!started) return;
      if (wantMusic) startMusic();
      else stopMusic();
    },
    shoot() {
      beep(880, 0.06, "square", 0.12);
    },
    hit() {
      beep(140, 0.18, "sawtooth", 0.28);
    },
    explode(size) {
      beep(220 - size * 18, 0.22, "triangle", 0.2);
    },
    combo() {
      beep(660, 0.08, "square", 0.16);
      setTimeout(() => beep(990, 0.1, "square", 0.14), 50);
    },
    power() {
      beep(520, 0.12, "sine", 0.2);
      beep(780, 0.16, "sine", 0.14);
    },
    heal() {
      beep(440, 0.12, "sine", 0.18);
      beep(660, 0.16, "sine", 0.16);
    },
    boss() {
      beep(90, 0.35, "sawtooth", 0.28);
      beep(180, 0.25, "square", 0.16);
    },
    win() {
      beep(520, 0.12, "square", 0.16);
      setTimeout(() => beep(780, 0.16, "square", 0.16), 80);
    },
    lose() {
      beep(110, 0.5, "sawtooth", 0.3);
    },
  };
})();
