import type { Artifact } from '@/types/database';

/**
 * Tiny process-local store used when Supabase is not configured (offline demo
 * mode) or when a storage insert fails. It keeps uploaded artifacts visible to
 * MICA / Courtroom within the same dev server process.
 */
const roomArtifacts: Record<string, Artifact[]> = {};

export function rememberArtifact(artifact: Artifact): Artifact {
  const list = roomArtifacts[artifact.room_id] || [];
  roomArtifacts[artifact.room_id] = [artifact, ...list.filter((item) => item.id !== artifact.id)].slice(
    0,
    100
  );
  return artifact;
}

export function listRememberedArtifacts(roomId: string): Artifact[] {
  return roomArtifacts[roomId] || [];
}

export function removeRememberedArtifact(roomId: string, artifactId: string): void {
  roomArtifacts[roomId] = (roomArtifacts[roomId] || []).filter((item) => item.id !== artifactId);
}

export function removeRememberedArtifactEverywhere(artifactId: string): void {
  for (const roomId of Object.keys(roomArtifacts)) {
    roomArtifacts[roomId] = roomArtifacts[roomId].filter((item) => item.id !== artifactId);
  }
}
