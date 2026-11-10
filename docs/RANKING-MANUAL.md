# Inserir pontuação manualmente no ranking (local)

O ranking **local** fica em `localStorage`, chave `space-survivor-save-v2`, nos arrays `survivalBoard` e `storyBoard`.

Cada save tem `pilotId` (UUID). No top 10 o jogo deduplica por **conta**, não só por nome. Use o mesmo `pilotId` do save na entrada manual para não colidir com outro piloto de mesmo nome.

## Sobrevivência (ex.: nome + 148373020, onda 56)

Abra o jogo no **mesmo domínio** onde a jogadora joga (ex.: GitHub Pages), pressione **F12** → **Console** e cole (ajuste nome, score, onda e `shipId` se precisar):

```javascript
(function () {
  const KEY = "space-survivor-save-v2";
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    alert("Sem save v2 neste site.");
    return;
  }
  const data = JSON.parse(raw);
  const entry = {
    pilotId: data.pilotId,
    name: "chorapenga".trim().slice(0, 16),
    score: 148373020,
    extra: "onda 56",
    shipId: "lanca",
    date: Date.now(),
  };
  data.survivalBoard = Array.isArray(data.survivalBoard) ? data.survivalBoard : [];
  data.survivalBoard.push(entry);
  data.survivalBoard.sort((a, b) => b.score - a.score);
  data.survivalBoard = data.survivalBoard.slice(0, 10);
  localStorage.setItem(KEY, JSON.stringify(data));
  alert("Sobrevivência atualizada. Recarregue a página e abra o RANKING.");
})();
```

Depois **recarregue** a página (ideal **Ctrl+F5**).

## Ranking global (nuvem)

`Cloud.pushScore` envia para o Supabase com `pilot_id` + nome. Limites de plausibilidade e rate limit aplicam na nuvem (ver `docs/PILOT-ID-ETAPAS.md`). Inserção manual: tabela `scores` no painel Supabase, preencher `pilot_id` se quiser associar à conta correta.
