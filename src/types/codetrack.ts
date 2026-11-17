// ============================================================================
// CodeTrack AI - Upgraded Type Definitions
// ============================================================================

export type DSALevel = 'beginner' | 'intermediate' | 'advanced';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type PreferredDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Mixed Practice';

export type ProblemStatus = 'unsolved' | 'solved' | 'attempted' | 'practice';

export type IndependenceLevel =
  | 'independent'
  | 'small_hint'
  | 'substantial_help'
  | 'unsolved';

export type ChallengeType =
  | 'understanding'
  | 'approach'
  | 'data_structure'
  | 'coding'
  | 'debugging'
  | 'complexity'
  | 'other';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type NextPreference =
  | 'another_easy'
  | 'medium'
  | 'hard'
  | 'similar_concept'
  | 'revise_topic';

export interface DSATopic {
  id: string;
  name: string;
  slug: string;
  category:
    | 'Basic Data Structures'
    | 'Array and String Patterns'
    | 'Algorithms'
    | 'Graph Algorithms'
    | 'Advanced Data Structures'
    | 'Mathematical and Other Topics';
  level: DSALevel;
  description: string;
  iconName: string;
  orderIndex: number;
}

export interface LeetCodeProblem {
  id: string;
  frontendQuestionId: string;
  topicId: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  leetcodeUrl: string;
  description: string;
  topicTags: string[];
  hints?: string[];
  acceptance?: string;
  orderIndex: number;
}

export interface UserProblemProgress {
  userId: string;
  problemId: string;
  topicId: string;
  difficulty: Difficulty;
  status: ProblemStatus;
  attempts: number;
  notes?: string;
  independence?: IndependenceLevel;
  challengeFaced?: string;
  confidence?: ConfidenceLevel;
  preferredNext?: NextPreference;
  aiFeedback?: string;
  lastAttemptedAt: string;
  solvedAt?: string;
}

export interface DSAUserProfile {
  userId: string;
  level: DSALevel;
  preferredDifficulty: PreferredDifficulty;
  streak: number;
  lastActiveDate: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  createdAt: string;
  updatedAt: string;
}

export interface OfficialDailyChallenge {
  date: string;
  frontendQuestionId: string;
  title: string;
  titleSlug: string;
  difficulty: Difficulty;
  acRate?: number;
  topicTags: string[];
  url: string;
  status: ProblemStatus;
  isCached?: boolean;
  cachedAt?: string;
}

export interface AIMentorMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestions?: Array<{
    label: string;
    action: 'solve' | 'revise' | 'difficulty' | 'topic' | 'custom';
    payload?: string;
  }>;
  recommendedProblem?: LeetCodeProblem;
  recommendedProblems?: LeetCodeProblem[];
  recommendationReason?: string;
  conceptExplanation?: string;
  source?: 'llm' | 'rule_based';
}

export interface CodeTrackAnalytics {
  totalProblems: number;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalAttempts: number;
  currentStreak: number;
  completionPercentage: number;
  independentSolves: number;
  assistedSolves: number;
  topicsNeedingPractice: string[];
  topicProgress: Array<{
    topicId: string;
    topicName: string;
    category: string;
    level: DSALevel;
    total: number;
    solved: number;
    attempted: number;
    percentage: number;
  }>;
  weeklyActivity: Array<{
    day: string;
    date: string;
    solvedCount: number;
    attemptCount: number;
  }>;
  recentSolved: Array<{
    problemId: string;
    frontendQuestionId: string;
    title: string;
    difficulty: Difficulty;
    topicId: string;
    solvedAt: string;
    leetcodeUrl: string;
    independence?: IndependenceLevel;
  }>;
}
