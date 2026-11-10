-- FASE 1: token de integridade (score + tempo + salt) + RLS reforçada
-- O salt abaixo deve ser o MESMO que em js/integrity.js (SALT).
-- Inclui pilot_id se o projeto ainda não tiver (pilots.id, scores.pilot_id).

alter table public.pilots
  add column if not exists id uuid;

create unique index if not exists pilots_id_unique on public.pilots (id);

alter table public.scores
  add column if not exists pilot_id uuid;

create extension if not exists pgcrypto;

-- Salt só no servidor (anon não lê esta tabela)
create schema if not exists private;

create table if not exists private.score_integrity (
  id int primary key default 1 check (id = 1),
  salt text not null
);

revoke all on schema private from public, anon, authenticated;
revoke all on private.score_integrity from public, anon, authenticated;

insert into private.score_integrity (id, salt)
values (1, 'NaveSpace-score-v1-8f3c2a1e9b4d7c6f')
on conflict (id) do update set salt = excluded.salt;

alter table public.scores
  add column if not exists play_seconds integer not null default 0;

alter table public.scores
  add column if not exists integrity_token text;

-- Índice leve para dedupe/consultas (opcional)
create index if not exists scores_pilot_created_idx on public.scores (pilot_id, created_at desc);

create or replace function private.get_score_salt()
returns text
language sql
security definer
set search_path = private, public
stable
as $$
  select salt from private.score_integrity where id = 1;
$$;

revoke all on function private.get_score_salt() from public, anon, authenticated;

-- Estende o guard existente (rate limit + plausibilidade + integridade)
create or replace function public.guard_score_insert()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  recent_count int;
  wave_n int;
  stage_n int;
  score_cap bigint;
  extra_l text;
  salt text;
  payload text;
  expected text;
begin
  if new.pilot_id is null then
    raise exception 'pilot_id_required' using errcode = '23514';
  end if;

  if coalesce(new.play_seconds, 0) < 0 then
    raise exception 'play_seconds_invalid' using errcode = '23514';
  end if;

  if new.integrity_token is null or length(btrim(new.integrity_token)) < 64 then
    raise exception 'integrity_invalid' using errcode = '23514';
  end if;

  salt := private.get_score_salt();
  if salt is null or btrim(salt) = '' then
    raise exception 'score_salt_missing' using errcode = '23514';
  end if;

  payload :=
    coalesce(new.mode, '') || '|'
    || coalesce(new.score, 0)::text || '|'
    || coalesce(new.play_seconds, 0)::text || '|'
    || coalesce(new.pilot_id::text, '') || '|'
    || salt;
  expected := encode(digest(payload, 'sha256'), 'hex');
  if lower(btrim(new.integrity_token)) <> expected then
    raise exception 'integrity_invalid' using errcode = '23514';
  end if;

  select count(*)::int
  into recent_count
  from public.scores s
  where s.pilot_id = new.pilot_id
    and s.created_at > now() - interval '5 minutes';

  if recent_count >= 20 then
    raise exception 'rate_limit' using errcode = '23514';
  end if;

  extra_l := lower(btrim(coalesce(new.extra, '')));

  if new.mode = 'survival' and extra_l like 'onda%' then
    wave_n := (regexp_match(extra_l, 'onda[[:space:]]*([0-9]+)'))[1]::int;
    if wave_n is not null and wave_n > 0 then
      score_cap := greatest(800000::bigint, wave_n * 12000000::bigint);
      if new.score > score_cap then
        raise exception 'score_implausible' using errcode = '23514';
      end if;
    end if;
  end if;

  if new.mode = 'story' then
    if extra_l like 'fase%' then
      stage_n := (regexp_match(extra_l, 'fase[[:space:]]*([0-9]+)'))[1]::int;
      if stage_n is not null and stage_n > 0 then
        score_cap := greatest(2000000::bigint, stage_n * 15000000::bigint);
        if new.score > score_cap then
          raise exception 'score_implausible' using errcode = '23514';
        end if;
      end if;
    elsif extra_l = 'campanha' and new.score > 400000000 then
      raise exception 'score_implausible' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_score_insert() from public, anon, authenticated;

drop trigger if exists scores_guard_insert on public.scores;
create trigger scores_guard_insert
  before insert on public.scores
  for each row
  execute function public.guard_score_insert();

-- RLS (reforço explícito)
alter table public.scores enable row level security;

drop policy if exists "public read scores" on public.scores;
drop policy if exists "public insert scores" on public.scores;
drop policy if exists "public read pilots" on public.pilots;
drop policy if exists "public insert pilots" on public.pilots;
drop policy if exists "public update pilots" on public.pilots;

drop policy if exists "scores_anon_insert" on public.scores;
create policy "scores_anon_insert" on public.scores
  for insert to anon
  with check (
    pilot_id is not null
    and score >= 0
    and score <= 500000000
    and play_seconds >= 0
    and integrity_token is not null
    and length(btrim(integrity_token)) >= 64
  );

drop policy if exists "scores_anon_select" on public.scores;
create policy "scores_anon_select" on public.scores
  for select to anon using (true);

-- Sem políticas UPDATE/DELETE para anon = negado pelo RLS
revoke update, delete on public.scores from anon;

-- Leitura global; escrita só com id
alter table public.pilots enable row level security;

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

revoke delete on public.scores from anon;
revoke delete on public.pilots from anon;
