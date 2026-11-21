'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  DSALevel,
  PreferredDifficulty,
  UserProblemProgress,
  ProblemStatus,
  Difficulty,
  AIMentorMessage,
  LeetCodeProblem,
  OfficialDailyChallenge,
  IndependenceLevel,
  ConfidenceLevel,
  NextPreference,
} from '@/types/codetrack';
import { LEETCODE_PROBLEMS } from './data';

interface CodeTrackState {
  level: DSALevel | null;
  preferredDifficulty: PreferredDifficulty;
  selectedTopicId: string | null;
  activeTab: 'curriculum' | 'mentor' | 'analytics' | 'daily' | 'history' | 'agent';
  progressMap: Record<string, UserProblemProgress>;
  activeModalProblem: LeetCodeProblem | null;
  activeDebriefProblem: LeetCodeProblem | null;
  agentProblem: LeetCodeProblem | null;
  officialDaily: OfficialDailyChallenge | null;
  isMentorDrawerOpen: boolean;
  mentorMessages: AIMentorMessage[];
  streak: number;
  lastActiveDate: string;
  isInitialized: boolean;

  // Actions
  setLevel: (level: DSALevel) => void;
  setPreferredDifficulty: (pref: PreferredDifficulty) => void;
  setSelectedTopicId: (topicId: string | null) => void;
  setActiveTab: (tab: 'curriculum' | 'mentor' | 'analytics' | 'daily' | 'history' | 'agent') => void;
  setActiveModalProblem: (problem: LeetCodeProblem | null) => void;
  setActiveDebriefProblem: (problem: LeetCodeProblem | null) => void;
  setAgentProblem: (problem: LeetCodeProblem | null) => void;
  setOfficialDaily: (challenge: OfficialDailyChallenge | null) => void;
  setIsMentorDrawerOpen: (isOpen: boolean) => void;
  updateProblemProgress: (params: {
    userId?: string;
    problemId: string;
    topicId: string;
    difficulty: Difficulty;
    status: ProblemStatus;
    notes?: string;
    independence?: IndependenceLevel;
    challengeFaced?: string;
    confidence?: ConfidenceLevel;
    preferredNext?: NextPreference;
    aiFeedback?: string;
  }) => UserProblemProgress;
  addMentorMessage: (msg: Omit<AIMentorMessage, 'id' | 'timestamp'>) => void;
  setMentorMessages: (messages: AIMentorMessage[]) => void;
  clearMentorChat: () => void;
  calculateStreak: () => void;
  resetProgress: () => void;
}

export const INITIAL_MENTOR_MESSAGE: AIMentorMessage = {
  id: 'welcome-mentor',
  sender: 'assistant',
  content:
    "Hi, Developer! Welcome to your AI DSA Mentor.\n\nI'm here to help you understand DSA, practice LeetCode problems and improve your problem-solving skills.\n\nWhat would you like to explore today?",
  timestamp: new Date().toISOString(),
  source: 'rule_based',
  suggestions: [
    { label: 'Learn a DSA Concept', action: 'custom', payload: 'action:learn_concept' },
    { label: 'Practice LeetCode Problems', action: 'custom', payload: 'action:practice_problems' },
    { label: "Today's Daily Challenge", action: 'custom', payload: 'action:daily_challenge' },
    { label: 'Analyze My Progress', action: 'custom', payload: 'action:analyze_progress' },
    { label: 'Continue Previous Practice', action: 'custom', payload: 'action:continue_practice' },
  ],
};

export const useCodeTrackStore = create<CodeTrackState>()(
  persist(
    (set, get) => ({
      level: null,
      preferredDifficulty: 'Mixed Practice',
      selectedTopicId: 'arrays',
      activeTab: 'curriculum',
      progressMap: {},
      activeModalProblem: null,
      activeDebriefProblem: null,
      agentProblem: null,
      officialDaily: null,
      isMentorDrawerOpen: false,
      mentorMessages: [INITIAL_MENTOR_MESSAGE],
      streak: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      isInitialized: true,

      setLevel: (level) => {
        set({ level });
        const levelText =
          level === 'beginner'
            ? 'Beginner path! We will focus on core foundations like Arrays, Strings, Hash Tables, and Two Pointers.'
            : level === 'intermediate'
            ? 'Intermediate track! Excellent. We will dive into Sliding Window, Trees, Stacks, Queues, and Binary Search.'
            : 'Advanced track! Impressive. We will tackle Graphs, Dynamic Programming, Segment Trees, and Disjoint Set Union.';

        get().addMentorMessage({
          sender: 'assistant',
          content: `You have selected the **${level.toUpperCase()}** path! ${levelText} What difficulty would you like to target initially?`,
          suggestions: [
            { label: 'Recommend an Easy starting problem', action: 'difficulty', payload: 'Easy' },
            { label: 'Set preferred difficulty to Medium', action: 'difficulty', payload: 'Medium' },
            { label: 'Explore Curriculum', action: 'topic' },
          ],
        });
      },

      setPreferredDifficulty: (preferredDifficulty) => set({ preferredDifficulty }),

      setSelectedTopicId: (selectedTopicId) => set({ selectedTopicId }),

      setActiveTab: (activeTab) => set({ activeTab }),

      setActiveModalProblem: (activeModalProblem) => set({ activeModalProblem }),

      setActiveDebriefProblem: (activeDebriefProblem) => set({ activeDebriefProblem }),

      setAgentProblem: (agentProblem) => set({ agentProblem, activeTab: 'agent' }),

      setOfficialDaily: (officialDaily) => set({ officialDaily }),

      setIsMentorDrawerOpen: (isMentorDrawerOpen) => set({ isMentorDrawerOpen }),

      updateProblemProgress: ({
        userId = 'demo-dev-user-001',
        problemId,
        topicId,
        difficulty,
        status,
        notes,
        independence,
        challengeFaced,
        confidence,
        preferredNext,
        aiFeedback,
      }) => {
        const now = new Date().toISOString();
        const existing = get().progressMap[problemId];
        const attempts = (existing?.attempts || 0) + 1;

        const updated: UserProblemProgress = {
          userId,
          problemId,
          topicId,
          difficulty,
          status,
          attempts,
          notes: notes !== undefined ? notes : existing?.notes,
          independence: independence || existing?.independence,
          challengeFaced: challengeFaced || existing?.challengeFaced,
          confidence: confidence || existing?.confidence,
          preferredNext: preferredNext || existing?.preferredNext,
          aiFeedback: aiFeedback || existing?.aiFeedback,
          lastAttemptedAt: now,
          solvedAt: status === 'solved' ? existing?.solvedAt || now : existing?.solvedAt,
        };

        const newMap = {
          ...get().progressMap,
          [problemId]: updated,
        };

        set({ progressMap: newMap });
        get().calculateStreak();

        return updated;
      },

      addMentorMessage: (msg) => {
        const fullMsg: AIMentorMessage = {
          ...msg,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          mentorMessages: [...state.mentorMessages, fullMsg],
        }));
      },

      setMentorMessages: (mentorMessages) => set({ mentorMessages }),

      clearMentorChat: () => {
        set({
          mentorMessages: [INITIAL_MENTOR_MESSAGE],
        });
      },

      calculateStreak: () => {
        const today = new Date().toISOString().split('T')[0];
        const last = get().lastActiveDate;
        if (last === today) return;

        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (last === yesterday) {
          set((state) => ({ streak: state.streak + 1, lastActiveDate: today }));
        } else {
          set({ streak: 1, lastActiveDate: today });
        }
      },

      resetProgress: () => {
        set({
          progressMap: {},
          mentorMessages: [INITIAL_MENTOR_MESSAGE],
          streak: 1,
        });
      },
    }),
    {
      name: 'codetrack-ai-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        level: state.level,
        preferredDifficulty: state.preferredDifficulty,
        selectedTopicId: state.selectedTopicId,
        progressMap: state.progressMap,
        mentorMessages: state.mentorMessages,
        streak: state.streak,
        lastActiveDate: state.lastActiveDate,
      }),
    }
  )
);
