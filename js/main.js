window.addEventListener("load", () => {
  try {
    if (window.SpaceSurvivor && typeof window.SpaceSurvivor.start === "function") {
      window.SpaceSurvivor.start();
      return;
    }
    if (typeof Game !== "undefined" && typeof Game.init === "function") {
      Game.init();
      return;
    }
    throw new Error("Boot do jogo indisponível (scripts incompletos ou cache antigo)");
  } catch (err) {
    console.error(err);
    const detail = err && err.message ? String(err.message).slice(0, 120) : "erro desconhecido";
    alert(
      "Não foi possível iniciar o jogo (" +
        detail +
        "). Use Ctrl+F5 para recarregar sem cache. Se persistir, limpe os dados do site no navegador."
    );
  }
});
