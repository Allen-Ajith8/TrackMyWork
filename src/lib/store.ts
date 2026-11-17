'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Room, RoomMember, Task, Notification, VibeHeartbeat } from '@/types/database';

interface AuthState {
  user: User | null;
  session: { access_token: string; expires_at: number } | null;
  setUser: (user: User | null) => void;
  setSession: (session: { access_token: string; expires_at: number } | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      clearAuth: () => set({ user: null, session: null }),
    }),
    {
      name: 'trackmywork-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, session: state.session }),
    }
  )
);

interface RoomState {
  currentRoom: Room | null;
  roomMembers: (RoomMember & { user: User })[];
  roomRules: Record<string, unknown> | null;
  isTeamLeader: boolean;
  isGlobalAdmin: boolean;
  setCurrentRoom: (room: Room | null) => void;
  setRoomMembers: (members: (RoomMember & { user: User })[]) => void;
  setRoomRules: (rules: Record<string, unknown> | null) => void;
  setPermissions: (isTeamLeader: boolean, isGlobalAdmin: boolean) => void;
  addMember: (member: RoomMember & { user: User }) => void;
  removeMember: (userId: string) => void;
  updateMember: (userId: string, updates: Partial<RoomMember>) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>()(
  persist(
    (set) => ({
      currentRoom: null,
      roomMembers: [],
      roomRules: null,
      isTeamLeader: false,
      isGlobalAdmin: false,
      setCurrentRoom: (room) => set({ currentRoom: room }),
      setRoomMembers: (members) => set({ roomMembers: members }),
      setRoomRules: (rules) => set({ roomRules: rules }),
      setPermissions: (isTeamLeader, isGlobalAdmin) =>
        set({ isTeamLeader, isGlobalAdmin }),
      addMember: (member) =>
        set((state) => ({
          roomMembers: [...state.roomMembers, member],
        })),
      removeMember: (userId) =>
        set((state) => ({
          roomMembers: state.roomMembers.filter((m) => m.user_id !== userId),
        })),
      updateMember: (userId, updates) =>
        set((state) => ({
          roomMembers: state.roomMembers.map((m) =>
            m.user_id === userId ? { ...m, ...updates } : m
          ),
        })),
      clearRoom: () =>
        set({
          currentRoom: null,
          roomMembers: [],
          roomRules: null,
          isTeamLeader: false,
          isGlobalAdmin: false,
        }),
    }),
    {
      name: 'trackmywork-room',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

interface TaskState {
  tasks: Task[];
  filter: { status?: string; category?: string; assignee?: string };
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  setFilter: (filter: TaskState['filter']) => void;
  clearTasks: () => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  filter: {},
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
  setFilter: (filter) => set({ filter }),
  clearTasks: () => set({ tasks: [] }),
}));

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      setNotifications: (notifications) =>
        set({
          notifications,
          unreadCount: notifications.filter((n) => !n.is_read).length,
        }),
      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + (notification.is_read ? 0 : 1),
        })),
      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, is_read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        })),
      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
          unreadCount: 0,
        })),
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
          unreadCount: state.notifications.find((n) => n.id === id)?.is_read
            ? state.unreadCount
            : Math.max(0, state.unreadCount - 1),
        })),
      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
    }),
    {
      name: 'trackmywork-notifications',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export interface VibeFileLock {
  id: string;
  roomId: string;
  userId: string;
  userName: string | null;
  filePath: string;
  editorType: string | null;
  expiresAt: number;
}

interface VibeState {
  heartbeats: Map<string, VibeHeartbeat>;
  fileLocks: Map<string, VibeFileLock>;
  updateHeartbeat: (heartbeat: VibeHeartbeat) => void;
  removeHeartbeat: (key: string) => void;
  setFileLock: (key: string, lock: VibeFileLock) => void;
  removeFileLock: (key: string) => void;
  clearVibeData: () => void;
}

export const useVibeStore = create<VibeState>((set) => ({
  heartbeats: new Map(),
  fileLocks: new Map(),
  updateHeartbeat: (heartbeat) =>
    set((state) => {
      const newHeartbeats = new Map(state.heartbeats);
      const key = `${heartbeat.room_id}-${heartbeat.user_id}-${heartbeat.editor_type}`;
      newHeartbeats.set(key, heartbeat);
      return { heartbeats: newHeartbeats };
    }),
  removeHeartbeat: (key) =>
    set((state) => {
      const newHeartbeats = new Map(state.heartbeats);
      newHeartbeats.delete(key);
      return { heartbeats: newHeartbeats };
    }),
  setFileLock: (key, lock) =>
    set((state) => {
      const newLocks = new Map(state.fileLocks);
      newLocks.set(key, lock);
      return { fileLocks: newLocks };
    }),
  removeFileLock: (key) =>
    set((state) => {
      const newLocks = new Map(state.fileLocks);
      newLocks.delete(key);
      return { fileLocks: newLocks };
    }),
  clearVibeData: () => set({ heartbeats: new Map(), fileLocks: new Map() }),
}));

interface UIState {
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      mobileMenuOpen: false,
      theme: 'system',
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'trackmywork-ui',
      storage: createJSONStorage(() => localStorage),
    }
  )
);