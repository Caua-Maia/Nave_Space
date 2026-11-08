const Settings = (() => {
  let editing = false;
  let draft = null;
  let doneHook = null;

  function current() {
    return Save.load().options;
  }

  function stageBox() {
    const stage = document.getElementById("app");
    return stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  }

  function place(el, pos) {
    if (!el || !pos) return;
    el.style.left = pos.x + "%";
    el.style.top = pos.y + "%";
    el.style.right = "auto";
    el.style.bottom = "auto";
    el.style.transform = "none";
  }

  function isBossHud(el) {
    const key = el && el.dataset.layout;
    return key === "boss" || key === "bossMega";
  }

  function clearPlaced(el) {
    if (!el) return;
    el.style.left = "";
    el.style.top = "";
    el.style.right = "";
    el.style.bottom = "";
    el.style.transform = "";
  }

  function apply(options) {
    if (typeof Platform !== "undefined") Platform.sync();
    const opt = options || current();
    AudioFx.setVolume(opt.volume);
    AudioFx.setMusic(opt.music);
    document.body.dataset.stickSize = opt.stickSize;
    document.body.dataset.touchMode = opt.touchMode || "fixed";
    const custom = !!(opt.layoutCustom || editing);
    document.body.dataset.layoutCustom = custom ? "1" : "0";
    document.querySelectorAll("[data-layout]").forEach((el) => {
      const key = el.dataset.layout;
      const boss = isBossHud(el);
      if (boss && !editing) {
        clearPlaced(el);
        return;
      }
      if (custom) {
        place(el, opt.layout[key]);
      } else {
        clearPlaced(el);
      }
    });
  }

  function readForm() {
    const prev = editing && draft ? draft : current();
    const coopEl = document.getElementById("opt-coop");
    return Save.setOptions({
      volume: Number(document.getElementById("opt-volume").value),
      music: document.getElementById("opt-music").checked,
      vibrate: document.getElementById("opt-vibrate").checked,
      stickSize: document.getElementById("opt-stick-size").value,
      touchMode: document.getElementById("opt-touch-mode").value,
      showCoop: coopEl ? coopEl.checked : prev.showCoop,
      layout: prev.layout,
    });
  }

  function fillForm() {
    const opt = current();
    document.getElementById("opt-volume").value = String(opt.volume);
    document.getElementById("opt-volume-num").textContent = String(opt.volume);
    document.getElementById("opt-music").checked = opt.music;
    document.getElementById("opt-vibrate").checked = opt.vibrate;
    document.getElementById("opt-stick-size").value = opt.stickSize;
    document.getElementById("opt-touch-mode").value = opt.touchMode || "fixed";
    const coopEl = document.getElementById("opt-coop");
    if (coopEl) coopEl.checked = opt.showCoop === true;
  }

  function onChange() {
    const opt = readForm();
    if (editing) draft = opt;
    document.getElementById("opt-volume-num").textContent = String(opt.volume);
    apply(opt);
    const coopBtn = document.getElementById("btn-link");
    if (coopBtn) coopBtn.classList.toggle("hidden", opt.showCoop !== true);
    if (opt.music) AudioFx.resume();
    if (typeof Cloud !== "undefined") Cloud.sync();
  }

  function bindDrag(el) {
    el.addEventListener("pointerdown", (event) => {
      if (!editing) return;
      event.preventDefault();
      event.stopPropagation();
      const box = stageBox();
      const rect = el.getBoundingClientRect();
      el.dataset.grabX = String(event.clientX - rect.left);
      el.dataset.grabY = String(event.clientY - rect.top);
      try {
        el.setPointerCapture(event.pointerId);
      } catch (err) {}
    });
    el.addEventListener("pointermove", (event) => {
      if (!editing || !el.hasPointerCapture(event.pointerId) || !draft) return;
      event.preventDefault();
      const box = stageBox();
      const rect = el.getBoundingClientRect();
      const grabX = Number(el.dataset.grabX) || 0;
      const grabY = Number(el.dataset.grabY) || 0;
      const maxX = Math.max(0, 100 - (rect.width / box.width) * 100);
      const maxY = Math.max(0, 100 - (rect.height / box.height) * 100);
      const x = Math.max(0, Math.min(maxX, ((event.clientX - grabX - box.left) / box.width) * 100));
      const y = Math.max(0, Math.min(maxY, ((event.clientY - grabY - box.top) / box.height) * 100));
      const spot = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
      draft.layoutCustom = true;
      draft.layout[el.dataset.layout] = spot;
      place(el, spot);
    });
    el.addEventListener("pointerup", (event) => {
      if (!editing || !draft) return;
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
      Save.setOptions(draft);
      if (typeof Cloud !== "undefined") Cloud.sync();
    });
    el.addEventListener("pointercancel", (event) => {
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    });
  }

  function ensureBar() {
    if (document.getElementById("hud-edit-bar")) return;
    const bar = document.createElement("div");
    bar.id = "hud-edit-bar";
    bar.className = "hidden";
    bar.innerHTML =
      '<p class="mobile-only">Arraste vida, onda, analógicos e pausa.</p>' +
      '<p class="desktop-only">Arraste vida, onda, score, combo, tempo e boss no HUD.</p>' +
      '<div class="btn-row">' +
      '<button type="button" id="hud-edit-reset" class="ghost">POSIÇÃO PADRÃO</button>' +
      '<button type="button" id="hud-edit-done">PRONTO</button>' +
      "</div>";
    (document.getElementById("app") || document.body).appendChild(bar);
    bar.querySelector("#hud-edit-done").addEventListener("click", finishEdit);
    bar.querySelector("#hud-edit-reset").addEventListener("click", resetLayout);
  }

  function beginEdit(onDone) {
    doneHook = onDone || null;
    draft = JSON.parse(JSON.stringify(current()));
    editing = true;
    document.body.classList.add("hud-edit");
    ensureBar();
    document.getElementById("hud-edit-bar").classList.remove("hidden");
    apply(draft);
  }

  function finishEdit() {
    if (draft) Save.setOptions(draft);
    editing = false;
    draft = null;
    document.body.classList.remove("hud-edit");
    const bar = document.getElementById("hud-edit-bar");
    if (bar) bar.classList.add("hidden");
    apply(current());
    const hook = doneHook;
    doneHook = null;
    if (hook) hook();
  }

  function resetLayout() {
    const base = Save.defaultOptions();
    const opt = editing && draft ? draft : current();
    opt.layout = base.layout;
    opt.layoutCustom = false;
    if (editing) draft = opt;
    Save.setOptions(opt);
    if (typeof Cloud !== "undefined") Cloud.sync();
    apply(opt);
  }

  function reset() {
    const opt = Save.setOptions(Save.defaultOptions());
    if (editing) draft = JSON.parse(JSON.stringify(opt));
    fillForm();
    apply(opt);
    if (typeof Cloud !== "undefined") Cloud.sync();
  }

  function bind() {
    ensureBar();
    document.querySelectorAll("[data-layout]").forEach(bindDrag);
    fillForm();
    apply(current());
    const form = document.getElementById("view-options");
    if (!form) return;
    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
  }

  function pulse(ms) {
    const opt = current();
    if (!opt.vibrate || !navigator.vibrate) return;
    navigator.vibrate(Math.max(15, Math.min(80, ms * 0.35)));
  }

  function test() {
    AudioFx.resume();
    AudioFx.power();
    if (current().vibrate && navigator.vibrate) navigator.vibrate(40);
  }

  return { apply, bind, fillForm, reset, resetLayout, beginEdit, pulse, test };
})();
