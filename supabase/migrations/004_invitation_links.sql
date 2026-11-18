begin;
create table public.member_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check(length(token_hash)=64),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '7 days',
  reserved_by uuid,
  used_by uuid unique references public.profiles(id),
  used_at timestamptz,
  revoked_at timestamptz
);
alter table public.member_invites enable row level security;
revoke all on public.member_invites from anon,authenticated;
grant all on public.member_invites to service_role;

create function public.reserve_member_invite(p_hash text,p_reservation uuid) returns void
language plpgsql security definer set search_path='' as $$
declare invitation public.member_invites;
begin
  select * into invitation from public.member_invites where token_hash=p_hash for update;
  if invitation.id is null or invitation.used_at is not null or invitation.revoked_at is not null
    or invitation.expires_at<=clock_timestamp() or invitation.reserved_by is not null or p_reservation is null then
    raise exception 'Invite unavailable';
  end if;
  update public.member_invites set reserved_by=p_reservation where id=invitation.id;
end;$$;

create function public.complete_member_invite(p_hash text,p_reservation uuid,p_user uuid,p_name text) returns void
language plpgsql security definer set search_path='' as $$
declare invitation public.member_invites;
begin
  select * into invitation from public.member_invites where token_hash=p_hash for update;
  if invitation.id is null or invitation.reserved_by is null or invitation.reserved_by is distinct from p_reservation
    or invitation.used_at is not null or invitation.revoked_at is not null or invitation.expires_at<=clock_timestamp() then
    raise exception 'Invite unavailable';
  end if;
  if not exists(select 1 from public.profiles where id=p_user and role='member' and not active)
    or not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null) then
    raise exception 'Account cannot use this invite';
  end if;
  update public.profiles set active=true,display_name=p_name where id=p_user;
  update public.member_invites set used_by=p_user,used_at=now(),reserved_by=null where id=invitation.id;
end;$$;

create function public.release_member_invite(p_hash text,p_reservation uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.member_invites set reserved_by=null where token_hash=p_hash and reserved_by=p_reservation and used_at is null;
end;$$;
revoke all on function public.reserve_member_invite(text,uuid),public.complete_member_invite(text,uuid,uuid,text),public.release_member_invite(text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_member_invite(text,uuid),public.complete_member_invite(text,uuid,uuid,text),public.release_member_invite(text,uuid) to service_role;
commit;
