import crypto from 'crypto';

/**
 * GitHub App helpers.
 *
 * TrackMyWork connects rooms to repositories through a GitHub App
 * installation (not a plain OAuth app) so the app can receive webhooks for
 * every installed repository and read repository metadata with an
 * installation access token.
 */

const GITHUB_API = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const STATE_MAX_AGE_MS = 15 * 60 * 1000;

export interface GitHubInstallationRepo {
  id: number;
  full_name: string;
  html_url: string;
  private: boolean;
  owner: { login: string };
}

export interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    type: string;
    avatar_url?: string | null;
  };
}

export interface GitHubStatePayload {
  roomId: string;
  userId: string;
  ts: number;
  nonce: string;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function getAppCredentials() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyRaw = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKeyRaw) {
    throw new Error(
      'GitHub App is not configured. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY.'
    );
  }

  // Vercel and .env files store newlines escaped as literal "\n".
  return { appId, privateKey: privateKeyRaw.replace(/\\n/g, '\n') };
}

/** Create the short-lived RS256 JWT used to authenticate as the GitHub App. */
export function createAppJwt(): string {
  const { appId, privateKey } = getAppCredentials();
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: appId })
  );
  const unsigned = `${header}.${payload}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsigned)
    .sign(privateKey);

  return `${unsigned}.${base64url(signature)}`;
}

async function githubRequest<T>(
  path: string,
  token: string,
  init?: { method?: string }
): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      'User-Agent': 'TrackMyWork',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `GitHub API ${res.status}: ${body.slice(0, 300) || res.statusText}`
    );
  }

  return (await res.json()) as T;
}

/** Fetch installation metadata (account, id) using an app JWT. */
export async function getInstallation(
  installationId: number
): Promise<GitHubInstallation> {
  return githubRequest<GitHubInstallation>(
    `/app/installations/${installationId}`,
    createAppJwt()
  );
}

/** Exchange the app JWT for a short-lived installation access token. */
export async function createInstallationToken(
  installationId: number
): Promise<string> {
  const data = await githubRequest<{ token: string }>(
    `/app/installations/${installationId}/access_tokens`,
    createAppJwt(),
    { method: 'POST' }
  );
  return data.token;
}

/** List every repository the installation can access. */
export async function listInstallationRepos(
  installationId: number
): Promise<GitHubInstallationRepo[]> {
  const token = await createInstallationToken(installationId);
  const data = await githubRequest<{ repositories: GitHubInstallationRepo[] }>(
    '/installation/repositories?per_page=100',
    token
  );
  return data.repositories ?? [];
}

function getStateSecret(): string {
  const secret =
    process.env.GITHUB_STATE_SECRET ||
    process.env.GITHUB_WEBHOOK_SECRET ||
    process.env.GITHUB_CLIENT_SECRET;

  if (!secret) {
    throw new Error(
      'GitHub state secret is not configured. Set GITHUB_STATE_SECRET or GITHUB_WEBHOOK_SECRET.'
    );
  }

  return secret;
}

/**
 * Sign a room/user binding for the install round-trip. The value is stored in
 * an httpOnly cookie and (when supported) passed through GitHub as `state`.
 */
export function signGitHubState(payload: {
  roomId: string;
  userId: string;
}): string {
  const full: GitHubStatePayload = {
    ...payload,
    ts: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  const data = base64url(JSON.stringify(full));
  const signature = crypto
    .createHmac('sha256', getStateSecret())
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

export function verifyGitHubState(
  state: string | null | undefined
): GitHubStatePayload | null {
  if (!state) return null;

  const [data, signature] = state.split('.');
  if (!data || !signature) return null;

  let expected: string;
  try {
    expected = crypto
      .createHmac('sha256', getStateSecret())
      .update(data)
      .digest('base64url');
  } catch {
    return null;
  }

  const provided = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (
    provided.length !== wanted.length ||
    !crypto.timingSafeEqual(provided, wanted)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(data, 'base64url').toString('utf8')
    ) as GitHubStatePayload;

    if (!payload.roomId || !payload.userId || !payload.ts) return null;
    if (Date.now() - payload.ts > STATE_MAX_AGE_MS) return null;

    return payload;
  } catch {
    return null;
  }
}

export function getAppSlug(): string {
  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) {
    throw new Error('GitHub App slug is not configured. Set GITHUB_APP_SLUG.');
  }
  return slug;
}

/** URL that starts the GitHub App installation flow. */
export function getAppInstallUrl(state: string): string {
  return `https://github.com/apps/${getAppSlug()}/installations/new?state=${encodeURIComponent(
    state
  )}`;
}
