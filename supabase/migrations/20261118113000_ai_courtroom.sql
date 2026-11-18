-- ============================================================================
-- TrackMyWork - AI Courtroom Tables
-- Phase 1B: Court session, transcript, and petition schema
-- Run with: supabase db push  OR  Supabase Dashboard > SQL Editor
-- Idempotent: safe to run multiple times
-- ============================================================================

-- 1. court_sessions -----------------------------------------------------------

create table if not exists public.court_sessions (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_by uuid not null references public.users(id),
  motion text not null,
  repo_context jsonb not null default '{}'::jsonb,
  status text not null default 'routing'
    check (status in ('routing','phase1_opening','phase2_rebuttals','awaiting_human_choice','adopted','failed')),
  witness_flags jsonb not null default '{"needsSecurityWitness": false, "needsUxWitness": false, "reasoning": ""}'::jsonb,
  phase2_grants_used integer not null default 0
    check (phase2_grants_used >= 0 and phase2_grants_used <= 2),
  debate_summary text,
  key_tensions jsonb not null default '[]'::jsonb,
  decision_options jsonb not null default '[]'::jsonb,
  adopted_option_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. court_transcripts --------------------------------------------------------

create table if not exists public.court_transcripts (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.court_sessions(id) on delete cascade,
  phase text not null
    check (phase in ('phase1_opening','judge_gavel','phase2_rebuttal','human_interjection')),
  speaker_role text not null,
  model_id text,
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  turn_index integer not null,
  created_at timestamptz not null default now()
);

-- 3. court_petitions ----------------------------------------------------------

create table if not exists public.court_petitions (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.court_sessions(id) on delete cascade,
  round_number integer not null check (round_number in (1, 2)),
  speaker_role text not null,
  wants_floor boolean not null,
  grounds text check (grounds in ('direct_attack','new_evidence') or grounds is null),
  target_role text,
  justification text not null,
  judge_decision text not null default 'pending'
    check (judge_decision in ('pending','granted','denied')),
  judge_reason text,
  created_at timestamptz not null default now()
);

-- 4. Indexes ------------------------------------------------------------------

create index if not exists idx_court_sessions_room_id on public.court_sessions(room_id);
create index if not exists idx_court_transcripts_session_id_turn on public.court_transcripts(session_id, turn_index);
create index if not exists idx_court_petitions_session_round on public.court_petitions(session_id, round_number);

-- 5. Row Level Security -------------------------------------------------------

alter table public.court_sessions enable row level security;
alter table public.court_transcripts enable row level security;
alter table public.court_petitions enable row level security;

-- Helper: active room member check (matches existing repo pattern)
create or replace function public.is_room_member_court(user_id uuid, room_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.room_members
    where user_id = $1 and room_id = $2 and status = 'active'
  );
$$ language sql security definer stable;

-- court_sessions policies
drop policy if exists "court_sessions_all_global_admin" on public.court_sessions;
create policy "court_sessions_all_global_admin" on public.court_sessions
  for all using (public.is_global_admin(auth.uid()));

drop policy if exists "court_sessions_select_creator" on public.court_sessions;
create policy "court_sessions_select_creator" on public.court_sessions
  for select using (created_by = auth.uid());

drop policy if exists "court_sessions_select_member" on public.court_sessions;
create policy "court_sessions_select_member" on public.court_sessions
  for select using (public.is_room_member_court(auth.uid(), room_id));

drop policy if exists "court_sessions_insert_member" on public.court_sessions;
create policy "court_sessions_insert_member" on public.court_sessions
  for insert with check (public.is_room_member_court(auth.uid(), room_id));

drop policy if exists "court_sessions_update_member" on public.court_sessions;
create policy "court_sessions_update_member" on public.court_sessions
  for update using (public.is_room_member_court(auth.uid(), room_id))
  with check (public.is_room_member_court(auth.uid(), room_id));

-- court_transcripts policies
drop policy if exists "court_transcripts_all_global_admin" on public.court_transcripts;
create policy "court_transcripts_all_global_admin" on public.court_transcripts
  for all using (public.is_global_admin(auth.uid()));

drop policy if exists "court_transcripts_select_session_member" on public.court_transcripts;
create policy "court_transcripts_select_session_member" on public.court_transcripts
  for select using (
    public.is_room_member_court(
      auth.uid(),
      (select room_id from public.court_sessions where id = session_id)
    )
  );

drop policy if exists "court_transcripts_insert_member" on public.court_transcripts;
create policy "court_transcripts_insert_member" on public.court_transcripts
  for insert with check (
    public.is_room_member_court(
      auth.uid(),
      (select room_id from public.court_sessions where id = session_id)
    )
  );

-- court_petitions policies
drop policy if exists "court_petitions_all_global_admin" on public.court_petitions;
create policy "court_petitions_all_global_admin" on public.court_petitions
  for all using (public.is_global_admin(auth.uid()));

drop policy if exists "court_petitions_select_session_member" on public.court_petitions;
create policy "court_petitions_select_session_member" on public.court_petitions
  for select using (
    public.is_room_member_court(
      auth.uid(),
      (select room_id from public.court_sessions where id = session_id)
    )
  );

drop policy if exists "court_petitions_insert_member" on public.court_petitions;
create policy "court_petitions_insert_member" on public.court_petitions
  for insert with check (
    public.is_room_member_court(
      auth.uid(),
      (select room_id from public.court_sessions where id = session_id)
    )
  );

-- 6. Realtime publication -----------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'court_sessions'
  ) then
    alter publication supabase_realtime add table public.court_sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'court_transcripts'
  ) then
    alter publication supabase_realtime add table public.court_transcripts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'court_petitions'
  ) then
    alter publication supabase_realtime add table public.court_petitions;
  end if;
end
$$;

-- 7. Refresh API schema cache -------------------------------------------------

notify pgrst, 'reload schema';
