-- Etapa 2: pilotId (UUID) como identidade da conta
-- Rodar no Supabase → SQL Editor (projeto space-survivor).
-- Ajuste nomes de constraints se o painel mostrar erro (cada projeto pode diferir).

-- 1) Colunas novas
alter table public.pilots
  add column if not exists id uuid;

alter table public.scores
  add column if not exists pilot_id uuid;

-- 2) Índice único para upsert por id (PostgREST: on_conflict=id)
create unique index if not exists pilots_id_unique on public.pilots (id);

-- 3) Nome deixa de ser chave única (vários pilotos podem ter o mesmo display name)
-- Se falhar, veja em Database → pilots → Constraints qual é o nome exato.
alter table public.pilots drop constraint if exists pilots_name_key;
alter table public.pilots drop constraint if exists pilots_pkey;
-- Se a PK antiga era só "name", recrie PK em id (opcional; upsert funciona só com UNIQUE em id):
-- alter table public.pilots add primary key (id);

-- 4) RLS básico (anon) — revise no painel se já existir policy duplicada
alter table public.pilots enable row level security;
alter table public.scores enable row level security;

drop policy if exists "pilots_anon_upsert" on public.pilots;
create policy "pilots_anon_upsert" on public.pilots
  for all to anon
  using (true)
  with check (id is not null);

drop policy if exists "scores_anon_insert_select" on public.scores;
create policy "scores_anon_insert_select" on public.scores
  for all to anon
  using (true)
  with check (true);

-- Linhas antigas em pilots (sem id) e scores (sem pilot_id) continuam válidas;
-- o jogo deduplica legado por nome até novos envios trazerem pilot_id.
