// ============================================================================
// TrackMyWork - Nexconn Platform Chat API (server only)
// Issues user access tokens and sends system messages. The App Secret never
// leaves the server; the browser only ever receives a short-lived token.
// ============================================================================

import { createHash, randomBytes } from 'node:crypto';
import {
  COURTROOM_BOT_NAME,
  COURTROOM_BOT_USER_ID,
  MICA_BOT_NAME,
  MICA_BOT_USER_ID,
} from './shared';

const DEFAULT_BASE_URL = 'https://api.sg-light-api.com';

export function isNexconnConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_NEXCONN_APP_KEY && process.env.NEXCONN_APP_SECRET
  );
}

function getBaseUrl(): string {
  const raw = process.env.NEXCONN_API_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const withScheme = raw.startsWith('http') ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, '');
}

type NexconnApiResponse<T> = {
  code: number;
  result?: T;
  errorMessage?: string;
};

/**
 * Signs and executes a Platform Chat API request.
 * Signature = SHA1(AppSecret + Nonce + TimestampMillis), hex encoded.
 */
async function nexconnRequest<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const appKey = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY;
  const appSecret = process.env.NEXCONN_APP_SECRET;

  if (!appKey || !appSecret) {
    throw new Error('NEXCONN_NOT_CONFIGURED');
  }

  const nonce = randomBytes(8).toString('hex'); // 16 chars, max 18
  const timestamp = Date.now().toString();
  const signature = createHash('sha1')
    .update(`${appSecret}${nonce}${timestamp}`)
    .digest('hex');

  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'App-Key': appKey,
      Nonce: nonce,
      Timestamp: timestamp,
      Signature: signature,
      'Content-Type': 'application/json',
      'X-Request-ID': randomBytes(16).toString('hex'),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Nexconn ${path} failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as NexconnApiResponse<T>;

  if (payload.code !== 0) {
    throw new Error(
      `Nexconn ${path} failed with code ${payload.code}${
        payload.errorMessage ? `: ${payload.errorMessage}` : ''
      }`
    );
  }

  return (payload.result ?? {}) as T;
}

export async function issueNexconnAccessToken(params: {
  userId: string;
  name: string;
  avatarUrl?: string | null;
}): Promise<{ accessToken: string; userId: string }> {
  const body: Record<string, unknown> = {
    userId: params.userId,
    name: params.name.slice(0, 64) || params.userId,
  };

  if (params.avatarUrl) {
    body.avatarUrl = params.avatarUrl.slice(0, 1024);
  }

  const result = await nexconnRequest<{
    accessToken: string;
    userId: string;
  }>('/v4/auth/access-token/issue', body);

  if (!result.accessToken) {
    throw new Error('Nexconn did not return an access token.');
  }

  return result;
}

let courtroomBotTokenPromise: Promise<void> | null = null;

/**
 * The Server API requires the sender to have obtained an access token at
 * least once so push payloads can resolve sender info.
 */
export async function ensureCourtroomBotRegistered(): Promise<void> {
  if (!courtroomBotTokenPromise) {
    courtroomBotTokenPromise = issueNexconnAccessToken({
      userId: COURTROOM_BOT_USER_ID,
      name: COURTROOM_BOT_NAME,
    })
      .then(() => undefined)
      .catch((error) => {
        courtroomBotTokenPromise = null;
        throw error;
      });
  }

  return courtroomBotTokenPromise;
}

let micaTokenPromise: Promise<void> | null = null;

/** Registers the MICA agent identity with Nexconn (idempotent). */
export async function ensureMicaRegistered(): Promise<void> {
  if (!micaTokenPromise) {
    micaTokenPromise = issueNexconnAccessToken({
      userId: MICA_BOT_USER_ID,
      name: MICA_BOT_NAME,
    })
      .then(() => undefined)
      .catch((error) => {
        micaTokenPromise = null;
        throw error;
      });
  }

  return micaTokenPromise;
}

export async function sendNexconnGroupText(params: {
  fromUserId: string;
  channelId: string;
  text: string;
  pushContent?: string;
}): Promise<{ messageId: string | null }> {
  const content = JSON.stringify({ content: params.text });

  const result = await nexconnRequest<{
    messageIds: Array<{ channelId: string; messageId: string }>;
  }>('/v4/group-channel/message/send', {
    fromUserId: params.fromUserId,
    toChannelIds: [params.channelId],
    messageType: 'RC:TxtMsg',
    content,
    pushContent: (params.pushContent ?? params.text).slice(0, 120),
    shouldPersist: 1,
    isEchoToSender: 0,
  });

  return { messageId: result?.messageIds?.[0]?.messageId ?? null };
}
