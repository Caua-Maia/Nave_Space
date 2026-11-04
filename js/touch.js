const TouchControls = (() => {
  const DEAD = 0.18;
  const zero = { x: 0, y: 0, mag: 0 };
  const axes = { left: { ...zero }, right: { ...zero }, shoot: false };
  const pointers = { left: null, right: null };
  let root = null;
  let fsBtn = null;
  let pauseEdge = false;
  let visible = false;
  const handheld = detectHandheld();

  function detectHandheld() {
    const ua = navigator.userAgent || "";
    const iPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || iPad) return true;
    const fine = window.matchMedia("(any-pointer: fine)").matches;
    const hover = window.matchMedia("(any-hover: hover)").matches;
    if (fine || hover) return false;
    return window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(hover: none)").matches;
  }

  function isTouchDevice() {
    return handheld;
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

  function bindStick(el) {
    const which = el.dataset.stick;
    el.addEventListener("pointerdown", (event) => {
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
    const host = document.getElementById("app") || document.body;
    root = document.createElement("div");
    root.id = "touch-ui";
    root.className = "hidden";
    root.innerHTML =
      '<button type="button" id="touch-pause">PAUSA</button>' +
      '<div class="stick left" data-stick="left" role="slider" aria-label="Mover" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0"><div class="knob"></div></div>' +
      '<div class="stick right" data-stick="right" role="slider" aria-label="Mirar" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0"><div class="knob"></div></div>';
    host.appendChild(root);
    root.querySelectorAll(".stick").forEach(bindStick);
    root.querySelector("#touch-pause").addEventListener("click", () => {
      pauseEdge = true;
    });
    root.addEventListener("contextmenu", (event) => event.preventDefault());

    fsBtn = document.createElement("button");
    fsBtn.id = "btn-fullscreen";
    fsBtn.type = "button";
    fsBtn.className = "hidden";
    fsBtn.textContent = "TELA CHEIA";
    fsBtn.addEventListener("click", toggleFullscreen);
    host.appendChild(fsBtn);
    document.addEventListener("fullscreenchange", syncFullscreenButton);
    document.addEventListener("webkitfullscreenchange", syncFullscreenButton);
    syncFullscreenButton();
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function toggleFullscreen() {
    const el = document.documentElement;
    if (!fullscreenElement()) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        Promise.resolve(req.call(el)).catch(() => {});
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
    }
  }

  function syncFullscreenButton() {
    if (!fsBtn) return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    fsBtn.classList.toggle("hidden", !handheld || standalone);
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
