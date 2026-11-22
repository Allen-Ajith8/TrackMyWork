// ============================================================================
// TrackMyWork - Nexconn Chat shared helpers
// Pure functions safe to import from both the server and the browser.
// ============================================================================

/** Every TrackMyWork room maps to exactly one Nexconn group channel. */
export function getNexconnChannelId(roomId: string): string {
  return `room_${roomId}`;
}

/**
 * Nexconn user IDs only accept letters and digits, so Supabase UUIDs are
 * stripped of hyphens and prefixed to keep them recognisable.
 */
export function toNexconnUserId(supabaseUserId: string): string {
  return `tmw${supabaseUserId.replace(/[^a-zA-Z0-9]/g, '')}`;
}

/** System identity used for courtroom rulings broadcast into room chat. */
export const COURTROOM_BOT_USER_ID = 'tmwcourtroombot';
export const COURTROOM_BOT_NAME = 'AI Courtroom';

/** Optional `@ai` teammate that replies inline in the room thread. */
export const AI_TEAMMATE_BOT_USER_ID = 'tmwaiteammatebot';
export const AI_TEAMMATE_BOT_NAME = 'NIM AI';
