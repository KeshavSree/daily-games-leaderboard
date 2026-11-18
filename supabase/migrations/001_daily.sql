begin;
create table public.settings (
  id integer primary key default 1 check(id=1),
  timezone text not null default 'America/Indiana/Indianapolis',
  chainle_anchor_date date not null default '2026-11-18',
  chainle_anchor_number integer not null default 91
);
insert into public.settings(id) values(1);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null check(length(display_name) between 1 and 30),
  avatar_path text,
  role text not null default 'member' check(role in ('member','owner')),
  active boolean not null default false,
  rating double precision not null default 1000,
  created_at timestamptz not null default now()
);
create table public.invites (
  id uuid primary key default gen_random_uuid(), email text not null unique check(email=lower(email)),
  created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days',
  accepted_at timestamptz
);
create table public.submissions (
  user_id uuid not null references public.profiles(id),
  game text not null check(game in ('maptap','chainle')),
  puzzle_date date not null, puzzle_key text not null,
  score integer not null check(score>=0 and ((game='maptap' and score<=1000) or (game='chainle' and score<=5000))),
  raw_text text not null check(length(raw_text)<=4000), updated_at timestamptz not null default now(),
  primary key(user_id,game,puzzle_date), unique(user_id,game,puzzle_key)
);
create index submissions_date on public.submissions(puzzle_date);
create table public.settlements(puzzle_date date primary key, settled_at timestamptz not null default now(), algorithm text not null default 'pairwise-32-v1');
create table public.rating_events (
  user_id uuid not null references public.profiles(id),game text not null,puzzle_date date not null references public.settlements(puzzle_date),
  score integer not null, delta double precision not null,rating_before double precision not null,rating_after double precision not null,
  primary key(user_id,game,puzzle_date)
);
create index rating_events_user_date on public.rating_events(user_id,puzzle_date desc);

-- All table access and mutation is server-only. Browser keys cannot query private data.
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.submissions enable row level security;
alter table public.settlements enable row level security;
alter table public.rating_events enable row level security;
revoke all on public.settings,public.profiles,public.invites,public.submissions,public.settlements,public.rating_events from anon,authenticated;
grant all on public.settings,public.profiles,public.invites,public.submissions,public.settlements,public.rating_events to service_role;

create function public.new_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,email,display_name) values(new.id,lower(new.email),left(split_part(new.email,'@',1),30));
  return new;
end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_profile();

create function public.accept_invite(p_user uuid,p_name text) returns void language plpgsql security definer set search_path='' as $$
declare v_email text;v_id uuid;
begin
  select lower(email) into v_email from auth.users where id=p_user and email_confirmed_at is not null;
  if v_email is null then raise exception 'Email verification required';end if;
  select id into v_id from public.invites where email=v_email and accepted_at is null and expires_at>now() for update;
  if v_id is null then raise exception 'Invitation expired or revoked';end if;
  update public.profiles set active=true,display_name=p_name where id=p_user;
  update public.invites set accepted_at=now() where id=v_id;
end;$$;

create function public.submit_score(p_user uuid,p_game text,p_date date,p_puzzle text,p_score integer,p_raw text) returns void language plpgsql security definer set search_path='' as $$
declare s public.settings;
begin
  perform pg_advisory_xact_lock(734891);
  if not exists(select 1 from public.profiles where id=p_user and active) then raise exception 'Invitation required';end if;
  select * into s from public.settings where id=1;
  if p_date<>(clock_timestamp() at time zone s.timezone)::date or exists(select 1 from public.settlements where puzzle_date=p_date) then raise exception 'Day closed';end if;
  if p_game='maptap' and p_puzzle<>p_date::text then raise exception 'Wrong puzzle';end if;
  if p_game='chainle' and p_puzzle<>(s.chainle_anchor_number+(p_date-s.chainle_anchor_date))::text then raise exception 'Wrong puzzle';end if;
  insert into public.submissions(user_id,game,puzzle_date,puzzle_key,score,raw_text) values(p_user,p_game,p_date,p_puzzle,p_score,p_raw)
  on conflict(user_id,game,puzzle_date) do update set score=excluded.score,raw_text=excluded.raw_text,updated_at=now()
  where public.submissions.score is distinct from excluded.score or public.submissions.raw_text is distinct from excluded.raw_text;
end;$$;
create function public.delete_score(p_user uuid,p_game text,p_date date) returns void language plpgsql security definer set search_path='' as $$
declare tz text;
begin
  perform pg_advisory_xact_lock(734891);
  if not exists(select 1 from public.profiles where id=p_user and active) then raise exception 'Invitation required';end if;
  select timezone into tz from public.settings where id=1;
  if p_date<>(clock_timestamp() at time zone tz)::date or exists(select 1 from public.settlements where puzzle_date=p_date) then raise exception 'Day closed';end if;
  delete from public.submissions where user_id=p_user and game=p_game and puzzle_date=p_date;
end;$$;

create function public.settle_days() returns integer language plpgsql security definer set search_path='' as $$
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
        (case when a.score>b.score then 1.0 when a.score=b.score then 0.5 else 0.0 end)
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
revoke all on function public.new_profile(),public.accept_invite(uuid,text),public.submit_score(uuid,text,date,text,integer,text),public.delete_score(uuid,text,date),public.settle_days() from public,anon,authenticated;
grant execute on function public.accept_invite(uuid,text),public.submit_score(uuid,text,date,text,integer,text),public.delete_score(uuid,text,date),public.settle_days() to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',false,2097152,array['image/png','image/jpeg','image/webp']);
commit;
