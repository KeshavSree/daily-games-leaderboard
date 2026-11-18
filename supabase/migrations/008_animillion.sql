begin;
alter table public.settings add column animillion_anchor_date date not null default '2026-11-18';
alter table public.settings add column animillion_anchor_number integer not null default 24;
alter table public.submissions drop constraint submissions_supported_game_check;
alter table public.submissions drop constraint submissions_score_range_check;
alter table public.submissions add constraint submissions_supported_game_check check(game in ('maptap','chainle','krillion','linkdle','animillion'));
alter table public.submissions add constraint submissions_score_range_check check(score>=0 and ((game='maptap' and score<=1000) or (game='chainle' and score<=5000) or (game in ('krillion','animillion') and score<=700) or (game='linkdle' and score>=1)));
create or replace function public.submit_score(p_user uuid,p_game text,p_date date,p_puzzle text,p_score integer,p_raw text) returns void language plpgsql security definer set search_path='' as $$
declare s public.settings; pair jsonb;
begin
  perform pg_advisory_xact_lock(734891);
  if not exists(select 1 from public.profiles where id=p_user and active) then raise exception 'Invitation required';end if;
  select * into s from public.settings where id=1;
  if p_date<>(clock_timestamp() at time zone s.timezone)::date or exists(select 1 from public.settlements where puzzle_date=p_date) then raise exception 'Day closed';end if;
  if p_game='maptap' and p_puzzle<>p_date::text then raise exception 'Wrong puzzle';end if;
  if p_game='chainle' and p_puzzle<>(s.chainle_anchor_number+(p_date-s.chainle_anchor_date))::text then raise exception 'Wrong puzzle';end if;
  if p_game='krillion' and p_puzzle<>(s.krillion_anchor_number+(p_date-s.krillion_anchor_date))::text then raise exception 'Wrong puzzle';end if;
  if p_game='animillion' and p_puzzle<>(s.animillion_anchor_number+(p_date-s.animillion_anchor_date))::text then raise exception 'Wrong puzzle';end if;
  if p_game='linkdle' then
    pair:=p_puzzle::jsonb;
    if jsonb_typeof(pair)<>'array' or jsonb_array_length(pair)<>3 or pair->>0<>p_date::text
      or jsonb_typeof(pair->1)<>'string' or jsonb_typeof(pair->2)<>'string'
      or length(pair->>1) not between 1 and 100 or length(pair->>2) not between 1 and 100
      then raise exception 'Invalid Linkdle words';end if;
  end if;
  insert into public.submissions(user_id,game,puzzle_date,puzzle_key,score,raw_text) values(p_user,p_game,p_date,p_puzzle,p_score,p_raw)
  on conflict(user_id,game,puzzle_date) do nothing;
  if not found then raise exception 'Already submitted. Scores cannot be changed.';end if;
end;$$;
commit;
