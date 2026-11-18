import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeGitHubRepoInput } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RuleRow = {
  tech_stack_locks?: string[] | null;
  custom_agent_instructions?: string | null;
};

type MemberRow = {
  user_id: string;
  role_title: string | null;
  custom_role_name: string | null;
  flag_is_team_leader: boolean | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
};

type CourtroomOptionRow = {
  id?: string;
  title?: string;
  agents_md_rules?: string[];
};

type CourtroomSessionRow = {
  motion: string;
  adopted_option_id: string | null;
  decision_options: CourtroomOptionRow[] | null;
  updated_at: string;
};

function buildAgentRules({
  roomName,
  description,
  juryExpectations,
  projectType,
  repoUrl,
  rules,
  members,
  profiles,
  courtroomRulings,
  format,
}: {
  roomName: string;
  description: string | null;
  juryExpectations: string | null;
  projectType: string | null;
  repoUrl: string | null;
  rules: RuleRow | null;
  members: MemberRow[];
  profiles: ProfileRow[];
  courtroomRulings: CourtroomSessionRow[];
  format: 'agents' | 'cursorrules';
}) {
  const stack = (rules?.tech_stack_locks ?? []).filter(Boolean);
  const customInstructions =
    rules?.custom_agent_instructions?.trim() || juryExpectations?.trim() || '';
  const normalizedRepo = repoUrl ? normalizeGitHubRepoInput(repoUrl) : null;
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const team = members.map((member) => {
    const profile = profileById.get(member.user_id);
    const name = profile?.display_name || profile?.username || profile?.email || 'Teammate';
    const handle = profile?.username ? ` (@${profile.username})` : '';
    const role = member.custom_role_name || member.role_title || 'Member';
    const leader = member.flag_is_team_leader ? ' — Team Leader' : '';
    return `- ${name}${handle} — ${role}${leader}`;
  });

  const heading =
    format === 'cursorrules'
      ? `# Cursor rules for ${roomName}`
      : `# ${roomName} — agent rules`;

  const intro =
    format === 'cursorrules'
      ? 'You are an AI pair programmer on this project. Follow the rules below before proposing or applying changes.'
      : 'This file tells coding agents how to work inside this repository. Keep it up to date as the team\'s rules change.';

  const sections: string[] = [
    heading,
    '',
    intro,
    '',
    '## Project',
    '',
    `- Name: ${roomName}`,
    `- Type: ${projectType || 'software'}`,
    normalizedRepo
      ? `- Repository: ${normalizedRepo.owner}/${normalizedRepo.repo} (${normalizedRepo.url})`
      : '- Repository: not linked yet — connect GitHub from the room settings page.',
  ];

  if (description?.trim()) {
    sections.push('', description.trim());
  }

  sections.push('', '## Locked tech stack', '');

  if (stack.length > 0) {
    sections.push(
      'Do not introduce alternatives to these choices without asking the team:',
      '',
      ...stack.map((entry) => `- ${entry}`)
    );
  } else {
    sections.push('- No technology locks configured. Prefer the libraries already used in the repo.');
  }

  sections.push('', '## Team instructions', '');
  sections.push(
    customInstructions ||
      '- None provided. Ask the team before making architectural or dependency changes.'
  );

  sections.push(
    '',
    '## Active AI Courtroom Rulings (AGENTS.md Constraints)',
    ''
  );

  if (courtroomRulings.length === 0) {
    sections.push(
      '- No adopted courtroom rulings yet. If a decision is contested, convene the AI Courtroom from the room workspace.'
    );
  } else {
    sections.push(
      'These architectural decisions were adopted in the AI Courtroom. Treat them as hard constraints:'
    );
    sections.push('');

    for (const ruling of courtroomRulings) {
      const options = Array.isArray(ruling.decision_options) ? ruling.decision_options : [];
      const selected = options.find((option) => option?.id === ruling.adopted_option_id);
      const title = selected?.title || ruling.adopted_option_id || 'Adopted ruling';
      const adoptedRules = (selected?.agents_md_rules ?? []).filter(Boolean);

      sections.push(`### ${title}`);
      sections.push(`- Motion: ${ruling.motion}`);
      sections.push(`- Adopted: ${ruling.updated_at}`);

      if (adoptedRules.length > 0) {
        sections.push('- Constraints:');
        for (const rule of adoptedRules) {
          sections.push(`  - ${rule}`);
        }
      }

      sections.push('');
    }
  }

  sections.push('', '## Team', '');
  sections.push(...(team.length > 0 ? team : ['- No active members yet.']));

  sections.push(
    '',
    '## How to work here',
    '',
    '- Keep each change scoped to the task you were given and explain anything surprising in the pull request.',
    '- Before editing a file another teammate has locked, coordinate with them first.',
    '- Run the project checks (for example `npm run type-check` and the test suite) before proposing a commit.',
    '- Report progress with the TrackMyWork MCP tools (`trackmywork_heartbeat`, `trackmywork_status`) so the dashboard shows who is coding.',
    '- Never commit secrets. Read configuration from `.env.local` and keep it out of version control.',
    ''
  );

  return sections.join('\n');
}

/**
 * Download the room's agent rules as `AGENTS.md` or `.cursorrules`.
 *
 * These files are generated from the room's locked tech stack, custom agent
 * instructions, and team roster so every IDE agent gets the same context.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const roomId = params.id;
  const supabase = createServerClientSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: room } = await admin
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();

  if (!room) {
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
  }

  const [{ data: membership }, { data: profile }, { data: rules }, { data: members }] =
    await Promise.all([
      admin
        .from('room_members')
        .select('status, flag_is_team_leader')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .maybeSingle(),
      admin.from('users').select('is_global_admin').eq('id', user.id).maybeSingle(),
      admin.from('room_rules').select('*').eq('room_id', roomId).maybeSingle(),
      admin
        .from('room_members')
        .select('user_id, role_title, custom_role_name, flag_is_team_leader')
        .eq('room_id', roomId)
        .eq('status', 'active'),
    ]);

  const isMember =
    membership?.status === 'active' ||
    room.created_by === user.id ||
    Boolean(profile?.is_global_admin);

  if (!isMember) {
    return NextResponse.json(
      { error: 'You do not have access to this room.' },
      { status: 403 }
    );
  }

  const memberRows = (members ?? []) as MemberRow[];
  const memberIds = memberRows.map((member) => member.user_id);

  const { data: profiles } =
    memberIds.length > 0
      ? await admin
          .from('users')
          .select('id, display_name, username, email')
          .in('id', memberIds)
      : { data: [] as ProfileRow[] };

  const format =
    new URL(req.url).searchParams.get('format') === 'cursorrules'
      ? 'cursorrules'
      : 'agents';

  // Courtroom rulings are adopted architectural decisions; they must travel
  // with every AGENTS.md / .cursorrules export so IDE agents obey them.
  const { data: courtSessions } = await admin
    .from('court_sessions')
    .select('motion, adopted_option_id, decision_options, updated_at')
    .eq('room_id', roomId)
    .eq('status', 'adopted')
    .order('updated_at', { ascending: false });

  const content = buildAgentRules({
    roomName: room.name,
    description: room.description ?? null,
    juryExpectations: room.jury_expectations ?? null,
    projectType: room.project_type ?? null,
    repoUrl: room.github_repo ?? null,
    rules: (rules ?? null) as RuleRow | null,
    members: memberRows,
    profiles: (profiles ?? []) as ProfileRow[],
    courtroomRulings: (courtSessions ?? []) as CourtroomSessionRow[],
    format,
  });

  const filename = format === 'cursorrules' ? '.cursorrules' : 'AGENTS.md';

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
