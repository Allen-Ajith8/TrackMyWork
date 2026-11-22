'use client';

import { useState, useRef, useEffect } from 'react';
import { useCodeTrackStore } from '@/lib/codetrack/store';
import { useAuthStore } from '@/lib/store';
import { LEETCODE_PROBLEMS, DSA_TOPICS } from '@/lib/codetrack/data';
import type { LeetCodeProblem } from '@/types/codetrack';
import Galaxy from '@/components/ui/galaxy';
import {
  Bot,
  Send,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  Code2,
  User,
  Info,
  BookOpen,
  Trash2,
  SlidersHorizontal,
  CheckCircle2,
  Flame,
  Calendar,
  BarChart3,
  History,
  Brain,
  AlertCircle,
  HelpCircle,
  Cpu,
} from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  'Teach me Arrays from basics',
  'Give me five Easy Array problems',
  'I want to practice Medium problems',
  'Explain Sliding Window',
  'Give me a problem similar to Two Sum',
  'Analyze my weak DSA topics',
  'What should I solve next?',
];

export function AIMentorPanel() {
  const {
    level,
    preferredDifficulty,
    selectedTopicId,
    progressMap,
    mentorMessages,
    addMentorMessage,
    clearMentorChat,
    setActiveDebriefProblem,
    setSelectedTopicId,
    setActiveTab,
    setAgentProblem,
    streak,
  } = useCodeTrackStore();

  const user = useAuthStore((s) => s.user);
  const displayName = user?.display_name || user?.username || 'Developer';

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showContextDetails, setShowContextDetails] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          checkDark();
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mentorMessages, isLoading]);

  // Derived user context
  const solvedProblems = Object.keys(progressMap).filter((id) => progressMap[id]?.status === 'solved');
  const attemptedProblems = Object.keys(progressMap).filter(
    (id) => progressMap[id]?.status === 'attempted' || progressMap[id]?.status === 'practice'
  );

  const hurdlesList = Array.from(
    new Set(
      Object.values(progressMap)
        .map((p) => p.challengeFaced)
        .filter(Boolean) as string[]
    )
  );

  const currentTopicObj = DSA_TOPICS.find((t) => t.id === selectedTopicId) || DSA_TOPICS[0];

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim() || isLoading) return;

    setErrorMessage(null);
    addMentorMessage({
      sender: 'user',
      content: query,
    });

    if (!textToSend) setInputQuery('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/codetrack/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userLevel: level || 'beginner',
          preferredDifficulty,
          currentTopicId: selectedTopicId || 'arrays',
          progressMap,
          userQuery: query,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        addMentorMessage({
          sender: 'assistant',
          content: data.message,
          recommendationReason: data.recommendationReason,
          suggestions: data.suggestions,
          recommendedProblem: data.recommendedProblem,
          recommendedProblems: data.recommendedProblems,
          source: data.source || 'rule_based',
        });
      } else {
        throw new Error('Mentor API error');
      }
    } catch {
      setErrorMessage('Unable to reach the mentor engine. Showing offline adaptive guidance.');
      addMentorMessage({
        sender: 'assistant',
        content: `I'm analyzing your progress! Keep focused on **${currentTopicObj.name}** patterns. Consistent daily practice is the key to cracking technical interviews.\n\nTry asking: "Teach me Arrays from basics", "Explain Sliding Window", or "What should I solve next?".`,
        source: 'rule_based',
        suggestions: [
          { label: 'What should I solve next?', action: 'solve' },
          { label: 'Explain Sliding Window', action: 'custom', payload: 'Explain Sliding Window' },
          { label: 'Teach me Arrays from basics', action: 'custom', payload: 'Teach me Arrays from basics' },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: {
    label: string;
    action: string;
    payload?: string;
  }) => {
    if (suggestion.action === 'solve' && suggestion.payload) {
      const prob = LEETCODE_PROBLEMS.find((p) => p.id === suggestion.payload);
      if (prob) {
        window.open(prob.leetcodeUrl, '_blank', 'noopener,noreferrer');
        setActiveDebriefProblem(prob);
        return;
      }
    }

    if (suggestion.action === 'topic' && suggestion.payload) {
      setSelectedTopicId(suggestion.payload);
      setActiveTab('curriculum');
      return;
    }

    if (suggestion.action === 'topic') {
      setActiveTab('curriculum');
      return;
    }

    handleSendMessage(suggestion.payload || suggestion.label);
  };

  const handleSolveProblem = (prob: LeetCodeProblem) => {
    window.open(prob.leetcodeUrl, '_blank', 'noopener,noreferrer');
    setActiveDebriefProblem(prob);
  };

  return (
    <div className="flex flex-col h-[820px] rounded-3xl bg-white dark:bg-[#0d121f] border border-surface-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in-50 duration-200">
      {/* Top Header & Navigation Bar */}
      <div className="p-4 sm:p-5 border-b border-surface-200 dark:border-slate-800 bg-surface-50 dark:bg-[#0d121f] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Back to CodeTrack AI Button */}
          <button
            type="button"
            onClick={() => setActiveTab('curriculum')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-surface-100 dark:hover:bg-slate-700 text-surface-700 dark:text-slate-200 hover:text-surface-900 dark:hover:text-white border border-surface-200 dark:border-slate-700 text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-xs"
            title="Return to Curriculum and LeetCode Problem Library"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to CodeTrack AI</span>
          </button>

          <div className="h-4 w-px bg-surface-200 dark:bg-slate-700 hidden sm:block" />

          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary-600 via-pink-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-primary-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#0d121f] rounded-full animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-surface-900 dark:text-white">AI DSA Mentor</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30">
                Online &amp; Context-Aware
              </span>
            </div>
            <p className="text-xs text-surface-600 dark:text-slate-400">
              Personalized guidance for {displayName} · {level ? level.toUpperCase() : 'BEGINNER'} Track
            </p>
          </div>
        </div>

        {/* Action Controls: Context Toggle, Clear Chat */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowContextDetails(!showContextDetails)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-xs ${
              showContextDetails
                ? 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-950/40 dark:text-primary-300 dark:border-primary-800'
                : 'bg-white hover:bg-surface-100 text-surface-600 hover:text-surface-900 border-surface-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white dark:border-slate-700'
            }`}
            title="Toggle user context ledger"
          >
            <Brain className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">My Context</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset conversation to initial welcome screen?')) {
                clearMentorChat();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-surface-100 text-surface-600 hover:text-rose-600 border border-surface-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-rose-400 dark:border-slate-700 text-xs font-semibold transition-colors shadow-xs"
            title="Clear conversation and restart mentor"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        </div>
      </div>

      {/* Personalized Context Bar (Collapsible / Expandable) */}
      {showContextDetails && (
        <div className="px-4 py-3 bg-surface-50 dark:bg-[#0b0f19] border-b border-surface-200 dark:border-slate-800 text-xs text-surface-700 dark:text-slate-300 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-surface-900 dark:text-white flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-primary-600 dark:text-purple-400" />
              <span>Personalized DSA Learning Profile (Retrieved from Database)</span>
            </span>
            <span className="text-[10px] text-surface-500 dark:text-slate-400 font-mono">User: {displayName}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px]">
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800/90 border border-surface-200 dark:border-slate-700 shadow-xs">
              <span className="text-surface-500 dark:text-slate-400 block text-[10px]">Skill Track</span>
              <span className="font-bold text-primary-700 dark:text-primary-400 uppercase">{level || 'beginner'}</span>
            </div>
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800/90 border border-surface-200 dark:border-slate-700 shadow-xs">
              <span className="text-surface-500 dark:text-slate-400 block text-[10px]">Target Difficulty</span>
              <span className="font-bold text-indigo-700 dark:text-indigo-400">{preferredDifficulty}</span>
            </div>
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800/90 border border-surface-200 dark:border-slate-700 shadow-xs">
              <span className="text-surface-500 dark:text-slate-400 block text-[10px]">Solved Problems</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">{solvedProblems.length}</span>
            </div>
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800/90 border border-surface-200 dark:border-slate-700 shadow-xs">
              <span className="text-surface-500 dark:text-slate-400 block text-[10px]">In Progress</span>
              <span className="font-bold text-amber-700 dark:text-amber-400">{attemptedProblems.length}</span>
            </div>
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800/90 border border-surface-200 dark:border-slate-700 shadow-xs">
              <span className="text-surface-500 dark:text-slate-400 block text-[10px]">Practice Streak</span>
              <span className="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <Flame className="w-3 h-3" />
                <span>{streak} Days</span>
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800/90 border border-surface-200 dark:border-slate-700 shadow-xs">
              <span className="text-surface-500 dark:text-slate-400 block text-[10px]">Active Topic</span>
              <span className="font-bold text-surface-800 dark:text-slate-200 truncate block">{currentTopicObj.name}</span>
            </div>
          </div>

          {hurdlesList.length > 0 && (
            <div className="mt-2 text-[11px] text-surface-600 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
              <span className="text-surface-500 dark:text-slate-400 font-semibold">Recorded Debrief Hurdles:</span>
              {hurdlesList.map((h, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 border border-primary-200 dark:bg-primary-950/50 dark:text-primary-300 dark:border-primary-800 text-[10px]"
                >
                  {h}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Scroll Area with contained Galaxy animation strictly within chat */}
      <div className="relative flex-1 overflow-hidden flex flex-col bg-slate-50/60 dark:bg-[#070b13]">
        {/* Dynamic Galaxy Canvas Background (strictly contained inside chat messages area) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          {mounted && (
            <Galaxy
              key={isDark ? 'mentor-dark' : 'mentor-light'}
              lightMode={!isDark}
              transparent={true}
              starColors={
                isDark
                  ? ['#c084fc', '#818cf8', '#e879f9', '#ffffff'] // Glowing violet, indigo, fuchsia & white stars in dark mode
                  : ['#7c3aed', '#6366f1', '#a855f7', '#3b82f6'] // Crisp purple, indigo, grape & royal blue sprinkles in light mode
              }
              density={isDark ? 0.95 : 1.15}
              glowIntensity={isDark ? 0.55 : 0.45}
              flareIntensity={isDark ? 0.85 : 0.65}
              starSpeed={0.35}
              speed={0.75}
              twinkleIntensity={0.35}
              rotationSpeed={0.04}
              mouseInteraction={true}
              mouseRepulsion={true}
              repulsionStrength={2.0}
              clickWarp={false}
              className="w-full h-full opacity-80 dark:opacity-90"
            />
          )}
        </div>

        {/* Ambient Radial Accent Glow behind chat */}
        <div
          aria-hidden="true"
          className={`absolute inset-0 pointer-events-none transition-opacity duration-500 z-0 ${
            isDark
              ? 'bg-[radial-gradient(ellipse_75%_55%_at_50%_35%,rgba(168,85,247,0.12),transparent_70%)]'
              : 'bg-[radial-gradient(ellipse_75%_55%_at_50%_35%,rgba(147,51,234,0.06),transparent_70%)]'
          }`}
        />

        {/* Scrollable Messages Container */}
        <div className="relative z-10 flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
        {mentorMessages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isRuleBased = msg.source === 'rule_based';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-950/50 border border-primary-200 dark:border-primary-800 flex items-center justify-center text-primary-700 dark:text-primary-300 shrink-0 mt-0.5 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[90%] sm:max-w-2xl space-y-3 p-4 sm:p-5 rounded-3xl text-xs sm:text-sm leading-relaxed backdrop-blur-md transition-all ${
                  isUser
                    ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-br-none shadow-md shadow-primary-500/20'
                    : 'bg-white/95 dark:bg-[#0d121f]/95 border border-surface-200/90 dark:border-slate-800 text-surface-800 dark:text-slate-100 rounded-bl-none shadow-sm dark:shadow-xl dark:shadow-purple-950/20'
                }`}
              >
                {/* Assistant Source Badge */}
                {!isUser && (
                  <div className="flex items-center justify-between pb-1 border-b border-surface-200 dark:border-slate-800 text-[10px]">
                    <span className="font-bold text-primary-700 dark:text-purple-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-primary-600 dark:text-purple-400" />
                      <span>CodeTrack AI DSA Mentor</span>
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                        isRuleBased
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
                          : 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-950/40 dark:text-primary-300 dark:border-primary-800'
                      }`}
                    >
                      {isRuleBased ? '⚡ Adaptive DSA Engine' : '✨ AI-Powered Mentor (Llama 3.3 70B)'}
                    </span>
                  </div>
                )}

                {/* Content */}
                <div className="whitespace-pre-line max-w-none text-xs sm:text-sm">
                  {msg.content}
                </div>

                {/* Reason Banner if present */}
                {msg.recommendationReason && (
                  <div className="p-3 rounded-2xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-[11px] text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary-600 dark:text-purple-400" />
                    <div>
                      <strong className="text-primary-800 dark:text-purple-300 block mb-0.5">Why this problem was chosen:</strong>
                      <span>{msg.recommendationReason}</span>
                    </div>
                  </div>
                )}

                {/* Single Recommended Problem Card */}
                {msg.recommendedProblem && (
                  <div className="p-4 rounded-2xl bg-surface-50 dark:bg-slate-900/90 border border-primary-200 dark:border-slate-700 space-y-2.5 text-xs shadow-xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold text-surface-900 dark:text-white flex items-center gap-1.5 text-sm">
                        <span className="text-zinc-500 dark:text-slate-400 font-mono">
                          #{msg.recommendedProblem.frontendQuestionId}
                        </span>
                        <span>{msg.recommendedProblem.title}</span>
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          msg.recommendedProblem.difficulty === 'Easy'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : msg.recommendedProblem.difficulty === 'Medium'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {msg.recommendedProblem.difficulty}
                      </span>
                    </div>

                    {msg.recommendedProblem.description && (
                      <p className="text-surface-600 dark:text-slate-300 text-[11px] line-clamp-2">
                        {msg.recommendedProblem.description}
                      </p>
                    )}

                    {(() => {
                      const tags = Array.isArray(msg.recommendedProblem.topicTags)
                        ? msg.recommendedProblem.topicTags.join(', ')
                        : typeof msg.recommendedProblem.topicTags === 'string'
                        ? msg.recommendedProblem.topicTags
                        : null;

                      if (!tags && !msg.recommendedProblem.acceptance) return null;

                      return (
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-slate-400 flex-wrap">
                          {tags && <span>Tags: {tags}</span>}
                          {msg.recommendedProblem.acceptance && (
                            <span>· Acceptance: {msg.recommendedProblem.acceptance}</span>
                          )}
                        </div>
                      );
                    })()}

                    <div className="pt-1.5 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setAgentProblem(msg.recommendedProblem!)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:hover:bg-primary-900/60 dark:text-primary-300 font-bold rounded-xl text-xs border border-primary-200 dark:border-primary-800 transition-colors shadow-xs"
                      >
                        <Cpu className="w-3 h-3 text-primary-600 dark:text-purple-400" />
                        <span>Solve with AI Agent</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSolveProblem(msg.recommendedProblem!)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs transition-colors shadow-sm"
                      >
                        <span>Solve on LeetCode</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleSendMessage(`Show hint for #${msg.recommendedProblem?.frontendQuestionId} ${msg.recommendedProblem?.title}`)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs border border-zinc-800 transition-colors"
                      >
                        <Lightbulb className="w-3 h-3 text-amber-500" />
                        <span>Get Hint First</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Multiple Recommended Problems (e.g. for "Give me 5 Easy Array problems") */}
                {msg.recommendedProblems && msg.recommendedProblems.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-bold text-surface-600 dark:text-slate-400 block uppercase tracking-wider">
                      Interactive Problem Recommendations ({msg.recommendedProblems.length})
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {msg.recommendedProblems.map((prob) => (
                        <div
                          key={prob.id}
                          className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 hover:border-primary-300 dark:hover:border-primary-500 flex items-center justify-between gap-3 text-xs transition-colors shadow-xs"
                        >
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-500 dark:text-slate-400 font-mono text-[10px]">
                                #{prob.frontendQuestionId}
                              </span>
                              <span className="font-semibold text-surface-900 dark:text-white truncate block">
                                {prob.title}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0 ${
                                  prob.difficulty === 'Easy'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : prob.difficulty === 'Medium'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                }`}
                              >
                                {prob.difficulty}
                              </span>
                            </div>
                            <p className="text-surface-500 dark:text-slate-400 text-[10px] truncate">{prob.description}</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSolveProblem(prob)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-[11px] shrink-0 transition-colors"
                          >
                            <span>Solve</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactive Suggestion / Action Chips */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="pt-2 border-t border-surface-200 dark:border-slate-800 flex flex-wrap gap-2">
                    {msg.suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSuggestionClick(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-100 hover:bg-primary-50 hover:text-primary-700 text-surface-700 border border-surface-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:hover:text-white dark:border-slate-700 transition-all hover:scale-[1.02] active:scale-95 shadow-xs"
                      >
                        <Sparkles className="w-3 h-3 text-primary-600 dark:text-purple-400" />
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-surface-200 dark:bg-slate-800 border border-surface-300 dark:border-slate-700 flex items-center justify-center text-surface-700 dark:text-slate-300 shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start animate-in fade-in-50 duration-150">
            <div className="w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-950/50 border border-primary-200 dark:border-primary-800 flex items-center justify-center text-primary-700 dark:text-primary-300 shrink-0 shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-3xl bg-white dark:bg-[#0d121f] border border-surface-200 dark:border-slate-800 text-surface-600 dark:text-slate-300 text-xs flex items-center gap-2.5 shadow-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-primary-600 dark:text-purple-400" />
              <span>Analyzing curriculum, post-problem debriefs &amp; crafting personal guidance...</span>
            </div>
          </div>
        )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggested Quick Questions Row */}
      <div className="px-4 py-2 border-t border-surface-200 dark:border-slate-800 bg-surface-50 dark:bg-[#0d121f] overflow-x-auto flex items-center gap-2 text-xs">
        <span className="text-[10px] font-bold text-surface-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
          <HelpCircle className="w-3 h-3 text-primary-600 dark:text-purple-400" />
          <span>Ask Mentor:</span>
        </span>
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => handleSendMessage(q)}
            className="px-2.5 py-1 rounded-full bg-white hover:bg-surface-100 text-surface-700 hover:text-surface-900 border border-surface-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:hover:text-white dark:border-slate-700 whitespace-nowrap text-[11px] font-medium transition-colors shadow-xs"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-4 border-t border-surface-200 dark:border-slate-800 bg-white dark:bg-[#0d121f]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask your mentor (e.g. 'Teach me Arrays from basics', 'Explain Sliding Window', 'What should I solve next?')..."
            className="flex-1 px-4 py-3 text-xs sm:text-sm rounded-2xl bg-surface-50 dark:bg-[#080c14] border border-surface-200 dark:border-slate-800 text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white dark:focus:bg-[#0b0f19] shadow-xs"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isLoading}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-primary-600/30 disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
