begin;
alter table public.submissions drop constraint submissions_supported_game_check;
alter table public.submissions drop constraint submissions_score_range_check;
alter table public.submissions add constraint submissions_supported_game_check check(game in ('maptap','chainle','krillion','linkdle','animillion','farflung','travle'));
alter table public.submissions add constraint submissions_score_range_check check(score>=0 and ((game='maptap' and score<=1000) or (game='chainle' and score<=5000) or (game in ('krillion','animillion') and score<=700) or (game='linkdle' and score>=1) or game in ('farflung','travle')));
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
  if p_game='farflung' and p_puzzle<>(s.farflung_anchor_number+(p_date-s.farflung_anchor_date))::text then raise exception 'Wrong puzzle';end if;
  if p_game in ('linkdle','travle') then
    pair:=p_puzzle::jsonb;
    if jsonb_typeof(pair)<>'array' or jsonb_array_length(pair)<>3 or pair->>0<>p_date::text
      or jsonb_typeof(pair->1)<>'string' or jsonb_typeof(pair->2)<>'string'
      or length(pair->>1) not between 1 and 100 or length(pair->>2) not between 1 and 100
      then raise exception 'Invalid puzzle endpoints';end if;
  end if;
  insert into public.submissions(user_id,game,puzzle_date,puzzle_key,score,raw_text) values(p_user,p_game,p_date,p_puzzle,p_score,p_raw)
  on conflict(user_id,game,puzzle_date) do nothing;
  if not found then raise exception 'Already submitted. Scores cannot be changed.';end if;
end;$$;
create or replace function public.settle_days() returns integer language plpgsql security definer set search_path='' as $$
declare d date;tz text;total integer:=0;
begin
  perform pg_advisory_xact_lock(734891);
  select timezone into tz from public.settings where id=1;
  for d in select distinct s.puzzle_date from public.submissions s where s.puzzle_date<(clock_timestamp() at time zone tz)::date
    and not exists(select 1 from public.settlements x where x.puzzle_date=s.puzzle_date) order by s.puzzle_date
  loop
    insert into public.settlements(puzzle_date) values(d);
    -- Compute every game using the same opening ratings. No updates until all deltas exist.
    insert into public.rating_events(user_id,game,puzzle_date,score,delta,rating_before,rating_after)
    select a.user_id,a.game,d,a.score,
      case when count(b.user_id)=0 then 0 else 32.0/count(b.user_id)*sum(
        (case when (a.game in ('linkdle','travle') and a.score<b.score) or (a.game not in ('linkdle','travle') and a.score>b.score) then 1.0 when a.score=b.score then 0.5 else 0.0 end)
        -1.0/(1.0+power(10.0::double precision,(pb.rating-pa.rating)/400.0))) end,
      pa.rating,pa.rating
    from public.submissions a join public.profiles pa on pa.id=a.user_id
    left join public.submissions b on b.puzzle_date=a.puzzle_date and b.game=a.game and b.puzzle_key=a.puzzle_key and b.user_id<>a.user_id
    left join public.profiles pb on pb.id=b.user_id
    where a.puzzle_date=d group by a.user_id,a.game,a.score,pa.rating;
    update public.profiles p set rating=p.rating+t.delta from (select user_id,sum(delta) delta from public.rating_events where puzzle_date=d group by user_id)t where p.id=t.user_id;
    update public.rating_events e set rating_after=p.rating from public.profiles p where e.puzzle_date=d and e.user_id=p.id;
    total:=total+1;
  end loop;
  return total;
end;$$;
commit;
