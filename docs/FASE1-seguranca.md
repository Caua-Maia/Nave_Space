# FASE 1 — Blindagem e ranking (Nave_Space)

## O que mudou no cliente

1. **`js/integrity.js`** — Gera `integrity_token` = SHA-256 hex de  
   `mode|score|play_seconds|pilot_id|salt` (salt alinhado ao SQL).
2. **`js/cloud.js`** — Envia `play_seconds` e `integrity_token` no POST em `scores`.
3. **`js/game.js`** — Estado da partida permanece no closure do módulo; só `window.SpaceSurvivor.start()` inicia o jogo (não há mais `Game` global).
4. **`js/main.js`** — Chama `SpaceSurvivor.start()`.

## Deploy Supabase

1. Rode `docs/supabase-score-integrity-fase1.sql` no SQL Editor.
2. Confirme que o salt em `private.score_integrity` é **igual** ao de `js/integrity.js`.
3. Para rotacionar o salt: atualize a linha em `private.score_integrity` e publique nova versão do jogo no mesmo deploy.

## Limitações (honestas)

- O salt no JS ainda é visível no bundle; quem inspecionar o código pode forjar tokens **se** souber o algoritmo e o salt. O trigger no Postgres impede inserts “soltos” pelo REST sem hash válido.
- Proteção forte adicional: Edge Function com secret só no servidor, ou salt **apenas** no Postgres (cliente pede nonce assinado — fora do escopo desta fase).

## Teste rápido

1. `python -m http.server 8765` na raiz do projeto.
2. Partida curta → Game Over → salvar no ranking com nome definido.
3. No Supabase → Table Editor → `scores`: nova linha com `play_seconds` e `integrity_token`.
4. No console: `fetch(... scores ... body sem integrity_token)` deve falhar com 400/422.
