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
  Cpu,
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
    setAgentProblem,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-2xl md:max-w-3xl lg:max-w-4xl rounded-3xl bg-white border border-surface-200 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Glow Top Bar */}
        <div className="h-1.5 bg-gradient-to-r from-primary-600 via-pink-500 to-indigo-600 shrink-0" />

        <div className="p-6 sm:p-8 md:p-10 space-y-6 sm:space-y-8 overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-primary-600/30 shrink-0">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-mono text-primary-600 uppercase tracking-widest block font-bold">
                  Adaptive AI Mentor Debrief
                </span>
                <h3 className="text-lg sm:text-2xl font-bold text-surface-900 flex items-center gap-2 mt-0.5">
                  <span>How did you find #{problem.frontendQuestionId} {problem.title}?</span>
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors shrink-0"
              title="Close debrief"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Progress */}
          <div className="flex items-center gap-2.5">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'bg-primary-600 shadow-sm shadow-primary-600/30'
                    : s < step
                    ? 'bg-emerald-500'
                    : 'bg-surface-200'
                }`}
              />
            ))}
          </div>

          {/* QUESTION 1: Independence */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="space-y-1.5">
                <span className="text-xs font-mono text-primary-600 font-bold tracking-wider">Step 1 of 4</span>
                <h4 className="text-lg sm:text-xl font-bold text-surface-900">
                  Did you solve this problem independently?
                </h4>
                <p className="text-xs sm:text-sm text-surface-600">
                  Be honest! Your mentor uses this to calibrate your challenge curve.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[
                  {
                    id: 'independent' as IndependenceLevel,
                    title: 'Yes, completely independently.',
                    desc: 'Wrote optimal code without external hints or solution lookups.',
                    icon: CheckCircle,
                    color: 'text-emerald-600',
                  },
                  {
                    id: 'small_hint' as IndependenceLevel,
                    title: 'Yes, with a small hint.',
                    desc: 'Looked at algorithmic approach/clues but wrote the code myself.',
                    icon: Sparkles,
                    color: 'text-amber-600',
                  },
                  {
                    id: 'substantial_help' as IndependenceLevel,
                    title: 'I needed substantial help.',
                    desc: 'Read discussion solutions or tutorial walkthroughs to finish.',
                    icon: HelpCircle,
                    color: 'text-primary-600',
                  },
                  {
                    id: 'unsolved' as IndependenceLevel,
                    title: "I couldn't solve it.",
                    desc: 'Encountered test failures, TLE, or got stuck on the approach.',
                    icon: AlertTriangle,
                    color: 'text-rose-600',
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setIndependence(opt.id)}
                    className={`flex items-start gap-4 p-4 sm:p-5 rounded-2xl border text-left transition-all ${
                      independence === opt.id
                        ? 'bg-primary-50/70 border-primary-600 text-surface-900 ring-2 ring-primary-500/30 shadow-sm'
                        : 'bg-white border-surface-200 text-surface-600 hover:border-primary-300 hover:bg-surface-50'
                    }`}
                  >
                    <opt.icon className={`w-6 h-6 shrink-0 mt-0.5 ${opt.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-bold text-surface-900">{opt.title}</p>
                      <p className="text-xs sm:text-sm text-surface-600 mt-1 leading-relaxed">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* QUESTION 2: Biggest Challenge */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="space-y-1.5">
                <span className="text-xs font-mono text-primary-600 font-bold tracking-wider">Step 2 of 4</span>
                <h4 className="text-lg sm:text-xl font-bold text-surface-900">
                  What was the biggest challenge you faced?
                </h4>
                <p className="text-xs sm:text-sm text-surface-600">
                  Select the primary obstacle or specify your custom takeaway.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                    className={`p-4 rounded-xl border text-left text-xs sm:text-sm font-medium transition-all ${
                      challengeFaced === challenge && !customChallenge
                        ? 'bg-primary-50/70 border-primary-600 text-primary-900 ring-2 ring-primary-500/30 shadow-sm font-semibold'
                        : 'bg-white border-surface-200 text-surface-700 hover:border-primary-300 hover:bg-surface-50'
                    }`}
                  >
                    {challenge}
                  </button>
                ))}
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs sm:text-sm text-surface-700 font-medium">Or type a specific hurdle:</label>
                <input
                  type="text"
                  value={customChallenge}
                  onChange={(e) => setCustomChallenge(e.target.value)}
                  placeholder="e.g. Off-by-one error when contracting the left window bound..."
                  className="w-full px-4 py-3 text-xs sm:text-sm rounded-xl bg-surface-50 border border-surface-200 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* QUESTION 3: Confidence */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="space-y-1.5">
                <span className="text-xs font-mono text-primary-600 font-bold tracking-wider">Step 3 of 4</span>
                <h4 className="text-lg sm:text-xl font-bold text-surface-900">
                  How confident are you about this concept now?
                </h4>
                <p className="text-xs sm:text-sm text-surface-600">
                  Assessing your mastery helps decide whether to consolidate or advance.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {[
                  {
                    id: 'high' as ConfidenceLevel,
                    title: 'Very confident.',
                    desc: 'I could code this pattern again quickly under interview pressure.',
                    color: 'border-emerald-300 bg-emerald-50 text-emerald-800',
                  },
                  {
                    id: 'medium' as ConfidenceLevel,
                    title: 'Somewhat confident.',
                    desc: 'I understand the logic, but might struggle if the constraints mutate.',
                    color: 'border-amber-300 bg-amber-50 text-amber-800',
                  },
                  {
                    id: 'low' as ConfidenceLevel,
                    title: 'Need more practice.',
                    desc: 'I need to review similar variations before tackling harder problems.',
                    color: 'border-rose-300 bg-rose-50 text-rose-800',
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setConfidence(opt.id)}
                    className={`flex flex-col justify-between p-4 sm:p-5 rounded-2xl border text-left transition-all ${
                      confidence === opt.id
                        ? `${opt.color} ring-2 ring-primary-500/40 shadow-sm`
                        : 'bg-white border-surface-200 text-surface-600 hover:border-primary-300 hover:bg-surface-50'
                    }`}
                  >
                    <div>
                      <p className="text-sm sm:text-base font-bold text-surface-900">{opt.title}</p>
                      <p className="text-xs sm:text-sm text-surface-600 mt-1 leading-relaxed">{opt.desc}</p>
                    </div>
                    <div className="flex justify-end pt-3">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          confidence === opt.id ? 'border-primary-600 bg-primary-600' : 'border-surface-300'
                        }`}
                      >
                        {confidence === opt.id && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs sm:text-sm text-surface-700 font-medium">Personal takeaway notes (optional):</label>
                <textarea
                  value={personalNotes}
                  onChange={(e) => setPersonalNotes(e.target.value)}
                  placeholder="e.g. Always remember to check if target - current_val exists in map..."
                  rows={3}
                  className="w-full px-4 py-3 text-xs sm:text-sm rounded-xl bg-surface-50 border border-surface-200 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white resize-none"
                />
              </div>
            </div>
          )}

          {/* QUESTION 4: What would you like to solve next? */}
          {step === 4 && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="space-y-1.5">
                <span className="text-xs font-mono text-primary-600 font-bold tracking-wider">Step 4 of 4</span>
                <h4 className="text-lg sm:text-xl font-bold text-surface-900">
                  What would you like to solve next?
                </h4>
                <p className="text-xs sm:text-sm text-surface-600">
                  Your mentor never increases difficulty automatically without your consent.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                ].map((opt, idx) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPreferredNext(opt.id)}
                    className={`flex items-start justify-between p-4 sm:p-5 rounded-2xl border text-left transition-all ${
                      idx === 4 ? 'sm:col-span-2' : ''
                    } ${
                      preferredNext === opt.id
                        ? 'bg-primary-50/70 border-primary-600 text-surface-900 ring-2 ring-primary-500/30 shadow-sm'
                        : 'bg-white border-surface-200 text-surface-600 hover:border-primary-300 hover:bg-surface-50'
                    }`}
                  >
                    <div className="pr-3">
                      <p className="text-sm sm:text-base font-bold text-surface-900">{opt.title}</p>
                      <p className="text-xs sm:text-sm text-surface-600 mt-1 leading-relaxed">{opt.desc}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        preferredNext === opt.id ? 'border-primary-600 bg-primary-600' : 'border-surface-300'
                      }`}
                    >
                      {preferredNext === opt.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-4 sm:pt-6 border-t border-surface-200 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-surface-600 hover:text-surface-900 hover:bg-surface-100 flex items-center gap-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <a
                  href={problem.leetcodeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm text-surface-600 hover:text-surface-900 flex items-center gap-1.5 underline underline-offset-4"
                >
                  <span>Reopen Problem</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setAgentProblem(problem);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 text-xs font-semibold transition-all shadow-xs"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Open in AI Agent</span>
                </button>
              </div>
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 shadow-md shadow-primary-600/30 flex items-center gap-2 transition-all hover:scale-[1.02]"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishDebrief}
                disabled={isSubmitting}
                className="px-7 py-3 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 shadow-lg shadow-primary-600/30 flex items-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Consulting Mentor...' : 'Complete & Get Advice'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
