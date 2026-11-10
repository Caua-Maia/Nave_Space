-- Etapa 4: rate limit + plausibilidade (servidor)
-- Rodar após etapas 2 e 3. Limites espelham js/cloud.js (validateScorePush).

alter table public.scores
  add column if not exists created_at timestamptz not null default now();

create or replace function public.guard_score_insert()
returns trigger
language plpgsql
as $$
declare
  recent_count int;
  wave_n int;
  stage_n int;
  score_cap bigint;
  extra_l text;
begin
  if new.pilot_id is null then
    raise exception 'pilot_id_required' using errcode = '23514';
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

drop trigger if exists scores_guard_insert on public.scores;
create trigger scores_guard_insert
  before insert on public.scores
  for each row
  execute function public.guard_score_insert();
