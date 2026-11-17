'use client';

import { useState, useRef, useEffect } from 'react';
import { useCodeTrackStore } from '@/lib/codetrack/store';
import { useAuthStore } from '@/lib/store';
import { LEETCODE_PROBLEMS, DSA_TOPICS } from '@/lib/codetrack/data';
import type { LeetCodeProblem } from '@/types/codetrack';
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
    streak,
  } = useCodeTrackStore();

  const user = useAuthStore((s) => s.user);
  const displayName = user?.display_name || user?.username || 'Developer';

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showContextDetails, setShowContextDetails] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    <div className="flex flex-col h-[820px] rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in-50 duration-200">
      {/* Top Header & Navigation Bar */}
      <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Back to CodeTrack AI Button */}
          <button
            type="button"
            onClick={() => setActiveTab('curriculum')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
            title="Return to Curriculum and LeetCode Problem Library"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to CodeTrack AI</span>
          </button>

          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-zinc-950 rounded-full animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white">AI DSA Mentor</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Online &amp; Context-Aware
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Personalized guidance for {displayName} · {level ? level.toUpperCase() : 'BEGINNER'} Track
            </p>
          </div>
        </div>

        {/* Action Controls: Context Toggle, Clear Chat */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowContextDetails(!showContextDetails)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              showContextDetails
                ? 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-800'
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 border border-zinc-800 text-xs font-semibold transition-colors"
            title="Clear conversation and restart mentor"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        </div>
      </div>

      {/* Personalized Context Bar (Collapsible / Expandable) */}
      {showContextDetails && (
        <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800/80 text-xs text-zinc-300 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
              <span>Personalized DSA Learning Profile (Retrieved from Database)</span>
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">User: {displayName}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px]">
            <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">Skill Track</span>
              <span className="font-bold text-purple-400 uppercase">{level || 'beginner'}</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">Target Difficulty</span>
              <span className="font-bold text-indigo-400">{preferredDifficulty}</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">Solved Problems</span>
              <span className="font-bold text-emerald-400">{solvedProblems.length}</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">In Progress</span>
              <span className="font-bold text-amber-400">{attemptedProblems.length}</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">Practice Streak</span>
              <span className="font-bold text-orange-400 flex items-center gap-1">
                <Flame className="w-3 h-3" />
                <span>{streak} Days</span>
              </span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">Active Topic</span>
              <span className="font-bold text-zinc-200 truncate block">{currentTopicObj.name}</span>
            </div>
          </div>

          {hurdlesList.length > 0 && (
            <div className="mt-2 text-[11px] text-zinc-400 flex items-center gap-1.5 flex-wrap">
              <span className="text-zinc-500 font-semibold">Recorded Debrief Hurdles:</span>
              {hurdlesList.map((h, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-md bg-purple-950/60 text-purple-300 border border-purple-500/20 text-[10px]"
                >
                  {h}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
        {mentorMessages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isRuleBased = msg.source === 'rule_based';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0 mt-0.5 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[90%] sm:max-w-2xl space-y-3 p-4 sm:p-5 rounded-3xl text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-purple-600 text-white rounded-br-none shadow-md'
                    : 'bg-zinc-900/90 border border-zinc-800 text-zinc-200 rounded-bl-none shadow-lg'
                }`}
              >
                {/* Assistant Source Badge */}
                {!isUser && (
                  <div className="flex items-center justify-between pb-1 border-b border-zinc-800/80 text-[10px]">
                    <span className="font-bold text-purple-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>CodeTrack AI DSA Mentor</span>
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                        isRuleBased
                          ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                          : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                      }`}
                    >
                      {isRuleBased ? '⚡ Adaptive DSA Engine' : '✨ AI-Powered Mentor (Llama 3.3 70B)'}
                    </span>
                  </div>
                )}

                {/* Content */}
                <div className="whitespace-pre-line prose prose-invert max-w-none text-xs sm:text-sm">
                  {msg.content}
                </div>

                {/* Reason Banner if present */}
                {msg.recommendationReason && (
                  <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-[11px] text-purple-200 flex items-start gap-2.5">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-purple-400" />
                    <div>
                      <strong className="text-purple-300 block mb-0.5">Why this problem was chosen:</strong>
                      <span>{msg.recommendationReason}</span>
                    </div>
                  </div>
                )}

                {/* Single Recommended Problem Card */}
                {msg.recommendedProblem && (
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-purple-500/30 space-y-2.5 text-xs shadow-md">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold text-white flex items-center gap-1.5 text-sm">
                        <span className="text-zinc-500 font-mono">
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

                    <p className="text-zinc-400 text-[11px] line-clamp-2">
                      {msg.recommendedProblem.description}
                    </p>

                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 flex-wrap">
                      <span>Tags: {msg.recommendedProblem.topicTags.join(', ')}</span>
                      {msg.recommendedProblem.acceptance && (
                        <span>· Acceptance: {msg.recommendedProblem.acceptance}</span>
                      )}
                    </div>

                    <div className="pt-1.5 flex items-center gap-2 flex-wrap">
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
                        <Lightbulb className="w-3 h-3 text-amber-400" />
                        <span>Get Hint First</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Multiple Recommended Problems (e.g. for "Give me 5 Easy Array problems") */}
                {msg.recommendedProblems && msg.recommendedProblems.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-bold text-zinc-400 block uppercase tracking-wider">
                      Interactive Problem Recommendations ({msg.recommendedProblems.length})
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {msg.recommendedProblems.map((prob) => (
                        <div
                          key={prob.id}
                          className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-purple-500/30 flex items-center justify-between gap-3 text-xs transition-colors"
                        >
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-500 font-mono text-[10px]">
                                #{prob.frontendQuestionId}
                              </span>
                              <span className="font-semibold text-white truncate block">
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
                            <p className="text-zinc-500 text-[10px] truncate">{prob.description}</p>
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
                  <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-2">
                    {msg.suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSuggestionClick(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-zinc-800 hover:bg-purple-600 hover:text-white text-purple-300 border border-purple-500/20 transition-all hover:scale-[1.02] active:scale-95 shadow-sm"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start animate-in fade-in-50 duration-150">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0 shadow-sm">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs flex items-center gap-2.5 shadow-lg">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
              <span>Analyzing curriculum, post-problem debriefs &amp; crafting personal guidance...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Questions Row */}
      <div className="px-4 py-2 border-t border-zinc-800/80 bg-zinc-900/30 overflow-x-auto flex items-center gap-2 text-xs">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
          <HelpCircle className="w-3 h-3 text-purple-400" />
          <span>Ask Mentor:</span>
        </span>
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => handleSendMessage(q)}
            className="px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 whitespace-nowrap text-[11px] font-medium transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/50">
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
            className="flex-1 px-4 py-3 text-xs sm:text-sm rounded-2xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-inner"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isLoading}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-purple-600/30 disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
