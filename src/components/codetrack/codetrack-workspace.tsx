'use client';

import { useState, useEffect } from 'react';
import { useCodeTrackStore } from '@/lib/codetrack/store';
import { DSA_TOPICS } from '@/lib/codetrack/data';
import type { DSALevel, PreferredDifficulty } from '@/types/codetrack';
import { WelcomeModal } from './welcome-modal';
import { TopicCard } from './topic-card';
import { ProblemList } from './problem-list';
import { TopicFolderVaultModal, TopicFolderVaultBanner } from './topic-folder-vault';
import { AIMentorPanel } from './ai-mentor-panel';
import { AnalyticsDashboard } from './analytics-dashboard';
import { DailyChallengeCard } from './daily-challenge-card';
import { PostProblemDebriefModal } from './post-problem-debrief-modal';
import { LearningHistoryView } from './learning-history-view';
import { AICodingAgent } from './ai-coding-agent';
import {
  Code2,
  Bot,
  BarChart3,
  Flame,
  Layers,
  Sparkles,
  Settings2,
  Calendar,
  History,
  Search,
  Filter,
  CheckCircle2,
  SlidersHorizontal,
  Cpu,
} from 'lucide-react';

const CATEGORIES = [
  'All Concepts',
  'Basic Data Structures',
  'Array and String Patterns',
  'Algorithms',
  'Graph Algorithms',
  'Advanced Data Structures',
  'Mathematical and Other Topics',
] as const;

export function CodeTrackWorkspace() {
  const {
    level,
    setLevel,
    preferredDifficulty,
    setPreferredDifficulty,
    selectedTopicId,
    setSelectedTopicId,
    activeTab,
    setActiveTab,
    activeDebriefProblem,
    setActiveDebriefProblem,
    progressMap,
    streak,
  } = useCodeTrackStore();

  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [vaultTopic, setVaultTopic] = useState<import('@/types/codetrack').DSATopic | null>(null);
  const [topicSearch, setTopicSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All Concepts');

  // Trigger onboarding if no level set yet
  useEffect(() => {
    if (!level) {
      setIsWelcomeOpen(true);
    }
  }, [level]);

  const activeLevel: DSALevel = level || 'beginner';

  // Filter topics by level, category, and search query
  const filteredTopics = DSA_TOPICS.filter((t) => {
    // If not All Concepts, filter by category
    if (selectedCategory !== 'All Concepts' && t.category !== selectedCategory) {
      return false;
    }

    // Search query
    if (topicSearch.trim()) {
      const q = topicSearch.toLowerCase();
      const match =
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  const solvedCount = Object.values(progressMap).filter((p) => p.status === 'solved').length;
  const selectedTopic = DSA_TOPICS.find((t) => t.id === selectedTopicId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Onboarding Welcome Modal */}
      <WelcomeModal
        isOpen={isWelcomeOpen}
        onClose={() => setIsWelcomeOpen(false)}
      />

      {/* Adaptive Post-Problem Debrief Modal */}
      <PostProblemDebriefModal
        problem={activeDebriefProblem}
        onClose={() => setActiveDebriefProblem(null)}
      />

      {/* 3D Concept Folder Vault Modal */}
      {vaultTopic && (
        <TopicFolderVaultModal
          topic={vaultTopic}
          isOpen={Boolean(vaultTopic)}
          onClose={() => setVaultTopic(null)}
        />
      )}

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-[#0d121f]/90 border border-surface-200 dark:border-slate-800/80 p-6 sm:p-8 shadow-sm">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-primary-100/40 dark:bg-purple-900/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-100/40 dark:bg-indigo-900/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-sm">
                <Code2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-primary-700 dark:text-purple-300">
                CodeTrack Platform
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-white tracking-tight">
              Adaptive LeetCode DSA Learning &amp; Mentorship
            </h1>
            <p className="text-xs sm:text-sm text-surface-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              Explore 41 comprehensive curriculum concepts, solve genuine LeetCode problems, sync with the live official Daily Challenge, and receive tailored post-problem AI debriefs.
            </p>
          </div>

          {/* Controls: Level + Strict Difficulty Selector + Streak */}
          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            {/* Streak */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-surface-50 dark:bg-slate-900/80 border border-surface-200 dark:border-slate-800 text-xs shadow-xs">
              <Flame className="w-4 h-4 text-orange-500" />
              <div>
                <span className="text-surface-500 dark:text-slate-400 font-mono text-[10px] block">Streak</span>
                <span className="font-bold text-surface-900 dark:text-white">{streak} Days</span>
              </div>
            </div>

            {/* Level Card */}
            <div className="flex items-center gap-3 p-2 pl-3 rounded-2xl bg-surface-50 dark:bg-slate-900/80 border border-surface-200 dark:border-slate-800 text-xs shadow-xs">
              <div>
                <span className="text-surface-500 dark:text-slate-400 font-mono text-[10px] block">Skill Track</span>
                <span className="font-bold text-primary-700 dark:text-purple-300 uppercase tracking-wider">
                  {activeLevel}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsWelcomeOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-surface-100 text-surface-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-all text-xs flex items-center gap-1.5 font-medium border border-surface-200 dark:border-slate-700 shadow-xs"
                title="Change difficulty track"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Switch</span>
              </button>
            </div>

            {/* Preferred Difficulty Selector */}
            <div className="flex items-center gap-2 p-2 pl-3 rounded-2xl bg-surface-50 dark:bg-slate-900/80 border border-surface-200 dark:border-slate-800 text-xs shadow-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-surface-400 dark:text-slate-400" />
              <div>
                <span className="text-surface-500 dark:text-slate-400 font-mono text-[10px] block">Target Difficulty</span>
                <select
                  value={preferredDifficulty}
                  onChange={(e) => setPreferredDifficulty(e.target.value as PreferredDifficulty)}
                  className="bg-transparent font-bold text-primary-700 dark:text-purple-300 focus:outline-none cursor-pointer"
                >
                  <option value="Easy" className="bg-white dark:bg-slate-900 text-surface-900 dark:text-white">Easy</option>
                  <option value="Medium" className="bg-white dark:bg-slate-900 text-surface-900 dark:text-white">Medium</option>
                  <option value="Hard" className="bg-white dark:bg-slate-900 text-surface-900 dark:text-white">Hard</option>
                  <option value="Mixed Practice" className="bg-white dark:bg-slate-900 text-surface-900 dark:text-white">Mixed Practice</option>
                </select>
              </div>
            </div>
            {/* AI DSA Mentor Action Button */}
            <button
              type="button"
              onClick={() => setActiveTab('mentor')}
              className="btn-primary px-4 py-2 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm"
              title="Open full interactive AI DSA Mentor"
            >
              <Bot className="w-4 h-4 text-white" />
              <span>AI DSA Mentor</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="relative mt-8 pt-4 border-t border-surface-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('curriculum')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'curriculum'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Curriculum &amp; Library</span>
          </button>

          <button
            onClick={() => setActiveTab('daily')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'daily'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60'
            }`}
          >
            <Calendar className="w-4 h-4 text-orange-500" />
            <span>Live Daily Challenge</span>
          </button>

          <button
            onClick={() => setActiveTab('agent')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'agent'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60'
            }`}
          >
            <Cpu className="w-4 h-4 text-emerald-500" />
            <span>AI Coding Agent</span>
          </button>

          <button
            onClick={() => setActiveTab('mentor')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'mentor'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60'
            }`}
          >
            <Bot className="w-4 h-4 text-primary-500" />
            <span>AI DSA Mentor</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Learning Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Learning History</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CURRICULUM & PROBLEMS */}
      {activeTab === 'curriculum' && (
        <div className="space-y-8 animate-in fade-in-50 duration-200">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-primary-600 text-white font-bold shadow-sm'
                    : 'bg-white text-surface-600 hover:text-surface-900 border border-surface-200 hover:bg-surface-50 dark:bg-slate-900/80 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Topic Exploration Header */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-surface-900 dark:text-white flex items-center gap-2">
                  <span>{selectedCategory}</span>
                  <span className="text-xs font-mono font-normal text-surface-500 dark:text-slate-400">
                    ({filteredTopics.length} topics)
                  </span>
                </h2>
                <p className="text-xs text-surface-600 dark:text-slate-400 mt-0.5">
                  Click any concept card below to inspect its curated LeetCode problems and practice history.
                </p>
              </div>

              {/* Search Topics */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-slate-400" />
                <input
                  type="text"
                  value={topicSearch}
                  onChange={(e) => setTopicSearch(e.target.value)}
                  placeholder="Filter topics..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white border border-surface-200 text-surface-900 placeholder:text-surface-400 dark:bg-slate-900/90 dark:border-slate-800 dark:text-white dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 shadow-xs"
                />
              </div>
            </div>

            {/* Topic Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTopics.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  isSelected={selectedTopicId === topic.id}
                  onSelect={() => {
                    setSelectedTopicId(topic.id);
                    setVaultTopic(topic);
                  }}
                  onOpenVault={() => {
                    setSelectedTopicId(topic.id);
                    setVaultTopic(topic);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Selected Topic's 3D Problem Vault Banner + Library */}
          {selectedTopic && (
            <div className="pt-4 space-y-6">
              <TopicFolderVaultBanner
                topic={selectedTopic}
                onOpenModal={() => setVaultTopic(selectedTopic)}
              />
              <ProblemList topicId={selectedTopic.id} />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE DAILY CHALLENGE + PERSONALIZED PRACTICE */}
      {activeTab === 'daily' && (
        <div className="animate-in fade-in-50 duration-200">
          <DailyChallengeCard />
        </div>
      )}

      {/* TAB 3: ADAPTIVE AI MENTOR */}
      {activeTab === 'mentor' && (
        <div className="animate-in fade-in-50 duration-200">
          <AIMentorPanel />
        </div>
      )}

      {/* TAB 4: AI CODING AGENT */}
      {activeTab === 'agent' && (
        <div className="animate-in fade-in-50 duration-200">
          <AICodingAgent />
        </div>
      )}

      {/* TAB 4: LEARNING ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="animate-in fade-in-50 duration-200">
          <AnalyticsDashboard />
        </div>
      )}

      {/* TAB 5: LEARNING HISTORY */}
      {activeTab === 'history' && (
        <div className="animate-in fade-in-50 duration-200">
          <LearningHistoryView />
        </div>
      )}
    </div>
  );
}
