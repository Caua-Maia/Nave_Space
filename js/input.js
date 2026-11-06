const Input = (() => {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, inside: false };
  let padIndex = null;
  let padName = "";
  let padMapping = "";
  const prevButtons = {};

  // Gamepad / WASD: zona morta ~0,18. O limiar do analógico direito de tiro no celular fica em touch.js (TOUCH_FIRE_DEAD).
  const DEAD = 0.18;

  function stick(x, y) {
    const mag = Math.hypot(x, y);
    if (mag < DEAD) return { x: 0, y: 0, mag: 0 };
    const t = (mag - DEAD) / (1 - DEAD);
    const s = Math.min(1, t) / mag;
    return { x: x * s, y: y * s, mag: Math.min(1, t) };
  }

  function buttonValue(btn) {
    if (btn == null) return 0;
    if (typeof btn === "object") return btn.value ?? (btn.pressed ? 1 : 0);
    return btn ? 1 : 0;
  }

  function readPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = padIndex != null ? pads[padIndex] : null;
    if (!gp) {
      for (const p of pads) {
        if (p) {
          gp = p;
          padIndex = p.index;
          padName = p.id || "Gamepad";
          padMapping = p.mapping || "raw";
          break;
        }
      }
    }
    if (!gp) {
      padIndex = null;
      padName = "";
      return null;
    }

    const ax = gp.axes || [];
    const left = stick(ax[0] || 0, ax[1] || 0);

    let rx = ax[2] || 0;
    let ry = ax[3] || 0;
    // DualShock 4 em modo DirectInput às vezes usa eixos 2 e 5 no stick direito
    if (Math.hypot(rx, ry) < DEAD && ax.length > 5) {
      const alt = stick(ax[2] || 0, ax[5] || 0);
      if (alt.mag > 0) {
        rx = ax[2] || 0;
        ry = ax[5] || 0;
      }
    }
    const right = stick(rx, ry);

    const btns = gp.buttons || [];
    const r2 = Math.max(buttonValue(btns[7]), buttonValue(btns[5]));
    const l2 = buttonValue(btns[6]);
    const start = buttonValue(btns[9]) > 0.5;
    const cross = buttonValue(btns[0]) > 0.5;
    const optionsAlt = buttonValue(btns[11]) > 0.5;

    return {
      left,
      right,
      shoot: r2 > 0.12 || right.mag > 0.55,
      r2,
      l2,
      start: start || optionsAlt,
      confirm: cross,
      name: padName,
      mapping: padMapping || gp.mapping,
    };
  }

  function justPressed(name, down) {
    const was = !!prevButtons[name];
    prevButtons[name] = down;
    return down && !was;
  }

  function snapshot() {
    const pad = readPad();
    const touch = typeof TouchControls !== "undefined" ? TouchControls.read() : null;
    let moveX = 0;
    let moveY = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) moveX -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) moveX += 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) moveY -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) moveY += 1;
    const kLen = Math.hypot(moveX, moveY) || 1;

    const kbMove = { x: moveX / kLen, y: moveY / kLen, mag: Math.min(1, Math.hypot(moveX, moveY)) };
    const desktop =
      typeof Platform !== "undefined"
        ? Platform.isDesktop()
        : typeof document !== "undefined" && document.body && document.body.dataset.platform === "desktop";
    const move =
      pad && pad.left.mag > 0.02
        ? { x: pad.left.x, y: pad.left.y, mag: pad.left.mag }
        : desktop && kbMove.mag > 0.02
          ? kbMove
          : touch && touch.mode && touch.left.mag > 0.02
            ? { x: touch.left.x, y: touch.left.y, mag: touch.left.mag }
            : kbMove;

    const touchAimFire = !!(touch && touch.mode && touch.shoot);
    const kbShoot = touchAimFire || mouse.down || keys.has("Space") || keys.has("KeyJ");
    const pausePressed = justPressed(
      "pause",
      keys.has("Escape") || keys.has("KeyP") || !!(pad && pad.start) || !!(touch && touch.pausePressed)
    );
    const confirmPressed = justPressed("ok", keys.has("Enter") || !!(pad && pad.confirm));

    return {
      move,
      pad,
      touch,
      mouse,
      kbShoot,
      pausePressed,
      confirmPressed,
      anyKey: keys.size > 0 || mouse.down,
    };
  }

  function attach(canvas) {
    window.addEventListener("keydown", (e) => {
      keys.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => keys.delete(e.code));
    canvas.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
      mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
      mouse.inside = true;
    });
    canvas.addEventListener("mousedown", () => {
      mouse.down = true;
    });
    window.addEventListener("mouseup", () => {
      mouse.down = false;
    });
    window.addEventListener("gamepadconnected", (e) => {
      padIndex = e.gamepad.index;
      padName = e.gamepad.id || "Gamepad";
      padMapping = e.gamepad.mapping || "raw";
    });
    window.addEventListener("gamepaddisconnected", () => {
      padIndex = null;
      padName = "";
    });
  }

  return {
    attach,
    snapshot,
    status() {
      const desktop =
        typeof Platform !== "undefined" ? Platform.isDesktop() : document.body && document.body.dataset.platform === "desktop";
      if (!padName && !desktop && typeof TouchControls !== "undefined" && TouchControls.isTouchDevice()) {
        return "Controle: joysticks na tela";
      }
      if (!padName && desktop) return "Controle: teclado + mouse (Esc pausa)";
      if (!padName) return "Controle: não detectado (WASD + mouse)";
      const short = padName.length > 42 ? padName.slice(0, 42) + "…" : padName;
      return `Controle: ${short}`;
    },
  };
})();
