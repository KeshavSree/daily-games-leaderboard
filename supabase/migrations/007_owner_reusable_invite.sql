begin;
alter table public.member_invites add column reusable boolean not null default false;
alter table public.member_invites alter column expires_at drop not null;
alter table public.member_invites add constraint permanent_invite_is_reusable check(expires_at is not null or reusable);
create table public.member_invite_reservations (
  invite_id uuid not null references public.member_invites(id) on delete cascade,
  reservation uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.member_invite_reservations enable row level security;
revoke all on public.member_invite_reservations from public,anon,authenticated;
grant all on public.member_invite_reservations to service_role;
create or replace function public.reserve_member_invite(p_hash text,p_reservation uuid) returns void
language plpgsql security definer set search_path='' as $$
declare invitation public.member_invites;
begin
  select * into invitation from public.member_invites where token_hash=p_hash for update;
  if invitation.id is null or (not invitation.reusable and invitation.used_at is not null) or invitation.revoked_at is not null
    or invitation.expires_at<=clock_timestamp() or (not invitation.reusable and invitation.reserved_by is not null) or p_reservation is null then
    raise exception 'Invite unavailable';
  end if;
  if invitation.reusable then
    if not exists(select 1 from public.profiles where id=invitation.created_by and role='owner' and active and email='keshav.sreekantham@gmail.com') then raise exception 'Invite unavailable';end if;
    insert into public.member_invite_reservations(invite_id,reservation) values(invitation.id,p_reservation);
  else
    update public.member_invites set reserved_by=p_reservation where id=invitation.id;
  end if;
end;$$;

create or replace function public.complete_member_invite(p_hash text,p_reservation uuid,p_user uuid,p_name text) returns void
language plpgsql security definer set search_path='' as $$
declare invitation public.member_invites;
begin
  select * into invitation from public.member_invites where token_hash=p_hash for update;
  if invitation.id is null or (not invitation.reusable and (invitation.reserved_by is null or invitation.reserved_by is distinct from p_reservation))
    or (invitation.reusable and not exists(select 1 from public.member_invite_reservations where invite_id=invitation.id and reservation=p_reservation))
    or (not invitation.reusable and invitation.used_at is not null) or invitation.revoked_at is not null or invitation.expires_at<=clock_timestamp() then
    raise exception 'Invite unavailable';
  end if;
  if invitation.reusable and not exists(select 1 from public.profiles where id=invitation.created_by and role='owner' and active and email='keshav.sreekantham@gmail.com') then raise exception 'Invite unavailable';end if;
  if not exists(select 1 from public.profiles where id=p_user and role='member' and not active)
    or not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null) then
    raise exception 'Account cannot use this invite';
  end if;
  update public.profiles set active=true,display_name=p_name where id=p_user;
  if invitation.reusable then
    delete from public.member_invite_reservations where invite_id=invitation.id and reservation=p_reservation;
  else
    update public.member_invites set used_by=p_user,used_at=now(),reserved_by=null where id=invitation.id;
  end if;
end;$$;

create or replace function public.release_member_invite(p_hash text,p_reservation uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  delete from public.member_invite_reservations r using public.member_invites i where r.invite_id=i.id and i.token_hash=p_hash and r.reservation=p_reservation;
  update public.member_invites set reserved_by=null where token_hash=p_hash and reserved_by=p_reservation and used_at is null;
end;$$;
commit;
