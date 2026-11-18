begin;
alter table public.settings add column krillion_anchor_date date not null default '2026-11-18';
alter table public.settings add column krillion_anchor_number integer not null default 126;
-- Replace game-dependent checks without relying on PostgreSQL's generated names.
do $$declare constraint_name text;begin
  for constraint_name in select conname from pg_constraint where conrelid='public.submissions'::regclass and contype='c' and pg_get_constraintdef(oid) like '%game%'
  loop execute format('alter table public.submissions drop constraint %I',constraint_name);end loop;
end;$$;
alter table public.submissions add constraint submissions_supported_game_check check(game in ('maptap','chainle','krillion'));
alter table public.submissions add constraint submissions_score_range_check check(score>=0 and ((game='maptap' and score<=1000) or (game='chainle' and score<=5000) or (game='krillion' and score<=700)));
create or replace function public.submit_score(p_user uuid,p_game text,p_date date,p_puzzle text,p_score integer,p_raw text) returns void language plpgsql security definer set search_path='' as $$
declare s public.settings;
begin
  perform pg_advisory_xact_lock(734891);
  if not exists(select 1 from public.profiles where id=p_user and active) then raise exception 'Invitation required';end if;
  select * into s from public.settings where id=1;
  if p_date<>(clock_timestamp() at time zone s.timezone)::date or exists(select 1 from public.settlements where puzzle_date=p_date) then raise exception 'Day closed';end if;
  if p_game='maptap' and p_puzzle<>p_date::text then raise exception 'Wrong puzzle';end if;
  if p_game='chainle' and p_puzzle<>(s.chainle_anchor_number+(p_date-s.chainle_anchor_date))::text then raise exception 'Wrong puzzle';end if;
  if p_game='krillion' and p_puzzle<>(s.krillion_anchor_number+(p_date-s.krillion_anchor_date))::text then raise exception 'Wrong puzzle';end if;
  insert into public.submissions(user_id,game,puzzle_date,puzzle_key,score,raw_text) values(p_user,p_game,p_date,p_puzzle,p_score,p_raw)
  on conflict(user_id,game,puzzle_date) do update set score=excluded.score,raw_text=excluded.raw_text,updated_at=now()
  where public.submissions.score is distinct from excluded.score or public.submissions.raw_text is distinct from excluded.raw_text;
end;$$;
commit;
