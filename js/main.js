window.addEventListener("load", () => {
  try {
    Game.init();
  } catch (err) {
    console.error(err);
    alert(
      "Não foi possível iniciar o jogo. Use Ctrl+F5 para recarregar sem cache. Se persistir, limpe os dados do site no navegador."
    );
  }
});
