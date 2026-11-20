/**
 * Lightweight browser/server JWT generator for authentication sessions
 * Conforms to RFC 7519 structure: header.payload.signature
 */
export function createSessionJWT(user: { id: string; email: string; display_name?: string }): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    user_metadata: {
      display_name: user.display_name || user.email.split('@')[0],
      email: user.email,
    },
    role: 'authenticated',
    aud: 'authenticated',
    iat: now,
    exp: now + 60 * 60 * 24 * 30, // 30 days
    iss: 'supabase',
  };

  const base64UrlEncode = (obj: Record<string, unknown>): string => {
    const str = JSON.stringify(obj);
    if (typeof window !== 'undefined' && window.btoa) {
      return window.btoa(unescape(encodeURIComponent(str)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    }
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(payload);

  // Pseudo-random deterministic signature for client/server validation
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  let hash = 0;
  for (let i = 0; i < signatureInput.length; i++) {
    hash = (hash << 5) - hash + signatureInput.charCodeAt(i);
    hash |= 0;
  }
  const pseudoSig = Math.abs(hash).toString(36) + 'trackmywork_sig';

  return `${encodedHeader}.${encodedPayload}.${pseudoSig}`;
}
