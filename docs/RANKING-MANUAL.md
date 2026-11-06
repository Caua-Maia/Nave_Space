# Inserir pontuação manualmente no ranking (local)

O ranking **local** fica em `localStorage`, chave `space-survivor-save-v2`, nos arrays `survivalBoard` e `storyBoard`.

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

`Cloud.pushScore` envia para o Supabase; não dá para reproduzir só com `localStorage`. Use o painel do Supabase (tabela `scores`) ou uma versão do jogo com o mesmo código de `Cloud.pushScore`, se tiver acesso ao backend.
