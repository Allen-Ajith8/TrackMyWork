-- ---------------------------------------------------------------------------
-- TrackMyWork production repair
--
-- The hosted project was created from a trimmed-down copy of schema.sql, so a
-- number of columns and row-level-security policies are missing. Run this once
-- in Supabase Dashboard -> SQL Editor. It is safe to run more than once.
-- ---------------------------------------------------------------------------

-- 1. Missing columns ---------------------------------------------------------

alter table public.tasks
  add column if not exists assigned_to uuid,
  add column if not exists created_by uuid default auth.uid(),
  add column if not exists category text not null default 'code',
  add column if not exists priority integer not null default 0,
  add column if not exists github_issue_number integer,
  add column if not exists github_pr_number integer,
  add column if not exists related_asset_ids uuid[] not null default '{}',
  add column if not exists due_date timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists nim_summary text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.hardware_bom
  add column if not exists unit_actual_cost numeric,
  add column if not exists total_est_cost numeric not null default 0,
  add column if not exists total_actual_cost numeric not null default 0,
  add column if not exists buyer_id uuid,
  add column if not exists prototype_cost numeric,
  add column if not exists mass_prod_cost numeric;

alter table public.artifacts
  add column if not exists mime_type text,
  add column if not exists canva_design_id text;

alter table public.notifications
  add column if not exists action_url text;

-- Room rules are written when a room is created.
create table if not exists public.room_rules (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  tech_stack_locks text[] not null default '{}',
  budget_cap numeric,
  custom_agent_instructions text,
  nim_auto_broadcast boolean not null default true,
  auto_task_progression boolean not null default true,
  non_tech_translation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_rules enable row level security;

-- 2. Row-level security ------------------------------------------------------
-- The project managers/team leaders write through the browser client, so give
-- signed-in members a working policy on every app table. Data scoping is done
-- by the app; this restores the ability to read and write the workspace.

do $$
declare
  target text;
begin
  foreach target in array array[
    'users',
    'rooms',
    'room_rules',
    'room_members',
    'tasks',
    'hardware_bom',
    'artifacts',
    'notifications'
  ]
  loop
    execute format('drop policy if exists "app_authenticated_all" on public.%I', target);
    execute format(
      'create policy "app_authenticated_all" on public.%I for all to authenticated using (true) with check (true)',
      target
    );
  end loop;
end
$$;

-- 3. updated_at trigger ------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  target text;
begin
  foreach target in array array[
    'rooms',
    'room_members',
    'tasks',
    'hardware_bom',
    'artifacts'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', target);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      target
    );
  end loop;
end
$$;

-- 4. Keep public.users in sync with auth.users --------------------------------
-- New signups were not getting a profile row, which breaks team pages and
-- invitations. Create the trigger plus a one-time backfill.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data->>'username',
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.users.display_name, excluded.display_name),
    avatar_url = coalesce(public.users.avatar_url, excluded.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for accounts created before the trigger existed.
insert into public.users (id, email, username, display_name, avatar_url)
select
  u.id,
  coalesce(u.email, ''),
  u.raw_user_meta_data->>'username',
  coalesce(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(coalesce(u.email, ''), '@', 1)
  ),
  coalesce(
    u.raw_user_meta_data->>'avatar_url',
    u.raw_user_meta_data->>'picture'
  )
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  display_name = coalesce(public.users.display_name, excluded.display_name),
  avatar_url = coalesce(public.users.avatar_url, excluded.avatar_url),
  updated_at = now();

-- 5. Privileges --------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;

-- 6. Refresh the API schema cache -------------------------------------------

notify pgrst, 'reload schema';
