const Story = {
  stages: [
    {
      id: 1,
      title: "Campo de Meteoros",
      briefing: "Aproximação inicial. Resista ao cinturão e destrua o fragmento-alfa.",
      type: "survive_boss",
      duration: 40,
      boss: "mini_rock",
    },
    {
      id: 2,
      title: "Caçada de Pontos",
      briefing: "Prove o sistema de armas. Alcance a cota de abates.",
      type: "score",
      target: 2200,
    },
    {
      id: 3,
      title: "Caçador",
      briefing: "Um interceptador pesado bloqueia a rota. Derrube o semi-boss.",
      type: "boss",
      boss: "mini_hunter",
    },
    {
      id: 4,
      title: "Poeira de Guerra",
      briefing: "Sobreviva ao bombardeio. No fim, a sentinela menor aparece.",
      type: "survive_boss",
      duration: 50,
      boss: "mini_hunter",
    },
    {
      id: 5,
      title: "Cota de Guerra",
      briefing: "Mais inimigos, mesma missão: pontue o suficiente para avançar.",
      type: "score",
      target: 5200,
    },
    {
      id: 6,
      title: "Cruzador",
      briefing: "O cruzador de bloqueio chegou. Derrote o boss da rota.",
      type: "boss",
      boss: "cruiser",
    },
    {
      id: 7,
      title: "Último Salto",
      briefing: "Aguente a tempestade final e quebre o semi-boss de escolta.",
      type: "survive_boss",
      duration: 45,
      boss: "mini_rock",
    },
    {
      id: 8,
      title: "Núcleo",
      briefing: "O núcleo da frota. Derrube os geradores, rompa o escudo e destrua o núcleo.",
      type: "boss",
      boss: "mega",
    },
  ],

  get(id) {
    return this.stages.find((s) => s.id === id) || this.stages[0];
  },

  objectiveText(stage, ctx) {
    if (stage.type === "score") {
      const have = Math.min(ctx.score, stage.target);
      return `PONTOS ${have.toLocaleString("pt-BR")} / ${stage.target.toLocaleString("pt-BR")}`;
    }
    if (stage.type === "survive_boss") {
      if (ctx.bossPhase) return "DERROTE O SEMI-BOSS";
      const left = Math.max(0, Math.ceil(stage.duration - ctx.elapsed));
      return `SOBREVIVA ${left}s  ·  depois, semi-boss`;
    }
    if (ctx.bossAlive) return `DERROTE: ${ctx.bossName || "BOSS"}`;
    return "ELIMINE O BOSS";
  },
};
