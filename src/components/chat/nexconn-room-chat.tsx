'use client';

// ============================================================================
// TrackMyWork - Team Chat (Phase 7)
// Live per-room Nexconn chat channel bridged to the AI Courtroom.
// All SDK/WebSocket work is confined to this client component.
// ============================================================================

import * as React from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bot,
  Check,
  Gavel,
  Hash,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  COURTROOM_BOT_NAME,
  COURTROOM_BOT_USER_ID,
  MICA_BOT_NAME,
  MICA_BOT_USER_ID,
  getNexconnChannelId,
} from '@/lib/nexconn/shared';
import type {
  AreaCode,
  GroupChannel,
  Message,
  MessagesQuery,
} from '@nexconn/chat';

type NexconnSdk = typeof import('@nexconn/chat');

interface NexconnRoomChatProps {
  roomId: string;
  roomName: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatarUrl: string | null;
  configured: boolean;
}

type ChatPhase = 'idle' | 'connecting' | 'ready' | 'error';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  sentTime: number;
  isBot: boolean;
  isMica: boolean;
}

/** A saved AI summary kept in the room's shared-context drawer. */
interface SavedAiSummary {
  id: string;
  source: string;
  topic: string | null;
  body: string;
  savedAt: number;
  savedBy: string;
}

interface SlashCommand {
  name: string;
  usage: string;
  description: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: '/mica',
    usage: '/mica <prompt>',
    description:
      'Ask MICA (your AI teammate) using full room chat + saved AI summaries as context',
  },
  {
    name: '/courtroom',
    usage: '/courtroom <motion>',
    description:
      'Launch an adversarial 7-agent AI Courtroom trial on a technical/project motion',
  },
  {
    name: '/help',
    usage: '/help',
    description:
      'Show quick inline usage guide for /mica, /courtroom, and + AI Summary',
  },
];

// ---------------------------------------------------------------------------
// Module-level SDK singleton (one connection per browser session)
// ---------------------------------------------------------------------------

let sdkPromise: Promise<NexconnSdk> | null = null;
let sdkInitialized = false;
let connectPromise: Promise<{ ok: boolean; error?: string }> | null = null;
let connectedToken: string | null = null;
let handlersRegistered = false;

const messageListeners = new Set<(messages: Message<any>[]) => void>();
const statusListeners = new Set<(status: number) => void>();

function loadSdk(): Promise<NexconnSdk> {
  if (!sdkPromise) {
    sdkPromise = import('@nexconn/chat');
  }
  return sdkPromise;
}

function initSdk(sdk: NexconnSdk): void {
  if (sdkInitialized) return;

  const appKey = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY;
  if (!appKey) {
    throw new Error('NEXT_PUBLIC_NEXCONN_APP_KEY is missing.');
  }

  const areaName = (process.env.NEXT_PUBLIC_NEXCONN_AREA_CODE || 'SG').toUpperCase();
  const areaCode = ((sdk.AreaCode as unknown as Record<string, number>)[
    areaName
  ] ?? sdk.AreaCode.SG) as AreaCode;

  sdk.NCEngine.initialize({ appKey, areaCode });
  sdkInitialized = true;
}

function registerHandlers(sdk: NexconnSdk): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  sdk.NCEngine.addConnectionStatusHandler(
    'tmw-connection-status',
    new sdk.ConnectionStatusHandler({
      onConnectionStatusChanged({ status }) {
        statusListeners.forEach((listener) => listener(status));
      },
    })
  );

  sdk.NCEngine.addMessageHandler(
    'tmw-room-messages',
    new sdk.MessageHandler({
      onMessageReceived({ messages }) {
        messageListeners.forEach((listener) => listener(messages));
      },
    })
  );
}

async function ensureConnected(
  sdk: NexconnSdk,
  token: string
): Promise<{ ok: boolean; error?: string }> {
  // Same user already connected: the SDK owns reconnection from here.
  if (connectedToken === token) {
    return { ok: true };
  }

  // A different Supabase user signed in on this browser session.
  if (connectedToken && connectedToken !== token) {
    await sdk.NCEngine.disconnect().catch(() => undefined);
    connectedToken = null;
    connectPromise = null;
  }

  if (!connectPromise) {
    connectPromise = sdk.NCEngine.connect({ token })
      .then((result) =>
        result.isOk
          ? { ok: true }
          : { ok: false, error: `${result.code}: ${result.msg}` }
      )
      .catch((error: unknown) => ({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }));
  }

  const result = await connectPromise;
  if (result.ok) {
    connectedToken = token;
  } else {
    connectPromise = null;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toChatMessage(message: Message<any>): ChatMessage {
  const content = (message.content ?? {}) as Record<string, any>;
  const senderInfo = content.senderUserInfo as
    | { name?: string; alias?: string }
    | undefined;

  const text =
    typeof content.text === 'string'
      ? content.text
      : typeof content.content === 'string'
        ? content.content
        : '[Unsupported message type]';

  const isMica = message.senderUserId === MICA_BOT_USER_ID;
  const isBot = message.senderUserId === COURTROOM_BOT_USER_ID || isMica;

  return {
    id: message.messageId,
    senderId: message.senderUserId,
    senderName: isMica
      ? MICA_BOT_NAME
      : isBot
        ? COURTROOM_BOT_NAME
        : senderInfo?.name || senderInfo?.alias || message.senderUserId || 'Unknown',
    text,
    sentTime: message.sentTime,
    isBot,
    isMica,
  };
}

function mergeMessages(
  previous: ChatMessage[],
  incoming: ChatMessage[]
): ChatMessage[] {
  const byId = new Map(previous.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return Array.from(byId.values()).sort((a, b) => a.sentTime - b.sentTime);
}

function formatClock(sentTime: number): string {
  return new Date(sentTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Parse an AI Summary message marker:
 *   [[AI_SUMMARY|source=Gemini|topic=My Topic]]
 *   Actual summary content here...
 *
 * Returns null when the text is not an AI Summary.
 */
interface AiSummaryData {
  source: string;
  topic: string | null;
  body: string;
}

type AiSummarySource = 'Gemini' | 'Claude' | 'ChatGPT' | 'Other';

function parseAiSummary(text: string): AiSummaryData | null {
  const match = text.match(/^\[\[AI_SUMMARY\|([^\]]+)\]\]\n?([\s\S]*)$/);
  if (!match) return null;

  const attrs = match[1];
  const body = match[2].trim();

  const sourceMatch = attrs.match(/source=([^|]+)/);
  const topicMatch = attrs.match(/topic=([^|]+)/);

  return {
    source: sourceMatch?.[1] ?? 'Other',
    topic: topicMatch?.[1] ?? null,
    body,
  };
}

function connectionLabel(status: number | null): string {
  if (status === null) return 'Connecting';
  if (status === 0) return 'Live';
  if (status === 1) return 'Connecting';
  if (status === 3) return 'Reconnecting';
  return 'Offline';
}

// ---------------------------------------------------------------------------
// Shared-context storage
// ---------------------------------------------------------------------------

function parseStoredSummaries(raw: string | null): SavedAiSummary[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is SavedAiSummary => {
        if (!item || typeof item !== 'object') return false;
        const value = item as Record<string, unknown>;
        return (
          typeof value.id === 'string' &&
          typeof value.body === 'string' &&
          value.body.trim().length > 0
        );
      })
      .map((item) => ({
        id: item.id,
        source: typeof item.source === 'string' ? item.source : 'Other',
        topic: typeof item.topic === 'string' ? item.topic : null,
        body: item.body,
        savedAt: typeof item.savedAt === 'number' ? item.savedAt : Date.now(),
        savedBy: typeof item.savedBy === 'string' ? item.savedBy : 'Teammate',
      }))
      .slice(-50);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NexconnRoomChat({
  roomId,
  roomName,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  configured,
}: NexconnRoomChatProps) {
  const channelId = getNexconnChannelId(roomId);

  const [phase, setPhase] = React.useState<ChatPhase>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [hasOlder, setHasOlder] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState<number | null>(
    null
  );
  const [totalUnread, setTotalUnread] = React.useState(0);
  const [retryKey, setRetryKey] = React.useState(0);

  // ---- AI Summary composer state ------------------------------------------
  const [aiSummaryOpen, setAiSummaryOpen] = React.useState(false);
  const [aiSource, setAiSource] = React.useState<AiSummarySource>('Gemini');
  const [aiTopic, setAiTopic] = React.useState('');
  const [aiSummaryText, setAiSummaryText] = React.useState('');
  const [aiSummarySent, setAiSummarySent] = React.useState(false);
  const [savedSummaries, setSavedSummaries] = React.useState<SavedAiSummary[]>([]);
  const [contextOpen, setContextOpen] = React.useState(false);

  // ---- MICA / slash command state ----------------------------------------
  const [micaThinking, setMicaThinking] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [slashDismissed, setSlashDismissed] = React.useState(false);
  const [slashIndex, setSlashIndex] = React.useState(0);

  const sdkRef = React.useRef<NexconnSdk | null>(null);
  const channelRef = React.useRef<GroupChannel | null>(null);
  const queryRef = React.useRef<MessagesQuery | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const summaryTimerRef = React.useRef<number | null>(null);

  // ---- Load saved summaries for this room --------------------------------
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`tmw:room-ai-summaries:${roomId}`);
      setSavedSummaries(parseStoredSummaries(raw));
    } catch {
      setSavedSummaries([]);
    }
  }, [roomId]);

  React.useEffect(
    () => () => {
      if (summaryTimerRef.current !== null) {
        window.clearTimeout(summaryTimerRef.current);
      }
    },
    []
  );

  const persistSummaries = React.useCallback(
    (summaries: SavedAiSummary[]) => {
      try {
        window.localStorage.setItem(
          `tmw:room-ai-summaries:${roomId}`,
          JSON.stringify(summaries)
        );
      } catch {
        // Storage can be unavailable (private mode); the drawer still works
        // for the current session.
      }
    },
    [roomId]
  );

  const removeSavedSummary = React.useCallback(
    (id: string) => {
      setSavedSummaries((previous) => {
        const next = previous.filter((summary) => summary.id !== id);
        persistSummaries(next);
        return next;
      });
    },
    [persistSummaries]
  );

  // ---- Connect, join the room channel, load history ----------------------
  React.useEffect(() => {
    if (!configured) return;

    let disposed = false;

    // Reset room-scoped state when navigating between rooms (or retrying).
    channelRef.current = null;
    queryRef.current = null;
    setMessages([]);
    setHasOlder(false);
    setTotalUnread(0);

    const onMessages = (incoming: Message<any>[]) => {
      const forThisChannel = incoming
        .filter((message) => message.channelIdentifier?.channelId === channelId)
        .map(toChatMessage);

      if (forThisChannel.length > 0) {
        setMessages((previous) => mergeMessages(previous, forThisChannel));
      }
    };

    const onStatus = (status: number) => {
      setConnectionStatus(status);
    };

    messageListeners.add(onMessages);
    statusListeners.add(onStatus);

    const connect = async () => {
      try {
        setPhase('connecting');
        setError(null);

        const sdk = await loadSdk();
        if (disposed) return;

        sdkRef.current = sdk;
        initSdk(sdk);
        registerHandlers(sdk);
        setConnectionStatus(sdk.NCEngine.getConnectionStatus());

        const tokenResponse = await fetch('/api/nexconn/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId }),
        });
        const tokenPayload = (await tokenResponse.json().catch(() => null)) as
          | { token?: string; error?: string }
          | null;

        if (disposed) return;

        if (!tokenResponse.ok || !tokenPayload?.token) {
          throw new Error(
            tokenPayload?.error || 'Could not obtain a Nexconn access token.'
          );
        }

        const connection = await ensureConnected(sdk, tokenPayload.token);
        if (disposed) return;

        if (!connection.ok) {
          throw new Error(
            `Could not connect to Nexconn${connection.error ? ` (${connection.error})` : ''}.`
          );
        }

        // 25412 means the user is already a member, which is a success for us.
        const ALREADY_MEMBER = 25412;

        const channel = new sdk.GroupChannel(channelId);
        let joinResult = await channel.join();

        // First visitor provisions the room channel. Join permission is FREE
        // so every teammate can join without an approval flow. Creating the
        // group also makes its creator a member.
        if (!joinResult.isOk && joinResult.code !== ALREADY_MEMBER) {
          await sdk.GroupChannel.createGroup({
            groupId: channelId,
            groupName: `TrackMyWork · ${roomName}`.slice(0, 64),
            joinPermission: sdk.GroupJoinPermission.FREE,
          }).catch(() => undefined);

          joinResult = await channel.join();
        }

        if (disposed) return;

        if (!joinResult.isOk && joinResult.code !== ALREADY_MEMBER) {
          throw new Error(
            `Could not join the room channel (${joinResult.code}: ${joinResult.msg}).`
          );
        }

        channelRef.current = channel;

        const query = sdk.BaseChannel.createMessagesQuery({
          channelIdentifier: channel.identifier,
          startTime: Date.now(),
          pageSize: 30,
          isAscending: false,
        });
        queryRef.current = query;

        const history = await query.loadNextPage();
        if (disposed) return;

        if (history.isOk && history.data?.data) {
          setMessages(
            mergeMessages([], history.data.data.map(toChatMessage))
          );
        }
        setHasOlder(query.hasNext);

        // Show unread activity from other channels, then mark this one read.
        const channelUnread = channel.unreadCount;
        const unread = await sdk.BaseChannel.getTotalUnreadCount();
        if (!disposed && unread.isOk) {
          setTotalUnread(
            Math.max(0, (unread.data ?? 0) - channelUnread)
          );
        }

        await channel.clearUnreadCount();

        if (!disposed) {
          setPhase('ready');
        }
      } catch (err) {
        if (disposed) return;
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
      }
    };

    void connect();

    return () => {
      disposed = true;
      messageListeners.delete(onMessages);
      statusListeners.delete(onStatus);
    };
  }, [configured, roomId, roomName, channelId, retryKey]);

  // ---- Auto-scroll on new messages ---------------------------------------
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, micaThinking]);

  // ---- Older history -----------------------------------------------------
  const loadOlder = React.useCallback(async () => {
    const query = queryRef.current;
    if (!query || loadingOlder) return;

    setLoadingOlder(true);
    try {
      const page = await query.loadNextPage();
      const older = page.data?.data;

      if (page.isOk && older) {
        setMessages((previous) =>
          mergeMessages(previous, older.map(toChatMessage))
        );
        setHasOlder(query.hasNext);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder]);

  // ---- MICA: ask the in-room agent ---------------------------------------
  const requestMicaReply = React.useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;

      setMicaThinking(true);
      setError(null);

      try {
        const recentMessages = messages.slice(-20).map((message) => ({
          senderName: message.senderName,
          text: message.text,
        }));
        const summaries = savedSummaries.map((summary) => ({
          source: summary.source,
          topic: summary.topic,
          body: summary.body,
        }));

        const response = await fetch('/api/chat/ai-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, prompt, recentMessages, summaries }),
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              text?: string;
              messageId?: string | null;
              senderId?: string;
              senderName?: string;
              sentTime?: number;
              error?: string;
            }
          | null;

        if (!response.ok || !payload?.text) {
          throw new Error(payload?.error || 'MICA could not reply.');
        }

        const reply: ChatMessage = {
          id: payload.messageId || `mica-${Date.now()}`,
          senderId: payload.senderId || MICA_BOT_USER_ID,
          senderName: payload.senderName || MICA_BOT_NAME,
          text: payload.text,
          sentTime: payload.sentTime ?? Date.now(),
          isBot: true,
          isMica: true,
        };

        setMessages((previous) => mergeMessages(previous, [reply]));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setMicaThinking(false);
      }
    },
    [messages, roomId, savedSummaries]
  );

  // ---- Save an AI summary into the room's shared context ----------------
  const handleSaveAiSummary = () => {
    const body = aiSummaryText.trim();
    if (!body) return;

    const summary: SavedAiSummary = {
      id: `summary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: aiSource,
      topic: aiTopic.trim() || null,
      body,
      savedAt: Date.now(),
      savedBy: currentUserName,
    };

    const next = [...savedSummaries, summary].slice(-50);
    setSavedSummaries(next);
    persistSummaries(next);

    setAiSummarySent(true);
    if (summaryTimerRef.current !== null) {
      window.clearTimeout(summaryTimerRef.current);
    }
    summaryTimerRef.current = window.setTimeout(() => {
      summaryTimerRef.current = null;
      setAiSummarySent(false);
      setAiSummaryOpen(false);
      setAiTopic('');
      setAiSummaryText('');
    }, 1200);
  };

  // ---- Send (including /courtroom) --------------------------------------
  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const sdk = sdkRef.current;
    const channel = channelRef.current;
    const text = draft.trim();

    if (!sdk || !channel || !text || sending) return;

    // Local-only help card: never posted to the group channel.
    if (/^\/help(\s|$)/i.test(text)) {
      setHelpOpen(true);
      setDraft('');
      setSlashDismissed(true);
      return;
    }

    setSending(true);
    setError(null);

    try {
      if (/^\/mica(\s|$)/i.test(text)) {
        const prompt = text.replace(/^\/mica\s*/i, '').trim();

        if (!prompt) {
          throw new Error('Usage: /mica <prompt>');
        }

        // Show the question to the whole room first, then let MICA answer.
        const question = await channel.sendMessage(
          new sdk.SendTextMessageParams({ text })
        );

        if (!question.isOk) {
          throw new Error(
            `MICA question failed to send (${question.code}: ${question.msg}).`
          );
        }

        if (question.data) {
          setMessages((previous) =>
            mergeMessages(previous, [toChatMessage(question.data!)])
          );
        }

        void requestMicaReply(prompt);
      } else if (/^\/courtroom(\s|$)/i.test(text)) {
        const motion = text.replace(/^\/courtroom\s*/i, '').trim();

        if (!motion) {
          throw new Error('Usage: /courtroom <motion>');
        }

        const response = await fetch('/api/courtroom/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, motion }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload?.error || 'Could not convene the AI Courtroom.');
        }

        const announcement = await channel.sendMessage(
          new sdk.SendTextMessageParams({
            text: '⚖️ AI Courtroom convened! Watch live in the AI Courtroom tab.',
          })
        );

        if (!announcement.isOk) {
          throw new Error(
            `Courtroom started, but the chat announcement failed (${announcement.code}).`
          );
        }

        if (announcement.data) {
          setMessages((previous) =>
            mergeMessages(previous, [toChatMessage(announcement.data!)])
          );
        }
      } else {
        const result = await channel.sendMessage(
          new sdk.SendTextMessageParams({ text })
        );

        if (!result.isOk) {
          throw new Error(`Message failed to send (${result.code}: ${result.msg}).`);
        }

        if (result.data) {
          setMessages((previous) =>
            mergeMessages(previous, [toChatMessage(result.data!)])
          );
        }
      }

      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  // ---- Not configured ----------------------------------------------------
  if (!configured) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="mx-auto max-w-xl rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600">
            <ShieldAlert className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Team Chat needs Nexconn keys</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Add these variables to <code className="rounded bg-muted px-1">.env.local</code>{' '}
            and restart the dev server. The App Secret is only read on the server.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              'NEXT_PUBLIC_NEXCONN_APP_KEY',
              'NEXCONN_APP_SECRET',
              'NEXT_PUBLIC_NEXCONN_AREA_CODE',
              'NEXCONN_API_BASE_URL',
            ].map((key) => (
              <li
                key={key}
                className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs"
              >
                {key}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Find the App Key, App Secret, and data center on the Nexconn Console
            Key Management page.
          </p>
        </div>
      </div>
    );
  }

  const isLive = connectionStatus === 0;
  const label = connectionLabel(connectionStatus);

  // ---- Slash command palette ---------------------------------------------
  const slashQuery =
    draft.startsWith('/') && !/\s/.test(draft)
      ? draft.slice(1).toLowerCase()
      : null;
  const slashMatches =
    slashQuery === null
      ? []
      : SLASH_COMMANDS.filter((command) =>
          command.name.slice(1).startsWith(slashQuery)
        );
  const slashMenuOpen =
    phase === 'ready' && !slashDismissed && slashMatches.length > 0;
  const activeSlashIndex = Math.min(
    slashIndex,
    Math.max(slashMatches.length - 1, 0)
  );

  const applySlashCommand = (command: SlashCommand) => {
    setDraft(`${command.name} `);
    setSlashDismissed(true);
    setSlashIndex(0);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex h-[calc(100vh-11.5rem)] max-h-[calc(100vh-11.5rem)] flex-col bg-white">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
            <Hash className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Team Chat</h2>
            <p className="font-mono text-[11px] text-muted-foreground">
              {channelId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">
              {totalUnread} unread elsewhere
            </span>
          )}
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
              isLive
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {isLive ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            {label}
          </span>
          <button
            type="button"
            onClick={() => setContextOpen((open) => !open)}
            aria-expanded={contextOpen}
            title="Shared AI summaries used as MICA context"
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              'border-input bg-white text-muted-foreground hover:bg-muted'
            )}
          >
            <BookOpen className="h-3 w-3" />
            Context <span>({savedSummaries.length})</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 pb-10"
      >
        {phase === 'connecting' && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Connecting to the room channel…
          </div>
        )}

        {phase === 'error' && (
          <div className="mx-auto mt-6 max-w-lg rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-semibold">Team Chat unavailable</p>
            </div>
            <p className="mt-2 break-words text-sm text-red-700">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setMessages([]);
                setRetryKey((key) => key + 1);
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        {phase !== 'error' && hasOlder && (
          <div className="mb-4 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
            >
              {loadingOlder ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Load earlier messages
            </Button>
          </div>
        )}

        {phase === 'ready' && messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-md text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
              <Hash className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium">This is the start of the room channel.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Say hello, share a status update, or type{' '}
              <code className="rounded bg-muted px-1">/courtroom &lt;motion&gt;</code>{' '}
              to convene the AI Courtroom.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((message) => {
            const isOwn = message.senderId === currentUserId;

            return (
              <div
                key={message.id}
                className={cn(
                  'flex w-full gap-2',
                  isOwn ? 'justify-end' : 'justify-start'
                )}
              >
                {!isOwn && (
                  <div
                    className={cn(
                      'mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase',
                      message.isMica
                        ? 'bg-emerald-100 text-emerald-700'
                        : message.isBot
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {message.isMica ? (
                      <Bot className="h-3.5 w-3.5" />
                    ) : message.isBot ? (
                      <Gavel className="h-3.5 w-3.5" />
                    ) : (
                      message.senderName.slice(0, 2)
                    )}
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                    isOwn
                      ? 'rounded-br-sm bg-primary-600 text-white'
                      : message.isMica
                        ? 'rounded-bl-sm border border-emerald-200 bg-emerald-50 text-emerald-950'
                        : message.isBot
                          ? 'rounded-bl-sm border border-amber-200 bg-amber-50 text-amber-950'
                          : 'rounded-bl-sm border bg-white text-foreground'
                  )}
                >
                  {!isOwn && (
                    <p
                      className={cn(
                        'mb-0.5 text-[11px] font-semibold',
                        message.isMica
                          ? 'text-emerald-700'
                          : message.isBot
                            ? 'text-amber-700'
                            : 'text-muted-foreground'
                      )}
                    >
                      {message.senderName}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                  <p
                    className={cn(
                      'mt-1 text-right text-[10px]',
                      isOwn ? 'text-white/70' : 'text-muted-foreground'
                    )}
                  >
                    {formatClock(message.sentTime)}
                  </p>
                </div>

                {isOwn && (
                  <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-[10px] font-semibold uppercase text-white">
                    {(currentUserName || currentUserAvatarUrl || 'You')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {micaThinking && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            MICA is thinking…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Context / Shared Summaries drawer */}
      {contextOpen && (
        <div
          className="absolute inset-0 z-50 flex flex-col bg-white"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex-shrink-0 border-b px-4 py-3">
            <button
              type="button"
              onClick={() => setContextOpen(false)}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" /> Shared Context
            </button>
            <p className="mt-1 text-xs text-muted-foreground">
              Saved AI summaries used as background context for{' '}
              <span className="font-semibold">/mica</span>.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {savedSummaries.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <BookOpen className="h-8 w-8 opacity-20" />
                <p>No saved summaries yet.</p>
                <p className="text-[11px]">
                  Use <span className="font-mono">+ AI Summary</span> to save one.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {savedSummaries.map((summary) => (
                  <li
                    key={summary.id}
                    className="flex gap-2 rounded-lg border bg-white p-3 shadow-sm"
                  >
                    <div className="flex-shrink-0">
                      <span className="text-[10px] font-semibold text-purple-700 uppercase">
                        {summary.source}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {summary.topic && (
                        <p className="text-[11px] font-medium text-purple-600 truncate">
                          {summary.topic}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground line-clamp-2 break-words">
                        {summary.body}
                      </p>
                      <p className="mt-1 text-right text-[10px] text-muted-foreground">
                        {formatClock(summary.savedAt)} — {summary.savedBy}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSavedSummary(summary.id)}
                      className="flex-shrink-0 p-1 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="flex-shrink-0 border-t bg-white px-4 pt-3 pb-5">
        {error && phase !== 'error' && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}

        {/* Slash command palette */}
        {slashMenuOpen && (
          <div
            className="absolute bottom-[60px] left-4 right-4 flex flex-col gap-1"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="flex flex-col gap-0.5">
              {slashMatches.map((command, index) => (
                <button
                  key={command.name}
                  type="button"
                  onClick={() => applySlashCommand(command)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 rounded border border-input bg-white px-2 py-1.5 text-xs text-sm font-medium transition-colors',
                    index === activeSlashIndex
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <span className="font-mono text-purple-600">{command.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[200px]">
                    {command.description}
                  </span>
                  {index === activeSlashIndex && (
                    <span className="text-[10px] font-semibold text-purple-600">↵</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => {
              const value = event.target.value;
              setDraft(value);
              if (!value.startsWith('/')) {
                setSlashDismissed(false);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
                return;
              }

              if (!slashMenuOpen) return;

              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSlashIndex((prev) =>
                  prev < slashMatches.length - 1 ? prev + 1 : prev
                );
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSlashIndex((prev) =>
                  prev > 0 ? prev - 1 : slashMatches.length - 1
                );
              } else if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                applySlashCommand(slashMatches[activeSlashIndex]);
              } else if (event.key === 'Escape') {
                setSlashDismissed(true);
              }
            }}
            rows={1}
            placeholder="Message the room…  (Shift+Enter for a new line)"
            className="max-h-32 min-h-[42px] flex-1 resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            disabled={phase !== 'ready' || sending}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAiSummaryOpen((open) => !open)}
            disabled={phase !== 'ready' || sending}
            className="h-[42px] gap-1"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">+ AI Summary</span>
          </Button>
          <Button
            type="submit"
            disabled={phase !== 'ready' || sending || !draft.trim()}
            className="h-[42px]"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">Send message</span>
          </Button>
        </form>

        {/* AI Summary popover — saves to shared context, not the feed */}
        {aiSummaryOpen && (
          <div
            className="mt-2 rounded-xl border border-purple-200 bg-purple-50 p-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-purple-800">Save AI Summary</h3>
            </div>

            <div className="mb-2">
              <label className="block text-[10px] uppercase font-semibold text-purple-700 mb-1">
                AI Source
              </label>
              <select
                value={aiSource}
                onChange={(e) => setAiSource(e.target.value as AiSummarySource)}
                className="w-full rounded border border-purple-200 bg-white px-2 py-1.5 text-sm text-purple-800 focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option value="Gemini">Gemini</option>
                <option value="Claude">Claude</option>
                <option value="ChatGPT">ChatGPT</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="mb-2">
              <label className="block text-[10px] uppercase font-semibold text-purple-700 mb-1">
                Topic / Title (optional)
              </label>
              <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="e.g. Architecture decision"
                className="w-full rounded border border-purple-200 bg-white px-2 py-1.5 text-sm text-purple-800 focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            <div className="mb-2">
              <label className="block text-[10px] uppercase font-semibold text-purple-700 mb-1">
                Summary
              </label>
              <textarea
                value={aiSummaryText}
                onChange={(e) => setAiSummaryText(e.target.value)}
                rows={3}
                placeholder="Paste your external AI chat summary here…"
                className="w-full rounded border border-purple-200 bg-white px-2 py-1.5 text-sm text-purple-800 focus:ring-2 focus:ring-purple-500 outline-none resize-y"
              />
            </div>

            {aiSummarySent && (
              <div className="mb-2 flex items-center gap-2 rounded bg-emerald-50 px-2 py-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-[10px] font-semibold text-emerald-700">
                  ✓ Sent to MICA context
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAiSummaryOpen(false)}
                className="text-purple-600 hover:bg-purple-100"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveAiSummary}
                disabled={!aiSummaryText.trim()}
                className="bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {aiSummarySent ? (
                  <Check className="mr-2 h-3.5 w-3.5" />
                ) : (
                  <Send className="mr-2 h-3.5 w-3.5" />
                )}
                {aiSummarySent ? 'Saved' : 'Save Summary'}
              </Button>
            </div>
          </div>
        )}

        {/* Local /help card (never posted to the group channel) */}
        {helpOpen && (
          <div className="mt-2 rounded-xl border border-purple-200 bg-purple-50 p-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-1.5 mb-2">
              <BookOpen className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-purple-800">Slash Commands</h3>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="ml-auto p-1 text-purple-400 hover:text-purple-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2 text-xs text-purple-900">
              {SLASH_COMMANDS.map((command) => (
                <li key={command.name} className="flex justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold">{command.name}</span>{' '}
                    <span className="font-mono text-[10px] text-purple-600">{command.usage.slice(command.name.length + 1)}</span>
                  </div>
                  <p className="text-[10px] text-purple-700 leading-relaxed">
                    {command.description}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-purple-600">
              Summaries saved via{' '}
              <span className="font-semibold">+ AI Summary</span>{' '}
              are shared room context for MICA.
            </p>
          </div>
        )}

        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Type <code className="rounded bg-muted px-1">/mica &lt;prompt&gt;</code>{' '}
          to ask MICA using room chat + saved summaries, or{' '}
          <code className="rounded bg-muted px-1">/courtroom &lt;motion&gt;</code>{' '}
          to start an AI Courtroom trial. You are{' '}
          <span className="font-medium">{currentUserName}</span>.
        </p>
      </div>
    </div>
  );
}
