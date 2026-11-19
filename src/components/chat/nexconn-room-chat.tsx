'use client';

// ============================================================================
// TrackMyWork - Team Chat (Phase 7)
// Live per-room Nexconn chat channel bridged to the AI Courtroom.
// All SDK/WebSocket work is confined to this client component.
// ============================================================================

import * as React from 'react';
import {
  AlertTriangle,
  Gavel,
  Hash,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  COURTROOM_BOT_USER_ID,
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
}

// ---------------------------------------------------------------------------
// Module-level SDK singleton (one connection per browser session)
// ---------------------------------------------------------------------------

let sdkPromise: Promise<NexconnSdk> | null = null;
let sdkInitialized = false;
let connectPromise: Promise<{ ok: boolean; error?: string }> | null = null;
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
  if (!result.ok) {
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

  return {
    id: message.messageId,
    senderId: message.senderUserId,
    senderName:
      senderInfo?.name || senderInfo?.alias || message.senderUserId || 'Unknown',
    text,
    sentTime: message.sentTime,
    isBot: message.senderUserId === COURTROOM_BOT_USER_ID,
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

function connectionLabel(status: number | null): string {
  if (status === null) return 'Connecting';
  if (status === 0) return 'Live';
  if (status === 1) return 'Connecting';
  if (status === 3) return 'Reconnecting';
  return 'Offline';
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

  const sdkRef = React.useRef<NexconnSdk | null>(null);
  const channelRef = React.useRef<GroupChannel | null>(null);
  const queryRef = React.useRef<MessagesQuery | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

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

        // Snapshot the unread badge before marking this channel as read.
        const unread = await sdk.BaseChannel.getTotalUnreadCount();
        if (!disposed && unread.isOk) {
          setTotalUnread(unread.data ?? 0);
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
  }, [messages.length]);

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

  // ---- Send (including /courtroom) --------------------------------------
  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const sdk = sdkRef.current;
    const channel = channelRef.current;
    const text = draft.trim();

    if (!sdk || !channel || !text || sending) return;

    setSending(true);
    setError(null);

    try {
      if (/^\/courtroom(\s|$)/i.test(text)) {
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

  return (
    <div className="flex h-full flex-col bg-white">
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
              {totalUnread} unread
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
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
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
                      message.isBot
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {message.isBot ? (
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
                      : message.isBot
                        ? 'rounded-bl-sm border border-amber-200 bg-amber-50 text-amber-950'
                        : 'rounded-bl-sm border bg-white text-foreground'
                  )}
                >
                  {!isOwn && (
                    <p
                      className={cn(
                        'mb-0.5 text-[11px] font-semibold',
                        message.isBot ? 'text-amber-700' : 'text-muted-foreground'
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

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 border-t bg-white px-4 py-3">
        {error && phase !== 'error' && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}

        <form onSubmit={handleSend} className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            placeholder="Message the room…  (Shift+Enter for a new line)"
            className="max-h-32 min-h-[42px] flex-1 resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            disabled={phase !== 'ready' || sending}
          />
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

        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Type <code className="rounded bg-muted px-1">/courtroom &lt;motion&gt;</code>{' '}
          to start an AI Courtroom trial. You are{' '}
          <span className="font-medium">{currentUserName}</span>.
        </p>
      </div>
    </div>
  );
}
