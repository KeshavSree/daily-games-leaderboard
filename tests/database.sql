\set ON_ERROR_STOP on
-- Isolated local PostgreSQL harness. Never run against a live Supabase project.
create role anon;create role authenticated;create role service_role;
create schema auth;create schema storage;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
\ir ../supabase/migrations/001_daily.sql
insert into auth.users values('00000000-0000-0000-0000-000000000001','a@example.com',now()),('00000000-0000-0000-0000-000000000002','b@example.com',now()),('00000000-0000-0000-0000-000000000003','c@example.com',now());
insert into public.invites(email) values('a@example.com');
select public.accept_invite('00000000-0000-0000-0000-000000000001','A');
do $$begin
if not (select active from profiles where email='a@example.com') then raise exception 'Invitation did not activate member';end if;
begin perform public.accept_invite('00000000-0000-0000-0000-000000000002','B');raise exception 'Unauthorized acceptance';exception when raise_exception then if sqlerrm='Unauthorized acceptance' then raise;end if;end;
if has_table_privilege('authenticated','profiles','select') then raise exception 'Private table leaked';end if;
if has_function_privilege('anon','public.settle_days()','execute') then raise exception 'Public settlement allowed';end if;
end;$$;
update profiles set active=true;
-- Repeated submissions overwrite the same row, and closed days reject writes.
do $$declare today date:=(now() at time zone 'America/Indiana/Indianapolis')::date;begin
perform submit_score('00000000-0000-0000-0000-000000000001','maptap',today,today::text,959,'share');
perform submit_score('00000000-0000-0000-0000-000000000001','maptap',today,today::text,959,'share');
if (select count(*) from submissions)<>1 then raise exception 'Duplicate submission';end if;
perform submit_score('00000000-0000-0000-0000-000000000001','maptap',today,today::text,960,'replacement');
if (select score from submissions limit 1)<>960 then raise exception 'Replacement failed';end if;
begin perform submit_score('00000000-0000-0000-0000-000000000001','maptap',today-1,(today-1)::text,1,'late');raise exception 'Late write allowed';exception when raise_exception then if sqlerrm='Late write allowed' then raise;end if;end;
perform delete_score('00000000-0000-0000-0000-000000000001','maptap',today);
end;$$;
insert into submissions(user_id,game,puzzle_date,puzzle_key,score,raw_text) values
('00000000-0000-0000-0000-000000000001','maptap','2020-01-01','2020-01-01',959,''),
('00000000-0000-0000-0000-000000000002','maptap','2020-01-01','2020-01-01',900,''),
('00000000-0000-0000-0000-000000000001','chainle','2020-01-01','1',1000,''),
('00000000-0000-0000-0000-000000000002','chainle','2020-01-01','1',2000,''),
('00000000-0000-0000-0000-000000000001','maptap','2020-01-02','2020-01-02',959,''),
('00000000-0000-0000-0000-000000000002','maptap','2020-01-02','2020-01-02',900,''),
('00000000-0000-0000-0000-000000000003','chainle','2020-01-02','2',3457,'');
do $$begin
if settle_days()<>2 then raise exception 'Expected two closed dates';end if;
if (select rating from profiles where email='a@example.com')<>1016 then raise exception 'Wrong rating or game-order dependency';end if;
if (select rating from profiles where email='b@example.com')<>984 then raise exception 'Wrong loser rating';end if;
if (select rating from profiles where email='c@example.com')<>1000 then raise exception 'Singleton was rated';end if;
if (select sum(delta) from rating_events)<>0 then raise exception 'Not zero sum';end if;
if settle_days()<>0 then raise exception 'Not idempotent';end if;
if (select count(*) from rating_events)<>7 then raise exception 'Duplicate or missing events';end if;
if exists(select 1 from rating_events where puzzle_date='2020-01-01' and rating_before<>1000) then raise exception 'Opening snapshot mismatch';end if;
if (select rating from profiles where email='a@example.com')<>1016 then raise exception 'Retry changed rating';end if;
end;$$;
select 'Database checks passed' as result;
-- Krillion uses its own puzzle/date mapping and is rated with the other games.
do $$declare today date:=(now() at time zone 'America/Indiana/Indianapolis')::date; number integer;begin
select krillion_anchor_number+(today-krillion_anchor_date) into number from settings where id=1;
perform submit_score('00000000-0000-0000-0000-000000000001','krillion',today,number::text,390,'Krillion share');
if not exists(select 1 from submissions where game='krillion' and score=390 and puzzle_key=number::text) then raise exception 'Krillion submission missing';end if;
begin perform submit_score('00000000-0000-0000-0000-000000000001','krillion',today,(number-1)::text,390,'old puzzle');raise exception 'Wrong Krillion puzzle accepted';exception when raise_exception then if sqlerrm='Wrong Krillion puzzle accepted' then raise;end if;end;
begin perform submit_score('00000000-0000-0000-0000-000000000001','krillion',today,number::text,701,'invalid');raise exception 'Invalid Krillion score accepted';exception when check_violation then null;end;
perform delete_score('00000000-0000-0000-0000-000000000001','krillion',today);
end;$$;
insert into submissions(user_id,game,puzzle_date,puzzle_key,score,raw_text) values
('00000000-0000-0000-0000-000000000001','krillion','2020-01-03','3',390,''),
('00000000-0000-0000-0000-000000000002','krillion','2020-01-03','3',300,'');
do $$begin
if settle_days()<>1 then raise exception 'Krillion day not processed';end if;
if not exists(select 1 from rating_events where game='krillion' and delta>0 and score=390) then raise exception 'Krillion winner not rated';end if;
if abs((select sum(delta) from rating_events where game='krillion'))>0.000001 then raise exception 'Krillion not zero sum';end if;
if settle_days()<>0 then raise exception 'Krillion not idempotent';end if;
end;$$;
