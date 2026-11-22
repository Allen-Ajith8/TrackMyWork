import { createAdminClient } from '@/lib/supabase/admin';
import { nimClient } from '@/lib/nim/client';
import { isSupabaseConfiguredForData } from '@/lib/supabase-config';
import {
  getRoomArtifactsContext,
  type RoomArtifactReference,
} from '@/lib/room-artifacts-context';

export interface MicaHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MicaAnswer {
  reply: string;
  referencedArtifacts: RoomArtifactReference[];
  loadedArtifacts: RoomArtifactReference[];
  usedFallback: boolean;
  hasRulebook: boolean;
}

const MAX_HISTORY = 12;

function isNimConfigured(): boolean {
  return Boolean(process.env.NVIDIA_NIM_API_KEY);
}

function isSupabaseConfiguredLocal(): boolean {
  return isSupabaseConfiguredForData();
}

function buildSystemPrompt(): string {
  return `You are MICA, the team's AI collaborator inside a TrackMyWork hackathon room.

Grounding rules:
- The [ROOM ARTIFACTS & RULEBOOKS] block is authoritative ground truth for this room.
- Treat rules.md, rulebooks, judging rubrics, specs, research papers and reference notes as higher priority than your general knowledge.
- When you use an artifact, cite its exact title in backticks, for example \`rules.md\` or \`research-notes.md\`.
- If a rule, constraint or benchmark is not present in the artifacts, say that it is not specified instead of inventing it.
- Prefer concrete answers: list constraints, cite evidence, and connect research findings to the team's current project.
- Use the room AI task summaries and recent chat for project state, but never let them override the rulebook.
- Keep answers concise, structured and useful during a hackathon sprint.`;
}

function buildUserPrompt(input: {
  roomName: string;
  question: string;
  artifactsContext: string;
  summariesContext: string;
  chatContext: string;
}): string {
  return `Room: ${input.roomName}
Question: ${input.question}

${input.artifactsContext}

[ROOM AI TASK SUMMARIES]
${input.summariesContext || 'No saved AI task summaries yet.'}

[RECENT TEAM CHAT]
${input.chatContext || 'No recent chat messages.'}

Answer the question using the room artifacts as the source of truth. Cite artifact titles in backticks.`;
}

async function loadRoomName(roomId: string): Promise<string> {
  if (!isSupabaseConfiguredLocal()) return 'This room';
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('rooms').select('name').eq('id', roomId).maybeSingle();
    return String((data as { name?: string } | null)?.name || 'This room');
  } catch {
    return 'This room';
  }
}

async function loadSummaries(roomId: string): Promise<string> {
  if (!isSupabaseConfiguredLocal()) return '';
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('tasks')
      .select('title, status, nim_summary, description')
      .eq('room_id', roomId)
      .order('updated_at', { ascending: false })
      .limit(30);

    const rows = (data || []) as {
      title?: string;
      status?: string;
      nim_summary?: string | null;
      description?: string | null;
    }[];

    return rows
      .filter((task) => task.title)
      .map((task) => {
        const summary = task.nim_summary || task.description || 'No summary saved.';
        return `- ${task.title} [${task.status || 'unknown'}]: ${summary}`;
      })
      .join('\n');
  } catch {
    return '';
  }
}

async function loadRecentChat(roomId: string): Promise<string> {
  if (!isSupabaseConfiguredLocal()) return '';
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('room_chat_messages')
      .select('user_name, content, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(15);

    return ((data || []) as { user_name?: string; content?: string }[])
      .reverse()
      .map((message) => `${message.user_name || 'Teammate'}: ${message.content || ''}`)
      .join('\n');
  } catch {
    return '';
  }
}

function extractArtifactSections(context: string): { title: string; body: string }[] {
  const sections: { title: string; body: string }[] = [];
  const regex = /--- ARTIFACT \d+: (.*?) \(([^\n]*)\) ---\n([\s\S]*?)(?=\n--- ARTIFACT \d+:|\n\[END ROOM ARTIFACTS)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(context)) !== null) {
    sections.push({
      title: match[1].trim(),
      body: match[3].trim(),
    });
  }

  return sections;
}

function fallbackReply(
  question: string,
  context: string,
  references: RoomArtifactReference[]
): string {
  const sections = extractArtifactSections(context);
  const ruleSections = sections.filter((section) =>
    references.some(
      (reference) =>
        reference.title === section.title &&
        (reference.isRulebook || reference.type === 'reference' || reference.type === 'note')
    )
  );
  const selected = (ruleSections.length > 0 ? ruleSections : sections).slice(0, 3);

  if (selected.length === 0) {
    return `I could not find any room artifacts to ground this answer in. Upload \`rules.md\`, a rubric, a spec or a research note in **Artifacts**, then ask me again about “${question}”.`;
  }

  const body = selected
    .map((section) => {
      const excerpt = section.body.length > 1_400 ? `${section.body.slice(0, 1_400)}…` : section.body;
      return `**\`${section.title}\`**\n${excerpt}`;
    })
    .join('\n\n');

  return `I am running in offline grounded mode (NVIDIA NIM is not configured), so here is the exact room-artifact context I found for your question:

${body}

Sources: ${selected.map((section) => `\`${section.title}\``).join(', ')}`;
}

function citedArtifacts(
  reply: string,
  references: RoomArtifactReference[]
): RoomArtifactReference[] {
  const lower = reply.toLowerCase();
  const cited = references.filter((reference) => {
    const title = reference.title.toLowerCase();
    return title.length >= 3 && lower.includes(title);
  });
  return cited.length > 0 ? cited : references.slice(0, 4);
}

export async function answerMica(input: {
  roomId: string;
  message: string;
  history?: MicaHistoryMessage[];
  userId?: string;
  userName?: string;
}): Promise<MicaAnswer> {
  const roomId = String(input.roomId || '').trim();
  const question = String(input.message || '').trim();

  const [artifactsContext, roomName, summariesContext, recentChat] = await Promise.all([
    getRoomArtifactsContext(roomId, question),
    loadRoomName(roomId),
    loadSummaries(roomId),
    input.history && input.history.length > 0
      ? Promise.resolve(
          input.history
            .slice(-MAX_HISTORY)
            .map((message) => `${message.role === 'user' ? 'Teammate' : 'MICA'}: ${message.content}`)
            .join('\n')
        )
      : loadRecentChat(roomId),
  ]);

  if (!question) {
    return {
      reply: 'Ask me anything about this room. I read your Artifacts, rules.md, research notes, specs and saved AI task summaries.',
      referencedArtifacts: [],
      loadedArtifacts: artifactsContext.artifacts,
      usedFallback: true,
      hasRulebook: artifactsContext.hasRulebook,
    };
  }

  if (!isNimConfigured()) {
    const reply = fallbackReply(question, artifactsContext.context, artifactsContext.artifacts);
    return {
      reply,
      referencedArtifacts: citedArtifacts(reply, artifactsContext.artifacts),
      loadedArtifacts: artifactsContext.artifacts,
      usedFallback: true,
      hasRulebook: artifactsContext.hasRulebook,
    };
  }

  try {
    const response = await nimClient.callNimRaw(
      [
        { role: 'system', content: buildSystemPrompt() },
        {
          role: 'user',
          content: buildUserPrompt({
            roomName,
            question,
            artifactsContext: artifactsContext.context,
            summariesContext,
            chatContext: recentChat,
          }),
        },
      ],
      undefined,
      0.2,
      1_400
    );

    const reply =
      response.choices[0]?.message?.content?.trim() ||
      fallbackReply(question, artifactsContext.context, artifactsContext.artifacts);

    return {
      reply,
      referencedArtifacts: citedArtifacts(reply, artifactsContext.artifacts),
      loadedArtifacts: artifactsContext.artifacts,
      usedFallback: false,
      hasRulebook: artifactsContext.hasRulebook,
    };
  } catch (error) {
    console.warn('[mica] NIM call failed, using grounded fallback:', error);
    const reply = fallbackReply(question, artifactsContext.context, artifactsContext.artifacts);
    return {
      reply,
      referencedArtifacts: citedArtifacts(reply, artifactsContext.artifacts),
      loadedArtifacts: artifactsContext.artifacts,
      usedFallback: true,
      hasRulebook: artifactsContext.hasRulebook,
    };
  }
}
