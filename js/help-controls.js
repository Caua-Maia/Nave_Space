const HelpControls = (() => {
  function hasGamepad() {
    if (!navigator.getGamepads) return false;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (pad && pad.connected) return true;
    }
    return false;
  }

  function isMobileUA() {
    const ua = navigator.userAgent || "";
    const iPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || iPad;
  }

  function profile() {
    if (typeof Platform !== "undefined" && Platform.isMobile()) return "mobile";
    if (isMobileUA()) {
      const fine = window.matchMedia("(any-pointer: fine)").matches;
      const hover = window.matchMedia("(any-hover: hover)").matches;
      if (!fine && !hover) return "mobile";
    }
    if (hasGamepad()) return "gamepad";
    return "keyboard";
  }

  function apply(panel) {
    const root = panel || document.getElementById("view-help");
    if (!root) return profile();
    const p = profile();
    root.dataset.helpProfile = p;
    root.querySelectorAll("[data-help]").forEach((el) => {
      const kinds = String(el.dataset.help || "")
        .split(/\s+/)
        .filter(Boolean);
      const show = kinds.indexOf(p) >= 0;
      el.classList.toggle("hidden", !show);
    });
    const subtitle = root.querySelector(".help-subtitle-dynamic");
    if (subtitle) {
      const texts = {
        mobile: "Instruções para este aparelho (toque).",
        gamepad: "Controle detectado — analógicos e gatilhos.",
        keyboard: "Teclado e mouse neste aparelho.",
      };
      subtitle.textContent = texts[p] || "";
    }
    return p;
  }

  return { apply, profile };
})();
