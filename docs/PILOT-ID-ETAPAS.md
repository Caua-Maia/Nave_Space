# ID de conta (`pilotId`) — etapas

## Etapa 1 ✅ (cliente local)

- Campo `pilotId` (UUID) em `space-survivor-save-v2`.
- Migração automática na primeira carga se o save antigo não tiver `pilotId`.
- Entradas novas do ranking local guardam `pilotId` em cada linha.
- Menu principal mostra **conta #XXXX** (últimos 4 do UUID).

## Etapa 2 ✅ (Supabase + cliente)

**Antes de testar online:** rodar `docs/supabase-pilot-id.sql` no SQL Editor do Supabase.

1. `pilots`: upsert por `id` (`on_conflict=id`).
2. `scores`: campo `pilot_id` no POST.
3. `cloud.js`: `pull` por `id=eq.<pilotId>`.
4. Top 10 (local e nuvem): dedup por `pilot_id`; legado sem id continua por nome.
5. Ranking exibe `Nome #XXXX` quando há `pilotId`.

## Etapa 3 ✅ — RLS e feedback de save na nuvem

**SQL:** `docs/supabase-pilot-id-rls-step3.sql` (rodar após a etapa 2).

- Game over / vitória: mensagens **local**, **global** ou **nuvem indisponível**.
- Estados: "Salvando no ranking…" enquanto `pushScore` responde.

## Etapa 4 ✅ — Anti-abuso leve

**SQL:** `docs/supabase-pilot-id-guard-step4.sql`

- Cliente: `validateScorePush` antes do POST (onda/fase/campanha × score).
- Servidor: trigger `guard_score_insert` — até **20 envios / 5 min** por `pilot_id`; mesmos tetos de score.
- Ranking **local** sempre grava; nuvem pode recusar com mensagem específica na UI.

Limites (sobrevivência): `score ≤ max(800k, onda × 12M)` — cobre runs longas documentadas (~148M na onda 56).

---

## Checklist deploy (GitHub Pages + Supabase)

1. Publicar JS/CSS/HTML no Pages (workflow ou push na branch publicada).
2. Supabase SQL, nesta ordem: `supabase-pilot-id.sql` → `supabase-pilot-id-rls-step3.sql` → `supabase-pilot-id-guard-step4.sql`.
3. Ctrl+F5 no site publicado; conferir menu **conta #XXXX** e salvar uma run de teste.
4. Abrir **RANKING** e validar entrada global.

Implementação cliente concluída (etapas 1–4).
