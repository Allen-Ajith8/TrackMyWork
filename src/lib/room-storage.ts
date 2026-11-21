import fs from 'fs';
import path from 'path';
import type { Room, RoomMember, Task, HardwareBomItem, Artifact, User } from '@/types/database';
import { DEMO_DEVELOPER_USER } from '@/lib/constants';
import { DEMO_ROOMS } from '@/lib/dashboard-data';

export interface StoredRoomBundle {
  room: Room;
  members: (RoomMember & { user: User })[];
  tasks: (Task & { assignee?: User | null })[];
  bom: HardwareBomItem[];
  artifacts: (Artifact & { uploader?: User | null })[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'custom_rooms.json');

// In-memory cache for fast lookup across requests
const memoryStore: Record<string, StoredRoomBundle> = {};

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORAGE_FILE)) {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify({}, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('[RoomStorage] Could not create storage directory/file:', err);
  }
}

function loadFromFile(): Record<string, StoredRoomBundle> {
  try {
    ensureDataFile();
    if (fs.existsSync(STORAGE_FILE)) {
      const content = fs.readFileSync(STORAGE_FILE, 'utf-8');
      return JSON.parse(content || '{}');
    }
  } catch (err) {
    console.warn('[RoomStorage] Failed to read from file:', err);
  }
  return {};
}

function saveToFile(data: Record<string, StoredRoomBundle>) {
  try {
    ensureDataFile();
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[RoomStorage] Failed to write to file:', err);
  }
}

// Initial populate from file
try {
  const loaded = loadFromFile();
  Object.assign(memoryStore, loaded);
} catch {}

/**
 * Saves a new or updated room bundle into persistent storage.
 */
export function saveRoomBundle(bundle: StoredRoomBundle): StoredRoomBundle {
  const fileData = loadFromFile();
  fileData[bundle.room.id] = bundle;
  memoryStore[bundle.room.id] = bundle;
  saveToFile(fileData);
  return bundle;
}

/**
 * Retrieves a custom room by ID if it was created by the user.
 */
export function getStoredRoomBundle(roomId: string): StoredRoomBundle | null {
  if (memoryStore[roomId]) {
    return memoryStore[roomId];
  }
  const fileData = loadFromFile();
  if (fileData[roomId]) {
    memoryStore[roomId] = fileData[roomId];
    return fileData[roomId];
  }
  return null;
}

/**
 * Retrieves all custom user-created rooms as an array.
 */
export function getAllCustomRooms(): Room[] {
  const fileData = loadFromFile();
  const all = { ...memoryStore, ...fileData };
  return Object.values(all).map((bundle) => bundle.room);
}

/**
 * Updates partial room properties (e.g. connecting GitHub repo, editing details)
 */
export function updateStoredRoom(roomId: string, updates: Partial<Room>): Room | null {
  const bundle = getStoredRoomBundle(roomId);
  if (!bundle) return null;

  bundle.room = {
    ...bundle.room,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  saveRoomBundle(bundle);
  return bundle.room;
}

/**
 * Adds an invited member to the room bundle.
 */
export function addMemberToStoredRoom(roomId: string, member: RoomMember & { user: User }) {
  const bundle = getStoredRoomBundle(roomId);
  if (!bundle) return;

  const existingIdx = bundle.members.findIndex((m) => m.user_id === member.user_id);
  if (existingIdx >= 0) {
    bundle.members[existingIdx] = member;
  } else {
    bundle.members.push(member);
  }

  saveRoomBundle(bundle);
}

/**
 * Adds a new task to the room bundle.
 */
export function addTaskToStoredRoom(roomId: string, task: Task & { assignee?: User | null }) {
  const bundle = getStoredRoomBundle(roomId);
  if (!bundle) return;

  bundle.tasks.unshift(task);
  saveRoomBundle(bundle);
}
