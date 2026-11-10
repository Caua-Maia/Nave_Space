-- Etapa 3: RLS mais explícita (substitui policies amplas da etapa 2)
-- Rodar depois de supabase-pilot-id.sql

alter table public.pilots enable row level security;
alter table public.scores enable row level security;

drop policy if exists "pilots_anon_upsert" on public.pilots;
drop policy if exists "scores_anon_insert_select" on public.scores;

-- pilots: leitura global; escrita só com id (upsert do cliente)
drop policy if exists "pilots_anon_select" on public.pilots;
create policy "pilots_anon_select" on public.pilots
  for select to anon using (true);

drop policy if exists "pilots_anon_insert" on public.pilots;
create policy "pilots_anon_insert" on public.pilots
  for insert to anon with check (id is not null);

drop policy if exists "pilots_anon_update" on public.pilots;
create policy "pilots_anon_update" on public.pilots
  for update to anon
  using (true)
  with check (id is not null);

-- scores: leitura global; insert só com pilot_id e score razoável
drop policy if exists "scores_anon_select" on public.scores;
create policy "scores_anon_select" on public.scores
  for select to anon using (true);

drop policy if exists "scores_anon_insert" on public.scores;
create policy "scores_anon_insert" on public.scores
  for insert to anon
  with check (
    pilot_id is not null
    and score >= 0
    and score <= 500000000
  );

-- Anon não atualiza nem apaga scores (integridade do ranking)
