import { createAdminClient } from '@/lib/supabase/admin';
import { nimClient } from '@/lib/nim/client';
import { isSupabaseConfiguredForData } from '@/lib/supabase-config';
import { getFallbackDemoRoom } from '@/lib/dashboard-data';
import {
  getRoomArtifactsContext,
  type RoomArtifactReference,
} from '@/lib/room-artifacts-context';

export type CourtroomAgentId = 'advocate' | 'skeptic' | 'judge';

export interface CourtroomTurn {
  agentId: CourtroomAgentId;
  agentName: string;
  role: string;
  content: string;
  referencedArtifacts: RoomArtifactReference[];
  usedFallback: boolean;
}

export interface CourtroomVerdict {
  content: string;
  verdict: string;
  score: number | null;
  citedArtifacts: RoomArtifactReference[];
}

export interface CourtroomResult {
  topic: string;
  roomName: string;
  artifacts: RoomArtifactReference[];
  turns: CourtroomTurn[];
  verdict: CourtroomVerdict;
  usedFallback: boolean;
  hasRulebook: boolean;
}

interface RoomBrief {
  roomName: string;
  projectType: string;
  problemStatement: string;
  taskSummary: string;
}

const AGENTS: {
  id: CourtroomAgentId;
  name: string;
  role: string;
  instructions: string;
}[] = [
  {
    id: 'advocate',
    name: 'Advocate',
    role: 'Proponent',
    instructions: `You are the Advocate / Proponent in an AI Courtroom reviewing a hackathon project.
Build the strongest evidence-based case that the project satisfies the room's rules, rubric and constraints.
- Quote or cite specific rules and judging criteria from the room artifacts.
- Use research papers, benchmarks and reference notes from the artifacts as evidence.
- Be concrete about features, tasks and measurable results.
- Do not invent evidence. If a criterion is not met, acknowledge it and argue proportionality.
- End with a short "Evidence cited:" line listing artifact titles in backticks.`,
  },
  {
    id: 'skeptic',
    name: 'Skeptic',
    role: 'Critic',
    instructions: `You are the Skeptic / Critic in an AI Courtroom reviewing a hackathon project.
Stress-test the Advocate's case against the room's rules and judging rubric.
- Identify every unmet constraint, missing benchmark, weak claim or compliance risk.
- Cite exact rules and rubric lines from the room artifacts, using artifact titles in backticks.
- Use research evidence from the artifacts to challenge or qualify claims.
- Distinguish "not demonstrated" from "not allowed".
- End with the top 3 risks, ordered by severity, and an "Evidence cited:" line.`,
  },
  {
    id: 'judge',
    name: 'Judge',
    role: 'Moderator',
    instructions: `You are the Judge / Moderator in an AI Courtroom reviewing a hackathon project.
Weigh the Advocate and Skeptic arguments and issue a fair, rubric-grounded verdict.
- Enforce the constraints and judging criteria defined in rules.md, the room rubric and any spec artifacts.
- Cite specific research papers, benchmarks or reference docs as evidence.
- Produce this structure:
  1. Verdict (PASS / CONDITIONAL PASS / FAIL)
  2. Score (0-100) with a one-line justification
  3. Rubric breakdown (criterion -> score -> reason)
  4. Binding constraints check (met / not met / not evidenced)
  5. Required fixes before submission
  6. Evidence cited (artifact titles in backticks)
- Never invent a rule that is absent from the artifacts. State "not specified in room artifacts" when needed.`,
  },
];

function isNimConfigured(): boolean {
  return Boolean(process.env.NVIDIA_NIM_API_KEY);
}

function isSupabaseConfiguredLocal(): boolean {
  return isSupabaseConfiguredForData();
}

function buildAgentSystemPrompt(
  agent: (typeof AGENTS)[number],
  artifactsContext: string
): string {
  return `You are ${agent.name}, the ${agent.role} in the TrackMyWork AI Courtroom.

${agent.instructions}

The following room artifacts are authoritative ground truth. Rules and rulebooks override your general knowledge:
${artifactsContext}`;
}

async function loadRoomBrief(roomId: string, topic: string): Promise<RoomBrief> {
  if (!isSupabaseConfiguredLocal()) {
    const demo = getFallbackDemoRoom(roomId);
    return {
      roomName: demo.room.name,
      projectType: demo.room.project_type,
      problemStatement: demo.room.description || 'Not specified',
      taskSummary:
        demo.tasks
          .map(
            (task) =>
              `- [${task.status}] ${task.title}${task.nim_summary ? ` — ${task.nim_summary}` : ''}`
          )
          .join('\n') || 'No tasks recorded yet.',
    };
  }

  try {
    const admin = createAdminClient();
    const [roomResult, taskResult] = await Promise.all([
      admin
        .from('rooms')
        .select('name, description, problem_statement, project_type, rules_text, judging_rubric')
        .eq('id', roomId)
        .maybeSingle(),
      admin
        .from('tasks')
        .select('title, status, category, nim_summary')
        .eq('room_id', roomId)
        .order('updated_at', { ascending: false })
        .limit(25),
    ]);

    const room = (roomResult.data || {}) as Record<string, unknown>;
    const tasks = (taskResult.data || []) as {
      title?: string;
      status?: string;
      category?: string;
      nim_summary?: string | null;
    }[];

    const taskSummary = tasks
      .filter((task) => task.title)
      .map(
        (task) =>
          `- [${task.status || 'unknown'}] ${task.title}${task.category ? ` (${task.category})` : ''}${
            task.nim_summary ? ` — ${task.nim_summary}` : ''
          }`
      )
      .join('\n');

    return {
      roomName: String(room.name || 'This room'),
      projectType: String(room.project_type || 'software'),
      problemStatement: String(room.problem_statement || room.description || 'Not specified'),
      taskSummary: taskSummary || 'No tasks recorded yet.',
    };
  } catch {
    return {
      roomName: 'This room',
      projectType: 'software',
      problemStatement: 'Not specified',
      taskSummary: 'No tasks recorded yet.',
    };
  }
}

function buildAgentUserPrompt(
  agent: CourtroomAgentId,
  topic: string,
  brief: RoomBrief,
  artifactsContext: string,
  priorTurns: CourtroomTurn[]
): string {
  const transcript = priorTurns
    .map((turn) => `${turn.agentName} (${turn.role}):\n${turn.content}`)
    .join('\n\n');

  return `Room: ${brief.roomName}
Project type: ${brief.projectType}
Problem statement: ${brief.problemStatement}

Courtroom topic / motion:
${topic}

Project task evidence:
${brief.taskSummary}

${artifactsContext}

${transcript ? `Prior courtroom transcript:\n${transcript}\n\n` : ''}
Respond as ${AGENTS.find((item) => item.id === agent)?.name}. Ground every material claim in the room artifacts above. Cite exact artifact titles in backticks.`;
}

function extractArtifactSections(context: string): { title: string; body: string }[] {
  const sections: { title: string; body: string }[] = [];
  const regex = /--- ARTIFACT \d+: (.*?) \(([^\n]*)\) ---\n([\s\S]*?)(?=\n--- ARTIFACT \d+:|\n\[END ROOM ARTIFACTS)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(context)) !== null) {
    sections.push({ title: match[1].trim(), body: match[3].trim() });
  }
  return sections;
}

function excerpt(text: string, max = 900): string {
  const clean = text.replace(/\s+\n/g, '\n').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function fallbackTurn(
  agent: CourtroomAgentId,
  topic: string,
  artifactsContext: string,
  references: RoomArtifactReference[],
  priorTurns: CourtroomTurn[]
): string {
  const sections = extractArtifactSections(artifactsContext);
  const ruleSection =
    sections.find((section) =>
      references.some((reference) => reference.title === section.title && reference.isRulebook)
    ) || sections[0];
  const evidenceSection =
    sections.find((section) => section !== ruleSection) || sections[1] || null;
  const titles = references.map((reference) => `\`${reference.title}\``);
  const titleList = titles.length > 0 ? titles.join(', ') : 'no uploaded artifacts';
  const ruleExcerpt = ruleSection ? excerpt(ruleSection.body, 700) : 'No rulebook text was found.';
  const evidenceExcerpt = evidenceSection
    ? excerpt(evidenceSection.body, 500)
    : 'No separate research artifact was found.';

  if (agent === 'advocate') {
    return `**Motion:** ${topic}

**Opening argument**
The project should be evaluated against the room's own rules and rubric, not generic hackathon expectations. The authoritative material loaded for this session is ${titleList}.

**Rulebook alignment**
From \`${ruleSection?.title || 'Room Rules, Rubric & Constraints'}\`:
> ${ruleExcerpt}

**Research / reference support**
${evidenceSection ? `From \`${evidenceSection.title}\`:\n> ${evidenceExcerpt}` : 'No research artifact is available, so the case relies on the rulebook and task evidence.'}

**Evidence cited:** ${titleList}`;
  }

  if (agent === 'skeptic') {
    const advocate = priorTurns.find((turn) => turn.agentId === 'advocate');
    return `**Challenge to the Advocate**
${advocate ? 'The Advocate argues that the project aligns with the room rules. I am testing that claim against the actual text.' : 'The project claims compliance, but compliance must be evidenced.'}

**Compliance gaps**
1. The rulebook \`${ruleSection?.title || 'Room Rules, Rubric & Constraints'}\` must be checked line by line; any criterion without a task, demo or benchmark is "not evidenced", not "met".
2. ${evidenceSection ? `The reference \`${evidenceSection.title}\` must be tied to a concrete result; a citation alone is not proof of implementation.` : 'No research artifact was loaded, so benchmark claims cannot be verified.'}
3. Required fixes should be tracked as blockers before submission.

**Rulebook excerpt used**
> ${ruleExcerpt}

**Top risks**
1. Unsupported compliance claim.
2. Missing benchmark or measurable evidence.
3. Scope creep beyond the allowed constraints.

**Evidence cited:** ${titleList}`;
  }

  const advocate = priorTurns.find((turn) => turn.agentId === 'advocate');
  const skeptic = priorTurns.find((turn) => turn.agentId === 'skeptic');
  const hasEvidence = sections.length > 0;
  const verdict = hasEvidence ? 'CONDITIONAL PASS' : 'FAIL';
  const score = hasEvidence ? 72 : 35;

  return `**Verdict:** ${verdict}
**Score:** ${score}/100 — the decision is based on the room artifacts, not general assumptions.

**Rubric breakdown**
- Rulebook compliance: ${hasEvidence ? 'Partially demonstrated' : 'Not demonstrated'} — see \`${ruleSection?.title || 'Room Rules, Rubric & Constraints'}\`.
- Evidence quality: ${evidenceSection ? `Supported by \`${evidenceSection.title}\`` : 'No research/reference artifact loaded'}.
- Submission readiness: Requires the fixes below.

**Binding constraints check**
- Rules source: \`${ruleSection?.title || 'Room Rules, Rubric & Constraints'}\` loaded.
- Research evidence: ${evidenceSection ? `\`${evidenceSection.title}\` loaded.` : 'Not loaded.'}
- Advocate case: ${advocate ? 'considered' : 'not available'}.
- Skeptic risks: ${skeptic ? 'considered' : 'not available'}.

**Required fixes before submission**
1. Map every rubric line to a concrete task, demo or benchmark.
2. Close the gaps raised by the Skeptic.
3. Re-run the Courtroom after the fixes so the verdict reflects the latest artifacts.

**Evidence cited:** ${titleList}`;
}

function citedArtifacts(
  content: string,
  references: RoomArtifactReference[]
): RoomArtifactReference[] {
  const lower = content.toLowerCase();
  const cited = references.filter((reference) => {
    const title = reference.title.toLowerCase();
    return title.length >= 3 && lower.includes(title);
  });
  return cited.length > 0 ? cited : references.slice(0, 4);
}

function parseVerdict(content: string, references: RoomArtifactReference[]): CourtroomVerdict {
  const verdictMatch = content.match(/Verdict[^:\n]*:\s*\**\s*(PASS|CONDITIONAL PASS|FAIL)/i);
  const scoreMatch = content.match(/Score[^:\n]*:\s*\**\s*(\d{1,3})\s*(?:\/\s*100)?/i);
  const score = scoreMatch ? Math.max(0, Math.min(100, Number(scoreMatch[1]))) : null;
  return {
    content,
    verdict: verdictMatch ? verdictMatch[1].toUpperCase() : 'UNDECIDED',
    score,
    citedArtifacts: citedArtifacts(content, references),
  };
}

export async function runCourtroom(input: {
  roomId: string;
  topic: string;
  userId?: string;
}): Promise<CourtroomResult> {
  const roomId = String(input.roomId || '').trim();
  const topic =
    String(input.topic || '').trim() ||
    'Does our current project satisfy the room rules and judging rubric?';

  const artifacts = await getRoomArtifactsContext(roomId, topic, {
    maxTotalChars: 24_000,
    maxArtifacts: 8,
  });
  const brief = await loadRoomBrief(roomId, topic);
  const turns: CourtroomTurn[] = [];
  let anyFallback = false;

  for (const agent of AGENTS) {
    let content = '';
    let usedFallback = false;

    if (isNimConfigured()) {
      try {
        const response = await nimClient.callNimRaw(
          [
            {
              role: 'system',
              content: buildAgentSystemPrompt(agent, artifacts.context),
            },
            {
              role: 'user',
              content: buildAgentUserPrompt(agent.id, topic, brief, artifacts.context, turns),
            },
          ],
          undefined,
          agent.id === 'judge' ? 0.15 : 0.3,
          agent.id === 'judge' ? 1_500 : 1_100
        );
        content = response.choices[0]?.message?.content?.trim() || '';
      } catch (error) {
        console.warn(`[courtroom] ${agent.name} NIM call failed:`, error);
      }
    }

    if (!content) {
      anyFallback = true;
      usedFallback = true;
      content = fallbackTurn(agent.id, topic, artifacts.context, artifacts.artifacts, turns);
    }

    turns.push({
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      content,
      referencedArtifacts: citedArtifacts(content, artifacts.artifacts),
      usedFallback,
    });
  }

  const judgeTurn = turns.find((turn) => turn.agentId === 'judge');
  const verdict = parseVerdict(judgeTurn?.content || '', artifacts.artifacts);

  return {
    topic,
    roomName: brief.roomName,
    artifacts: artifacts.artifacts,
    turns,
    verdict,
    usedFallback: anyFallback,
    hasRulebook: artifacts.hasRulebook,
  };
}
