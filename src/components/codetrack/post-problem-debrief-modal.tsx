'use client';

import { useState } from 'react';
import { useCodeTrackStore } from '@/lib/codetrack/store';
import type {
  LeetCodeProblem,
  IndependenceLevel,
  ConfidenceLevel,
  NextPreference,
  ProblemStatus,
} from '@/types/codetrack';
import {
  Bot,
  Sparkles,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  Send,
  ExternalLink,
} from 'lucide-react';

interface PostProblemDebriefModalProps {
  problem: LeetCodeProblem | null;
  onClose: () => void;
}

export function PostProblemDebriefModal({
  problem,
  onClose,
}: PostProblemDebriefModalProps) {
  const {
    level,
    preferredDifficulty,
    progressMap,
    updateProblemProgress,
    addMentorMessage,
    setActiveTab,
    setActiveDebriefProblem,
  } = useCodeTrackStore();

  const [step, setStep] = useState<number>(1);
  const [independence, setIndependence] = useState<IndependenceLevel>('independent');
  const [challengeFaced, setChallengeFaced] = useState<string>('Identifying the correct approach');
  const [customChallenge, setCustomChallenge] = useState<string>('');
  const [confidence, setConfidence] = useState<ConfidenceLevel>('high');
  const [preferredNext, setPreferredNext] = useState<NextPreference>('similar_concept');
  const [personalNotes, setPersonalNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!problem) return null;

  const currentAttempts = (progressMap[problem.id]?.attempts || 0) + 1;

  const handleFinishDebrief = async () => {
    setIsSubmitting(true);
    const finalChallenge = customChallenge.trim() || challengeFaced;

    // Determine status:
    // If couldn't solve -> 'attempted'
    // If needed substantial help or low confidence -> 'practice'
    // If independent or small hint with medium/high confidence -> 'solved'
    let derivedStatus: ProblemStatus = 'solved';
    if (independence === 'unsolved') {
      derivedStatus = 'attempted';
    } else if (independence === 'substantial_help' || confidence === 'low') {
      derivedStatus = 'practice';
    }

    try {
      // 1. Update store
      updateProblemProgress({
        problemId: problem.id,
        topicId: problem.topicId,
        difficulty: problem.difficulty,
        status: derivedStatus,
        notes: personalNotes,
        independence,
        challengeFaced: finalChallenge,
        confidence,
        preferredNext,
      });

      // 2. Persist to API
      await fetch('/api/codetrack/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: problem.id,
          topicId: problem.topicId,
          difficulty: problem.difficulty,
          status: derivedStatus,
          notes: personalNotes,
          independence,
          challengeFaced: finalChallenge,
          confidence,
          preferredNext,
        }),
      }).catch(() => {});

      // 3. Request tailored recommendation from AI Mentor
      const mentorRes = await fetch('/api/codetrack/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userLevel: level || 'beginner',
          preferredDifficulty,
          currentTopicId: problem.topicId,
          progressMap,
          recentDebrief: {
            problemId: problem.id,
            independence,
            challengeFaced: finalChallenge,
            confidence,
            preferredNext,
          },
        }),
      });

      if (mentorRes.ok) {
        const data = await mentorRes.json();
        addMentorMessage({
          sender: 'assistant',
          content: `🎯 **Debrief Completed for #${problem.frontendQuestionId} ${problem.title}**\n\n${data.message}`,
          recommendationReason: data.recommendationReason,
          recommendedProblem: data.recommendedProblem,
          suggestions: data.suggestions,
        });
      }
    } finally {
      setIsSubmitting(false);
      onClose();
      // Switch user to AI Mentor tab to see their personalized learning advice
      setActiveTab('mentor');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Glow Top Bar */}
        <div className="h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500" />

        <div className="p-6 sm:p-7 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-mono text-purple-400 uppercase tracking-widest block font-semibold">
                  Adaptive AI Mentor Debrief
                </span>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>How did you find #{problem.frontendQuestionId} {problem.title}?</span>
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Progress */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'bg-purple-500 shadow-sm shadow-purple-500/50'
                    : s < step
                    ? 'bg-emerald-500'
                    : 'bg-zinc-800'
                }`}
              />
            ))}
          </div>

          {/* QUESTION 1: Independence */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="space-y-1">
                <span className="text-xs font-mono text-zinc-500">Step 1 of 4</span>
                <h4 className="text-base font-semibold text-white">
                  Did you solve this problem independently?
                </h4>
                <p className="text-xs text-zinc-400">
                  Be honest! Your mentor uses this to calibrate your challenge curve.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  {
                    id: 'independent' as IndependenceLevel,
                    title: 'Yes, completely independently.',
                    desc: 'Wrote optimal code without external hints or solution lookups.',
                    icon: CheckCircle,
                    color: 'text-emerald-400',
                  },
                  {
                    id: 'small_hint' as IndependenceLevel,
                    title: 'Yes, with a small hint.',
                    desc: 'Looked at algorithmic approach/clues but wrote the code myself.',
                    icon: Sparkles,
                    color: 'text-amber-400',
                  },
                  {
                    id: 'substantial_help' as IndependenceLevel,
                    title: 'I needed substantial help.',
                    desc: 'Read discussion solutions or tutorial walkthroughs to finish.',
                    icon: HelpCircle,
                    color: 'text-purple-400',
                  },
                  {
                    id: 'unsolved' as IndependenceLevel,
                    title: "I couldn't solve it.",
                    desc: 'Encountered test failures, TLE, or got stuck on the approach.',
                    icon: AlertTriangle,
                    color: 'text-rose-400',
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setIndependence(opt.id)}
                    className={`flex items-start gap-3.5 p-3.5 rounded-2xl border text-left transition-all ${
                      independence === opt.id
                        ? 'bg-purple-500/15 border-purple-500 text-white ring-1 ring-purple-500/40'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <opt.icon className={`w-5 h-5 shrink-0 mt-0.5 ${opt.color}`} />
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm font-bold text-white">{opt.title}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* QUESTION 2: Biggest Challenge */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="space-y-1">
                <span className="text-xs font-mono text-zinc-500">Step 2 of 4</span>
                <h4 className="text-base font-semibold text-white">
                  What was the biggest challenge you faced?
                </h4>
                <p className="text-xs text-zinc-400">
                  Select the primary obstacle or specify your custom takeaway.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  'Understanding the problem',
                  'Identifying the correct approach',
                  'Choosing the right data structure',
                  'Writing the code',
                  'Debugging edge cases',
                  'Time and space complexity',
                ].map((challenge) => (
                  <button
                    key={challenge}
                    type="button"
                    onClick={() => {
                      setChallengeFaced(challenge);
                      setCustomChallenge('');
                    }}
                    className={`p-3 rounded-xl border text-left text-xs font-medium transition-all ${
                      challengeFaced === challenge && !customChallenge
                        ? 'bg-purple-500/20 border-purple-500 text-white ring-1 ring-purple-500/50'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    {challenge}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-xs text-zinc-400 font-medium">Or type a specific hurdle:</label>
                <input
                  type="text"
                  value={customChallenge}
                  onChange={(e) => setCustomChallenge(e.target.value)}
                  placeholder="e.g. Off-by-one error when contracting the left window bound..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {/* QUESTION 3: Confidence */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="space-y-1">
                <span className="text-xs font-mono text-zinc-500">Step 3 of 4</span>
                <h4 className="text-base font-semibold text-white">
                  How confident are you about this concept now?
                </h4>
                <p className="text-xs text-zinc-400">
                  Assessing your mastery helps decide whether to consolidate or advance.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  {
                    id: 'high' as ConfidenceLevel,
                    title: 'Very confident.',
                    desc: 'I could code this pattern again quickly under interview pressure.',
                    color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
                  },
                  {
                    id: 'medium' as ConfidenceLevel,
                    title: 'Somewhat confident.',
                    desc: 'I understand the logic, but might struggle if the constraints mutate.',
                    color: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
                  },
                  {
                    id: 'low' as ConfidenceLevel,
                    title: 'Need more practice.',
                    desc: 'I need to review similar variations before tackling harder problems.',
                    color: 'border-rose-500/40 bg-rose-500/10 text-rose-400',
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setConfidence(opt.id)}
                    className={`flex items-start justify-between p-3.5 rounded-2xl border text-left transition-all ${
                      confidence === opt.id
                        ? `${opt.color} ring-1 ring-purple-500/40`
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-white">{opt.title}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{opt.desc}</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        confidence === opt.id ? 'border-purple-400 bg-purple-500' : 'border-zinc-700'
                      }`}
                    >
                      {confidence === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-xs text-zinc-400 font-medium">Personal takeaway notes (optional):</label>
                <textarea
                  value={personalNotes}
                  onChange={(e) => setPersonalNotes(e.target.value)}
                  placeholder="e.g. Always remember to check if target - current_val exists in map..."
                  rows={2}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* QUESTION 4: What would you like to solve next? */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="space-y-1">
                <span className="text-xs font-mono text-zinc-500">Step 4 of 4</span>
                <h4 className="text-base font-semibold text-white">
                  What would you like to solve next?
                </h4>
                <p className="text-xs text-zinc-400">
                  Your mentor never increases difficulty automatically without your consent.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  {
                    id: 'another_easy' as NextPreference,
                    title: 'Another Easy problem.',
                    desc: 'Build consistency on fundamentals before increasing complexity.',
                  },
                  {
                    id: 'medium' as NextPreference,
                    title: 'A Medium problem.',
                    desc: 'Level up to real-world interview difficulty.',
                  },
                  {
                    id: 'hard' as NextPreference,
                    title: 'A Hard problem.',
                    desc: 'Test algorithmic mastery on complex constraints and optimizations.',
                  },
                  {
                    id: 'similar_concept' as NextPreference,
                    title: 'A similar problem using the same concept.',
                    desc: `Solidify ${problem.topicId} patterns with immediate reinforcement.`,
                  },
                  {
                    id: 'revise_topic' as NextPreference,
                    title: 'Revise this topic first.',
                    desc: 'Review explanations and common pitfalls before next question.',
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPreferredNext(opt.id)}
                    className={`flex items-start justify-between p-3.5 rounded-2xl border text-left transition-all ${
                      preferredNext === opt.id
                        ? 'bg-purple-500/15 border-purple-500 text-white ring-1 ring-purple-500/40'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-white">{opt.title}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{opt.desc}</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        preferredNext === opt.id ? 'border-purple-400 bg-purple-500' : 'border-zinc-700'
                      }`}
                    >
                      {preferredNext === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-3 border-t border-zinc-900 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <a
                href={problem.leetcodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 underline underline-offset-4"
              >
                <span>Reopen Problem</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-600/30 flex items-center gap-1.5 transition-all hover:scale-[1.02]"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishDebrief}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-600/30 flex items-center gap-1.5 transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Consulting Mentor...' : 'Complete & Get Advice'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
