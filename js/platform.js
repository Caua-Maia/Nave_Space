const Platform = (() => {
  function detect() {
    const ua = navigator.userAgent || "";
    const iPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || iPad) {
      const fine = window.matchMedia("(any-pointer: fine)").matches;
      const hover = window.matchMedia("(any-hover: hover)").matches;
      if (fine || hover) return "desktop";
    }
    if (window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(hover: none)").matches) {
      return "mobile";
    }
    return "desktop";
  }

  let mode = detect();

  function sync() {
    mode = detect();
    document.documentElement.dataset.platform = mode;
    if (document.body) {
      document.body.dataset.platform = mode;
      document.body.classList.toggle("handheld", mode === "mobile");
      document.body.classList.toggle("desktop-ui", mode === "desktop");
    }
    return mode;
  }

  if (document.documentElement.dataset.platform === "mobile" || document.documentElement.dataset.platform === "desktop") {
    mode = document.documentElement.dataset.platform;
  } else {
    sync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sync);
  } else if (document.body) {
    sync();
  }

  window.addEventListener("orientationchange", () => {
    setTimeout(sync, 120);
  });

  return {
    sync,
    detect,
    mode: () => mode,
    isMobile: () => mode === "mobile",
    isDesktop: () => mode === "desktop",
  };
})();
