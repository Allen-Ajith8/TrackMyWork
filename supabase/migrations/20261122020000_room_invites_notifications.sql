-- ============================================================================
-- TrackMyWork - Room Invites & In-App Notifications
-- Phase: Room Member Invite & In-App Notification Flow
-- Idempotent: safe to run multiple times
-- Run with: supabase db push  OR  Supabase Dashboard > SQL Editor
-- ============================================================================

-- 1. room_invitations ----------------------------------------------------------

create table if not exists public.room_invitations (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  inviter_id uuid not null references public.users(id),
  invitee_id uuid not null references public.users(id),
  invitee_email text not null,
  role text not null default 'member',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  responded_at timestamptz
);

create index if not exists idx_room_invitations_room_id on public.room_invitations(room_id);
create index if not exists idx_room_invitations_invitee_id on public.room_invitations(invitee_id);
create index if not exists idx_room_invitations_status on public.room_invitations(status);
create unique index if not exists idx_room_invitations_pending_unique
  on public.room_invitations(room_id, invitee_id)
  where status = 'pending';

-- 2. notifications: add metadata column if missing ------------------------------

alter table if exists public.notifications
  add column if not exists metadata jsonb default '{}'::jsonb;

-- Add 'room_invite' to the notification_type enum if not already present.
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.notification_type'::regtype
      and enumlabel = 'room_invite'
  ) then
    alter type public.notification_type add value 'room_invite';
  end if;
end
$$;

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_is_read on public.notifications(is_read);

-- 3. Row Level Security --------------------------------------------------------

alter table public.room_invitations enable row level security;

drop policy if exists "room_invitations_all_global_admin" on public.room_invitations;
create policy "room_invitations_all_global_admin" on public.room_invitations
  for all using (public.is_global_admin(auth.uid()));

drop policy if exists "room_invitations_select_inviter" on public.room_invitations;
create policy "room_invitations_select_inviter" on public.room_invitations
  for select using (inviter_id = auth.uid());

drop policy if exists "room_invitations_select_invitee" on public.room_invitations;
create policy "room_invitations_select_invitee" on public.room_invitations
  for select using (invitee_id = auth.uid());

drop policy if exists "room_invitations_insert_member" on public.room_invitations;
create policy "room_invitations_insert_member" on public.room_invitations
  for insert with check (
    public.is_global_admin(auth.uid())
    or public.has_room_permission(auth.uid(), room_id, 'can_invite_members')
    or auth.uid() = inviter_id
  );

drop policy if exists "room_invitations_update_respond" on public.room_invitations;
create policy "room_invitations_update_respond" on public.room_invitations
  for update using (invitee_id = auth.uid())
  with check (invitee_id = auth.uid());

-- 4. Realtime publication ------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_invitations'
  ) then
    alter publication supabase_realtime add table public.room_invitations;
  end if;
end
$$;

-- 5. Grants --------------------------------------------------------------------

grant select, insert, update, delete on public.room_invitations to authenticated;
grant select on public.room_invitations to anon;

-- 6. Refresh API schema cache --------------------------------------------------

notify pgrst, 'reload schema';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
