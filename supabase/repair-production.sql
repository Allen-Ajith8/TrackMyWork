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

-- 4. Privileges --------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;

-- 5. Refresh the API schema cache -------------------------------------------

notify pgrst, 'reload schema';
