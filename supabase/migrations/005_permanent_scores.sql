begin;
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
  on conflict(user_id,game,puzzle_date) do nothing;
  if not found then raise exception 'Already submitted. Scores cannot be changed.';end if;
end;$$;
create or replace function public.delete_score(p_user uuid,p_game text,p_date date) returns void language plpgsql security definer set search_path='' as $$
begin
  raise exception 'Submitted scores cannot be deleted.';
end;$$;
revoke update,delete on public.submissions from service_role;
commit;
