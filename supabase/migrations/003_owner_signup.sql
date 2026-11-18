begin;
create table public.owner_signup (
  id integer primary key default 1 check(id=1),
  email text not null unique check(email=lower(email)),
  reserved_by uuid,
  claimed_at timestamptz
);
insert into public.owner_signup(id,email,claimed_at)
values(1,'keshav.sreekantham@gmail.com',case when exists(select 1 from public.profiles where role='owner' and active) then now() else null end);
alter table public.owner_signup enable row level security;
revoke all on public.owner_signup from anon,authenticated;
grant all on public.owner_signup to service_role;

-- Reserve before touching Supabase Auth, so two requests cannot set different passwords.
-- No automatic lease expiry: a stalled request must not overlap another claimant.
create function public.begin_owner_signup(p_email text,p_token uuid) returns void
language plpgsql security definer set search_path='' as $$
declare config public.owner_signup;
begin
  select * into config from public.owner_signup where id=1 for update;
  if config.email is distinct from lower(trim(p_email)) or config.claimed_at is not null or config.reserved_by is not null
    or exists(select 1 from public.profiles where role='owner' and active) then
    raise exception 'Account creation is unavailable';
  end if;
  if p_token is null then raise exception 'Invalid reservation';end if;
  update public.owner_signup set reserved_by=p_token where id=1;
end;$$;

create function public.finish_owner_signup(p_token uuid,p_user uuid,p_name text) returns void
language plpgsql security definer set search_path='' as $$
declare config public.owner_signup;
begin
  select * into config from public.owner_signup where id=1 for update;
  if config.reserved_by is null or config.reserved_by is distinct from p_token or config.claimed_at is not null then
    raise exception 'Invalid reservation';
  end if;
  if not exists(select 1 from auth.users where id=p_user and lower(email)=config.email and email_confirmed_at is not null)
    or not exists(select 1 from public.profiles where id=p_user and email=config.email)
    or exists(select 1 from public.profiles where role='owner' and active and id<>p_user) then
    raise exception 'Account identity does not match';
  end if;
  update public.profiles set role='owner',active=true,display_name=p_name where id=p_user;
  update public.invites set accepted_at=now() where email=config.email;
  update public.owner_signup set claimed_at=now(),reserved_by=null where id=1;
end;$$;

create function public.cancel_owner_signup(p_token uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.owner_signup set reserved_by=null where id=1 and reserved_by=p_token and claimed_at is null;
end;$$;
revoke all on function public.begin_owner_signup(text,uuid),public.finish_owner_signup(uuid,uuid,text),public.cancel_owner_signup(uuid) from public,anon,authenticated;
grant execute on function public.begin_owner_signup(text,uuid),public.finish_owner_signup(uuid,uuid,text),public.cancel_owner_signup(uuid) to service_role;
commit;
