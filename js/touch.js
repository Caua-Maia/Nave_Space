const TouchControls = (() => {
  const DEAD = 0.18;
  const zero = { x: 0, y: 0, mag: 0 };
  const axes = { left: { ...zero }, right: { ...zero }, shoot: false };
  const pointers = { left: null, right: null };
  const floats = { left: null, right: null };
  let root = null;
  let fsBtn = null;
  let pauseEdge = false;
  let visible = false;
  function isTouchDevice() {
    if (typeof Platform !== "undefined") return Platform.isMobile();
    const ua = navigator.userAgent || "";
    const iPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || iPad) {
      const fine = window.matchMedia("(any-pointer: fine)").matches;
      const hover = window.matchMedia("(any-hover: hover)").matches;
      if (fine || hover) return false;
      return true;
    }
    return window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(hover: none)").matches;
  }

  function knobOf(which) {
    return root.querySelector('[data-stick="' + which + '"] .knob');
  }

  function baseOf(which) {
    return root.querySelector('[data-stick="' + which + '"]');
  }

  function placeKnob(which, nx, ny, px) {
    const knob = knobOf(which);
    if (!knob) return;
    knob.style.transform = "translate(calc(-50% + " + nx * px + "px), calc(-50% + " + ny * px + "px))";
  }

  function resetStick(which) {
    axes[which] = { x: 0, y: 0, mag: 0 };
    if (which === "right") axes.shoot = false;
    placeKnob(which, 0, 0, 0);
  }

  function updateStick(which, event) {
    const el = baseOf(which);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(dist, max);
    const nx = dx / dist;
    const ny = dy / dist;
    placeKnob(which, nx, ny, clamped);
    const raw = clamped / max;
    if (raw < DEAD) {
      axes[which] = { x: 0, y: 0, mag: 0 };
    } else {
      const t = Math.min(1, (raw - DEAD) / (1 - DEAD));
      axes[which] = { x: nx * t, y: ny * t, mag: t };
    }
    if (which === "right") axes.shoot = axes.right.mag > 0.55;
    const base = baseOf(which);
    if (base) base.setAttribute("aria-valuenow", axes[which].mag.toFixed(2));
  }

  function touchMode() {
    if (typeof Save === "undefined") return "fixed";
    const mode = Save.load().options.touchMode;
    return mode === "follow" || mode === "split" ? mode : "fixed";
  }

  function vectorFrom(which, event, originX, originY, max) {
    const dx = event.clientX - originX;
    const dy = event.clientY - originY;
    const dist = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(dist, max);
    const nx = dx / dist;
    const ny = dy / dist;
    const raw = clamped / max;
    if (raw < DEAD) {
      axes[which] = { x: 0, y: 0, mag: 0 };
    } else {
      const t = Math.min(1, (raw - DEAD) / (1 - DEAD));
      axes[which] = { x: nx * t, y: ny * t, mag: t };
    }
    if (which === "right") axes.shoot = axes.right.mag > 0.45;
    if (touchMode() === "follow") placeKnob(which, nx, ny, clamped);
  }

  function showFloat(which, x, y) {
    const el = baseOf(which);
    if (!el) return;
    const box = root.getBoundingClientRect();
    el.classList.add("live");
    el.style.left = x - box.left - el.offsetWidth / 2 + "px";
    el.style.top = y - box.top - el.offsetHeight / 2 + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
  }

  function clearFloat(which) {
    floats[which] = null;
    resetStick(which);
    const el = baseOf(which);
    if (el) el.classList.remove("live");
    if (typeof Settings !== "undefined") Settings.apply();
  }

  function onSurfaceDown(event) {
    if (touchMode() === "fixed" || document.body.classList.contains("hud-edit")) return;
    if (event.target.closest("#touch-pause, #btn-fullscreen")) return;
    const box = root.getBoundingClientRect();
    const which = event.clientX < box.left + box.width / 2 ? "left" : "right";
    if (floats[which]) return;
    floats[which] = { id: event.pointerId, x: event.clientX, y: event.clientY };
    try {
      root.setPointerCapture(event.pointerId);
    } catch (err) {}
    event.preventDefault();
    if (touchMode() === "follow") showFloat(which, event.clientX, event.clientY);
    vectorFrom(which, event, event.clientX, event.clientY, 70);
  }

  function onSurfaceMove(event) {
    ["left", "right"].forEach((which) => {
      const spot = floats[which];
      if (!spot || spot.id !== event.pointerId) return;
      event.preventDefault();
      vectorFrom(which, event, spot.x, spot.y, 70);
    });
  }

  function onSurfaceEnd(event) {
    ["left", "right"].forEach((which) => {
      if (floats[which] && floats[which].id === event.pointerId) clearFloat(which);
    });
  }

  function bindStick(el) {
    const which = el.dataset.stick;
    el.addEventListener("pointerdown", (event) => {
      if (document.body.classList.contains("hud-edit")) return;
      if (pointers[which] != null) return;
      pointers[which] = event.pointerId;
      try {
        el.setPointerCapture(event.pointerId);
      } catch (err) {}
      event.preventDefault();
      updateStick(which, event);
    });
    el.addEventListener("pointermove", (event) => {
      if (pointers[which] !== event.pointerId) return;
      event.preventDefault();
      updateStick(which, event);
    });
    const end = (event) => {
      if (pointers[which] !== event.pointerId) return;
      pointers[which] = null;
      resetStick(which);
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  function mount() {
    if (document.getElementById("touch-ui")) return;
    if (typeof Platform !== "undefined") Platform.sync();
    if (!isTouchDevice()) return;
    const host = document.getElementById("app") || document.body;
    root = document.createElement("div");
    root.id = "touch-ui";
    root.className = "hidden";
    root.innerHTML =
      '<button type="button" id="touch-pause" data-layout="pause" data-label="Pausa">PAUSA</button>' +
      '<div class="stick left" data-stick="left" data-layout="stickL" data-label="Mover" role="slider" aria-label="Mover" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0"><div class="knob"></div></div>' +
      '<div class="stick right" data-stick="right" data-layout="stickR" data-label="Mirar" role="slider" aria-label="Mirar" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0"><div class="knob"></div></div>';
    host.appendChild(root);
    root.querySelectorAll(".stick").forEach(bindStick);
    root.querySelector("#touch-pause").addEventListener("click", () => {
      if (document.body.classList.contains("hud-edit")) return;
      pauseEdge = true;
    });
    root.addEventListener("contextmenu", (event) => event.preventDefault());
    root.addEventListener("pointerdown", onSurfaceDown);
    root.addEventListener("pointermove", onSurfaceMove);
    root.addEventListener("pointerup", onSurfaceEnd);
    root.addEventListener("pointercancel", onSurfaceEnd);

    fsBtn = document.createElement("button");
    fsBtn.id = "btn-fullscreen";
    fsBtn.type = "button";
    fsBtn.className = "hidden";
    fsBtn.dataset.layout = "full";
    fsBtn.dataset.label = "Tela cheia";
    fsBtn.textContent = "TELA CHEIA";
    fsBtn.addEventListener("click", toggleFullscreen);
    host.appendChild(fsBtn);
    const hint = document.createElement("p");
    hint.id = "fs-hint";
    hint.className = "hidden";
    host.appendChild(hint);
    document.addEventListener("fullscreenchange", syncFullscreenButton);
    document.addEventListener("webkitfullscreenchange", syncFullscreenButton);
    syncFullscreenButton();
  }

  function isIphone() {
    return /iPhone|iPod/.test(navigator.userAgent || "");
  }

  function safariBarsOpen() {
    const vv = window.visualViewport;
    if (!vv) return false;
    return window.innerHeight - vv.height > 28 || vv.offsetTop > 8;
  }

  function showFsHint(text) {
    const hint = document.getElementById("fs-hint");
    if (!hint) return;
    hint.textContent = text;
    hint.classList.remove("hidden");
    clearTimeout(showFsHint.timer);
    showFsHint.timer = setTimeout(() => hint.classList.add("hidden"), 4200);
  }

  function collapseIosChrome() {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlPos: html.style.position,
      bodyPos: body.style.position,
      htmlH: html.style.height,
      bodyH: body.style.height,
      overflow: html.style.overflow,
      touch: body.style.touchAction,
    };
    html.style.position = "static";
    body.style.position = "relative";
    html.style.height = "auto";
    body.style.height = window.innerHeight + 140 + "px";
    html.style.overflow = "auto";
    body.style.touchAction = "pan-y";
    window.scrollTo(0, 80);
    setTimeout(() => {
      window.scrollTo(0, 0);
      html.style.position = prev.htmlPos;
      body.style.position = prev.bodyPos;
      html.style.height = prev.htmlH;
      body.style.height = prev.bodyH;
      html.style.overflow = prev.overflow;
      body.style.touchAction = prev.touch;
      if (safariBarsOpen()) {
        showFsHint("O iPhone não esconde a barra pelo botão. Toque em aA na barra do Safari e escolha Ocultar barra de ferramentas, ou Compartilhar e Adicionar à Tela de Início.");
      }
    }, 350);
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function toggleFullscreen() {
    if (document.body.classList.contains("hud-edit")) return;
    const el = document.documentElement;
    if (fullscreenElement()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
      return;
    }
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req && !isIphone()) {
      Promise.resolve(req.call(el)).catch(() => {});
      return;
    }
    if (isIphone()) {
      collapseIosChrome();
      return;
    }
    if (req) Promise.resolve(req.call(el)).catch(() => {});
  }

  function syncFullscreenButton() {
    if (!fsBtn) return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    fsBtn.classList.toggle("hidden", !isTouchDevice() || standalone);
    fsBtn.textContent = fullscreenElement() ? "JANELA" : "TELA CHEIA";
  }

  function apply() {
    if (!root) return;
    const show = visible && isTouchDevice();
    root.classList.toggle("hidden", !show);
    document.body.classList.toggle("touch-play", show);
    if (!show) {
      pointers.left = null;
      pointers.right = null;
      floats.left = null;
      floats.right = null;
      resetStick("left");
      resetStick("right");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  return {
    isTouchDevice,
    setVisible(on) {
      visible = !!on;
      apply();
    },
    read() {
      const pausePressed = pauseEdge;
      pauseEdge = false;
      return {
        left: axes.left,
        right: axes.right,
        shoot: axes.shoot,
        pausePressed,
        mode: visible && isTouchDevice(),
      };
    },
  };
})();
