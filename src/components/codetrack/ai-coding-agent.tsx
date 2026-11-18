'use client';

import { useState, useEffect, useRef } from 'react';
import { useCodeTrackStore } from '@/lib/codetrack/store';
import { LEETCODE_PROBLEMS } from '@/lib/codetrack/data';
import {
  getStarterCode,
  getProblemTestCases,
  generateDeterministicSolution,
  generateAgentHint,
  getProblemHints,
  generateNextLineGuidance,
  type NextLineGuidance,
  analyzeAndDebugCode,
  runInBrowserTests,
  diagnoseTestFailure,
  type DiagnosticResult,
  type StructuredExplanation,
} from '@/lib/codetrack/agent';
import {
  handleTabKey,
  handleShiftTabKey,
  handleEnterKey,
  handleBackspaceKey,
  handleBracketAutoClose,
  formatCode,
  smartInsertSnippet,
  repairStrandedCode,
} from '@/lib/codetrack/indentation';
import type { LeetCodeLiveQuestion } from '@/lib/codetrack/leetcode-api';
import type { LeetCodeProblem, CodeLanguage, TestCase } from '@/types/codetrack';
import type { LangGraphExecutionStep } from '@/lib/codetrack/langgraph-agent';
import {
  Bot,
  Play,
  Sparkles,
  Bug,
  Lightbulb,
  ExternalLink,
  RotateCcw,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Terminal,
  Cpu,
  ArrowRight,
  HelpCircle,
  CheckCircle,
  ArrowLeftRight,
  Globe2,
  TrendingUp,
  Layers,
  Key,
  ShieldCheck,
  RefreshCw,
  Workflow,
  GitBranch,
  AlertTriangle,
  Zap,
  Wand2,
  PlusCircle,
  CornerDownRight,
  AlignLeft,
} from 'lucide-react';

const SUPPORTED_LANGUAGES: Array<{ id: CodeLanguage; name: string; ext: string }> = [
  { id: 'cpp', name: 'C++', ext: '.cpp' },
  { id: 'python', name: 'Python 3', ext: '.py' },
  { id: 'java', name: 'Java', ext: '.java' },
  { id: 'javascript', name: 'JavaScript', ext: '.js' },
  { id: 'typescript', name: 'TypeScript', ext: '.ts' },
];

export function AICodingAgent() {
  const {
    agentProblem,
    setAgentProblem,
    setActiveDebriefProblem,
    progressMap,
  } = useCodeTrackStore();

  // Current problem
  const [selectedProblem, setSelectedProblem] = useState<LeetCodeProblem>(
    agentProblem || LEETCODE_PROBLEMS.find((p) => p.id === 'rotate-image') || LEETCODE_PROBLEMS[0]
  );

  // Live LeetCode Data
  const [liveLeetCode, setLiveLeetCode] = useState<LeetCodeLiveQuestion | null>(null);
  const [isSyncingLeetCode, setIsSyncingLeetCode] = useState(false);

  // Studio States
  const [language, setLanguage] = useState<CodeLanguage>('cpp');
  const [code, setCode] = useState<string>('');
  const [activeConsoleTab, setActiveConsoleTab] = useState<'agent' | 'tests' | 'hints' | 'debug'>('agent');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedForLeetCode, setCopiedForLeetCode] = useState(false);
  const [formattedFeedback, setFormattedFeedback] = useState(false);
  const [isInterchanged, setIsInterchanged] = useState(true);

  // Editor & Indentation Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Agent output states
  const [structuredExplanation, setStructuredExplanation] = useState<StructuredExplanation | null>(null);
  const [agentExplanation, setAgentExplanation] = useState<string>('');
  const [timeComplexity, setTimeComplexity] = useState<string>('');
  const [spaceComplexity, setSpaceComplexity] = useState<string>('');
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [langGraphSteps, setLangGraphSteps] = useState<LangGraphExecutionStep[]>([]);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [agentHints, setAgentHints] = useState<string[]>(getProblemHints(selectedProblem));
  const [nextLineGuidance, setNextLineGuidance] = useState<NextLineGuidance | null>(null);
  const [copiedLine, setCopiedLine] = useState(false);
  const [socraticQuestion, setSocraticQuestion] = useState<string>('');
  const [debugIssues, setDebugIssues] = useState<string[]>([]);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [recommendedFixCode, setRecommendedFixCode] = useState<string>('');

  // Sync with store when problem changes externally
  useEffect(() => {
    if (agentProblem) {
      setSelectedProblem(agentProblem);
    }
  }, [agentProblem]);

  // Fetch live LeetCode data whenever selected problem changes
  useEffect(() => {
    let isCancelled = false;

    async function syncLeetCode() {
      setIsSyncingLeetCode(true);
      const slug = selectedProblem.slug || selectedProblem.id;

      try {
        const res = await fetch(`/api/codetrack/leetcode?slug=${slug}`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && data.question) {
            setLiveLeetCode(data.question);
            if (data.testCases && data.testCases.length > 0) {
              setTestCases(data.testCases);
            }

            // Load sum-based and official hints immediately
            setAgentHints(getProblemHints(selectedProblem, data.question.hints));

            // Load official LeetCode code snippet for current language if available
            const snippet = data.question.codeSnippets?.[language];
            if (snippet) {
              setCode(snippet);
            } else {
              setCode(getStarterCode(selectedProblem, language));
            }
          }
        } else {
          throw new Error('LeetCode fallback');
        }
      } catch {
        if (!isCancelled) {
          setCode(getStarterCode(selectedProblem, language));
          setTestCases(getProblemTestCases(selectedProblem));
          setAgentHints(getProblemHints(selectedProblem));
        }
      } finally {
        if (!isCancelled) setIsSyncingLeetCode(false);
      }
    }

    // Reset console states for new problem
    setStructuredExplanation(null);
    setAgentExplanation('');
    setTimeComplexity('');
    setSpaceComplexity('');
    setLangGraphSteps([]);
    setAgentHints(getProblemHints(selectedProblem));
    setNextLineGuidance(null);
    setDiagnostic(null);
    setCurrentHintIndex(0);
    setDebugIssues([]);

    syncLeetCode();

    return () => {
      isCancelled = true;
    };
  }, [selectedProblem]);

  // Language switch handler
  const handleLanguageChange = (newLang: CodeLanguage) => {
    setLanguage(newLang);

    // If official snippet is available from LeetCode, load it
    const officialSnippet = liveLeetCode?.codeSnippets?.[newLang];
    const starter = officialSnippet || getStarterCode(selectedProblem, newLang);
    setCode(starter);

    // Clear previous solve result and stale guidance so user gets fresh help in the new language
    setStructuredExplanation(null);
    setAgentExplanation('');
    setNextLineGuidance(null);
    setDiagnostic(null);
    setDebugIssues([]);
  };

  // Auto-repair any stranded code outside class/function braces whenever language !== 'python'
  useEffect(() => {
    if (language !== 'python' && code) {
      const repaired = repairStrandedCode(code, language);
      if (repaired !== code) {
        setCode(repaired);
      }
    }
  }, [code, language]);

  const handleCopyCode = async () => {
    try {
      const cleanUserCode = repairStrandedCode(code, language);
      if (cleanUserCode !== code) setCode(cleanUserCode);
      await navigator.clipboard.writeText(cleanUserCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyForLeetCode = async () => {
    try {
      const cleanUserCode = repairStrandedCode(code, language);
      if (cleanUserCode !== code) setCode(cleanUserCode);
      await navigator.clipboard.writeText(cleanUserCode);
      setCopiedForLeetCode(true);
      setTimeout(() => setCopiedForLeetCode(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleResetCode = () => {
    if (window.confirm(`Reset ${language.toUpperCase()} code to starter boilerplate?`)) {
      const official = liveLeetCode?.codeSnippets?.[language];
      setCode(getStarterCode(selectedProblem, language, official));
    }
  };

  // Agent Action: Solve with AI Agent (LangGraph Stateful Multi-Node Workflow)
  const handleSolveWithAgent = async () => {
    setIsLoading(true);
    setActiveConsoleTab('agent');

    try {
      const res = await fetch('/api/codetrack/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'solve',
          problem: selectedProblem,
          language,
          userCode: code,
          testCases,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.code) {
          setCode(data.code);
        }
        setStructuredExplanation(data.structuredExplanation || null);
        setAgentExplanation(data.explanation || '');
        setTimeComplexity(data.timeComplexity || 'O(N)');
        setSpaceComplexity(data.spaceComplexity || 'O(1)');
        if (data.graphSteps && data.graphSteps.length > 0) {
          setLangGraphSteps(data.graphSteps);
        }
        if (data.testResults && data.testResults.length > 0) {
          setTestCases(data.testResults);
        }
      } else {
        throw new Error('Local fallback');
      }
    } catch {
      const local = generateDeterministicSolution(selectedProblem, language);
      setCode(local.code);
      setStructuredExplanation(local.structuredExplanation || null);
      setAgentExplanation(local.explanation);
      setTimeComplexity(local.timeComplexity);
      setSpaceComplexity(local.spaceComplexity);
    } finally {
      setIsLoading(false);
    }
  };

  // Agent Action: Get Strategic Hint
  const handleGetHint = async () => {
    setIsLoading(true);
    setActiveConsoleTab('hints');

    try {
      const res = await fetch('/api/codetrack/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'hint',
          problem: selectedProblem,
          hintIndex: currentHintIndex,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAgentHints((prev) => Array.from(new Set([...prev, data.explanation])));
        setSocraticQuestion(data.socraticQuestion || '');
        setCurrentHintIndex((i) => i + 1);
      } else {
        throw new Error();
      }
    } catch {
      const local = generateAgentHint(selectedProblem, currentHintIndex);
      setAgentHints((prev) => Array.from(new Set([...prev, local.hint])));
      setSocraticQuestion(local.socraticQuestion);
      setCurrentHintIndex((i) => i + 1);
    } finally {
      setIsLoading(false);
    }
  };

  // Agent Action: Get Next Line Guidance & Interactive Code Help
  const handleGetNextLineHint = async (overrideCode?: string, overrideLang?: CodeLanguage) => {
    setIsLoading(true);
    setActiveConsoleTab('hints');
    const targetLang = overrideLang || language;
    const rawCode = typeof overrideCode === 'string' ? overrideCode : code;
    const targetCode = repairStrandedCode(rawCode, targetLang);
    if (targetCode !== rawCode) {
      setCode(targetCode);
    }

    try {
      const res = await fetch('/api/codetrack/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'next_line_hint',
          problem: selectedProblem,
          language: targetLang,
          userCode: targetCode,
          testCases,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.guidance) {
          setNextLineGuidance(data.guidance);
        }
      } else {
        throw new Error();
      }
    } catch {
      const local = generateNextLineGuidance(selectedProblem, targetCode, targetLang);
      setNextLineGuidance(local);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyNextLine = async (snippet: string) => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedLine(true);
      setTimeout(() => setCopiedLine(false), 2000);
    } catch {}
  };

  const handleInsertNextLine = (snippet: string) => {
    setCode((prev) => {
      const updated = smartInsertSnippet(prev, snippet, language);
      // Immediately analyze newly inserted code and calculate the next line!
      setTimeout(() => {
        handleGetNextLineHint(updated, language);
      }, 50);
      return updated;
    });
  };

  // Format / Auto-Indent current code
  const handleFormatCode = () => {
    const repaired = repairStrandedCode(code, language);
    const formatted = formatCode(repaired, language);
    setCode(formatted);
    setFormattedFeedback(true);
    setTimeout(() => setFormattedFeedback(false), 2000);
  };

  // Keyboard navigation & indentation handling for textarea
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd } = textarea;

    // 1. Tab / Shift+Tab for Indent / Dedent
    if (e.key === 'Tab') {
      e.preventDefault();
      const res = e.shiftKey
        ? handleShiftTabKey(code, selectionStart, selectionEnd, language)
        : handleTabKey(code, selectionStart, selectionEnd, language);

      setCode(res.newCode);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = res.selectionStart;
          textareaRef.current.selectionEnd = res.selectionEnd;
        }
      });
      return;
    }

    // 2. Enter for Auto-Indentation (preserves indent, increases on ':' or '{')
    if (e.key === 'Enter') {
      e.preventDefault();
      const res = handleEnterKey(code, selectionStart, selectionEnd, language);
      setCode(res.newCode);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = res.selectionStart;
          textareaRef.current.selectionEnd = res.selectionEnd;
        }
      });
      return;
    }

    // 3. Backspace for Smart Unindent (deletes 4 spaces at once if on indent line)
    if (e.key === 'Backspace') {
      const res = handleBackspaceKey(code, selectionStart, selectionEnd, language);
      if (res) {
        e.preventDefault();
        setCode(res.newCode);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = res.selectionStart;
            textareaRef.current.selectionEnd = res.selectionEnd;
          }
        });
        return;
      }
    }

    // 4. Bracket and quote auto-close & step-over
    if (['(', '[', '{', '"', "'", '`', ')', ']', '}'].includes(e.key)) {
      const res = handleBracketAutoClose(code, selectionStart, selectionEnd, e.key);
      if (res) {
        e.preventDefault();
        setCode(res.newCode);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = res.selectionStart;
            textareaRef.current.selectionEnd = res.selectionEnd;
          }
        });
        return;
      }
    }
  };

  // Agent Action: Debug My Code (Real Execution & Root Cause Diagnostics)
  const handleDebugCode = async () => {
    setIsLoading(true);
    setActiveConsoleTab('debug');
    const cleanUserCode = repairStrandedCode(code, language);
    if (cleanUserCode !== code) {
      setCode(cleanUserCode);
    }

    try {
      const res = await fetch('/api/codetrack/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'debug',
          problem: selectedProblem,
          language,
          userCode: cleanUserCode,
          testCases,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDebugIssues(data.bugsFound || []);
        setAgentExplanation(data.explanation || data.recommendedFix || '');
        if (data.diagnostic) {
          setDiagnostic(data.diagnostic);
        } else if (data.testResults && data.testResults.length > 0) {
          setDiagnostic(diagnoseTestFailure(selectedProblem, cleanUserCode, language, data.testResults));
        }
        if (data.recommendedFixCode) {
          setRecommendedFixCode(data.recommendedFixCode);
        } else {
          setRecommendedFixCode('');
        }
        if (data.testResults && data.testResults.length > 0) {
          setTestCases(data.testResults);
        }
      } else {
        throw new Error();
      }
    } catch {
      const local = analyzeAndDebugCode(selectedProblem, cleanUserCode, language);
      setDebugIssues(local.bugsFound);
      setAgentExplanation(local.advice);
      setRecommendedFixCode(local.recommendedFix);
      setDiagnostic(diagnoseTestFailure(selectedProblem, cleanUserCode, language, testCases));
    } finally {
      setIsLoading(false);
    }
  };

  // Agent Action: Auto-Correct Code with Recommended Fix
  const handleApplyFix = async () => {
    if (!recommendedFixCode) return;
    const fixedCode = repairStrandedCode(recommendedFixCode, language);
    setCode(fixedCode);
    setCopied(false);
    setIsLoading(true);
    try {
      const res = await fetch('/api/codetrack/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run_tests',
          problem: selectedProblem,
          language,
          userCode: fixedCode,
          testCases,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.testResults && data.testResults.length > 0) {
          setTestCases(data.testResults);
          const diag = data.diagnostic || diagnoseTestFailure(selectedProblem, fixedCode, language, data.testResults);
          setDiagnostic(diag);
          if (diag.isAllPassed) {
            setDebugIssues([]);
            setRecommendedFixCode('');
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Agent Action: Run Test Cases (Genuine Multi-Language Execution Engine)
  const handleRunTests = async () => {
    setIsLoading(true);
    setActiveConsoleTab('tests');
    const cleanUserCode = repairStrandedCode(code, language);
    if (cleanUserCode !== code) {
      setCode(cleanUserCode);
    }

    try {
      const res = await fetch('/api/codetrack/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run_tests',
          problem: selectedProblem,
          language,
          userCode: cleanUserCode,
          testCases,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.testResults && data.testResults.length > 0) {
          setTestCases(data.testResults);
          const diag = data.diagnostic || diagnoseTestFailure(selectedProblem, cleanUserCode, language, data.testResults);
          setDiagnostic(diag);
        }
      } else {
        throw new Error('Execution failed');
      }
    } catch {
      const fallbackTests = testCases.map((tc) => ({
        ...tc,
        passed: false,
        actualOutput: 'Runner Connection Error',
        error: 'Could not connect to code runner. Check server connection.',
      }));
      setTestCases(fallbackTests);
      setDiagnostic(diagnoseTestFailure(selectedProblem, code, language, fallbackTests));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartDebrief = () => {
    setActiveDebriefProblem(selectedProblem);
  };

  const isSolved = progressMap[selectedProblem.id]?.status === 'solved';
  const acceptanceRate = liveLeetCode?.acRate || selectedProblem.acceptance || '75.2%';

  // =========================================================================
  // =========================================================================
  // SUB-COMPONENT: CODE STUDIO PANEL
  // =========================================================================
  const renderCodeStudio = () => (
    <div className="rounded-3xl bg-white border border-surface-200 overflow-hidden shadow-sm flex flex-col">
      {/* Editor Header */}
      <div className="p-3.5 sm:p-4 bg-surface-50 border-b border-surface-200 flex items-center justify-between gap-3 flex-wrap">
        {/* Language Selector */}
        <div className="flex items-center gap-1.5 bg-surface-100 p-1 rounded-xl border border-surface-200">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              type="button"
              onClick={() => handleLanguageChange(lang.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                language === lang.id
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-surface-600 hover:text-surface-900 hover:bg-white'
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>

        {/* Editor Utilities */}
        <div className="flex items-center gap-2">
          {/* Format / Auto-Indent Code */}
          <button
            type="button"
            onClick={handleFormatCode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 hover:bg-surface-200 text-xs text-surface-700 font-semibold transition-colors"
            title="Auto-indent and normalize code structure"
          >
            {formattedFeedback ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Indented!</span>
              </>
            ) : (
              <>
                <AlignLeft className="w-3.5 h-3.5 text-primary-600" />
                <span>Format Indent</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleResetCode}
            className="p-2 rounded-xl text-surface-500 hover:text-surface-900 hover:bg-surface-100 transition-colors"
            title="Reset to official starter boilerplate"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 hover:bg-surface-200 text-xs text-surface-700 font-semibold transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Copy for LeetCode Submission Button */}
          <button
            type="button"
            onClick={handleCopyForLeetCode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-xs text-amber-800 font-semibold transition-colors"
            title="Copy clean code formatted for LeetCode editor"
          >
            {copiedForLeetCode ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Ready for LeetCode!</span>
              </>
            ) : (
              <>
                <Globe2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Copy for LeetCode</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Textarea Area with High-Contrast Slate Canvas & Line Numbers Gutter */}
      <div className="relative p-4 bg-surface-100/50 min-h-[460px] flex">
        <div className="w-full h-full min-h-[440px] bg-slate-950 rounded-2xl border border-slate-800 shadow-inner flex overflow-hidden">
          {/* Synchronized Line Numbers Gutter */}
          <div
            ref={lineNumbersRef}
            className="w-12 py-4 px-2 bg-slate-900/90 border-r border-slate-800/80 text-slate-500 font-mono text-xs sm:text-sm leading-relaxed text-right select-none overflow-hidden shrink-0"
            aria-hidden="true"
          >
            {code.split('\n').map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Textarea with Full Keyboard Indentation Support */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleEditorKeyDown}
            onBlur={() => {
              if (language !== 'python' && code) {
                const repaired = repairStrandedCode(code, language);
                if (repaired !== code) {
                  setCode(repaired);
                }
              }
            }}
            onScroll={(e) => {
              if (lineNumbersRef.current) {
                lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
              }
            }}
            spellCheck={false}
            className="flex-1 w-full h-full min-h-[440px] bg-transparent text-emerald-400 font-mono text-xs sm:text-sm leading-relaxed p-4 resize-none focus:outline-none placeholder-slate-500 overflow-y-auto whitespace-pre"
            placeholder="// Code studio ready. Write solution or click 'Solve with Agent'..."
            style={{ tabSize: language === 'javascript' || language === 'typescript' ? 2 : 4 }}
          />
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="p-4 bg-surface-50 border-t border-surface-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 1. Solve with Agent */}
          <button
            type="button"
            onClick={handleSolveWithAgent}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-primary-600/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Solve with Agent</span>
          </button>

          {/* 2. Run Test Cases */}
          <button
            type="button"
            onClick={handleRunTests}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            <span>Run Tests</span>
          </button>

          {/* 3. Debug My Code */}
          <button
            type="button"
            onClick={handleDebugCode}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-surface-100 text-surface-700 hover:text-surface-900 font-semibold text-xs border border-surface-200 transition-colors disabled:opacity-50 shadow-xs"
          >
            <Bug className="w-4 h-4 text-rose-500" />
            <span>Debug Code</span>
          </button>

          {/* 4. Agent Help (Next Line Assistant) */}
          <button
            type="button"
            onClick={() => handleGetNextLineHint()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 hover:text-primary-800 font-semibold text-xs border border-primary-200 transition-colors disabled:opacity-50 shadow-xs"
            title="Analyze your code and get guided hints on what line to write next"
          >
            <Wand2 className="w-4 h-4 text-primary-600" />
            <span>Agent Help (Next Line)</span>
          </button>

          {/* 5. Get Hint */}
          <button
            type="button"
            onClick={handleGetHint}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-surface-100 text-surface-700 hover:text-surface-900 font-semibold text-xs border border-surface-200 transition-colors disabled:opacity-50 shadow-xs"
          >
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span>Get Hint</span>
          </button>
        </div>

        {/* Complete & Open Debrief */}
        <button
          type="button"
          onClick={handleStartDebrief}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs sm:text-sm shadow-md transition-all hover:scale-105 active:scale-95"
        >
          <span>Debrief &amp; Sync</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // =========================================================================
  // SUB-COMPONENT: AGENT INTELLIGENCE CONSOLE PANEL
  // =========================================================================
  const renderAgentConsole = () => (
    <div className="rounded-3xl bg-white border border-surface-200 overflow-hidden shadow-sm flex flex-col min-h-[580px]">
      {/* HIGHLIGHTED ACTIVE PROBLEM SOLVING BANNER AT TOP OF AGENT INSIGHTS */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-b border-indigo-500/40 space-y-2.5 shadow-inner">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-amber-400 text-black shadow-xs">
              SOLVING NOW
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                selectedProblem.difficulty === 'Easy'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                  : selectedProblem.difficulty === 'Medium'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                  : 'bg-rose-500/20 text-rose-300 border-rose-400/50'
              }`}
            >
              {selectedProblem.difficulty}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-300">
            <span>LeetCode #{selectedProblem.frontendQuestionId}</span>
          </div>
        </div>

        {/* Problem Title in Big Highlighted Font */}
        <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
          <span className="text-amber-400 font-mono text-lg">#{selectedProblem.frontendQuestionId}.</span>
          <span className="text-white underline decoration-amber-400/80 decoration-2 underline-offset-4">
            {selectedProblem.title}
          </span>
        </h3>

        {/* Objective & Tags in High-Contrast Highlight */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {selectedProblem.topicTags?.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-900/80 text-indigo-200 border border-indigo-700/60"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Console Tabs */}
      <div className="p-3 bg-surface-50 border-b border-surface-200 flex items-center gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveConsoleTab('agent')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeConsoleTab === 'agent'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Agent Insights</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveConsoleTab('tests')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeConsoleTab === 'tests'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Test Suite ({testCases.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveConsoleTab('hints')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeConsoleTab === 'hints'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>Hints ({agentHints.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveConsoleTab('debug')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeConsoleTab === 'debug'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
          }`}
        >
          <Bug className="w-3.5 h-3.5" />
          <span>Diagnostics</span>
        </button>
      </div>

      {/* Console Content Area */}
      <div className="p-5 flex-1 overflow-y-auto space-y-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-8 space-y-3 text-center">
            <div className="w-10 h-10 rounded-2xl bg-primary-50 border border-primary-300 flex items-center justify-center text-primary-600 animate-spin">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-surface-600">
              Agent formulating optimal {language.toUpperCase()} solution &amp; complexity invariants...
            </p>
          </div>
        )}

        {/* TAB 1: Agent Insights */}
        {!isLoading && activeConsoleTab === 'agent' && (
          <div className="space-y-4">
            {/* LangGraph StateGraph Workflow Execution Trace */}
            {langGraphSteps.length > 0 && (
              <div className="p-4 rounded-2xl bg-surface-50 border border-primary-200 space-y-3 shadow-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary-100 text-primary-700 border border-primary-200">
                      <Workflow className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-surface-900 flex items-center gap-1.5">
                        <span>LangGraph Workflow Execution Trace</span>
                      </h4>
                      <p className="text-[10px] text-surface-500">Autonomous state graph execution &amp; self-correction</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-100 text-primary-700 border border-primary-200">
                    @langchain/langgraph
                  </span>
                </div>

                {/* StateGraph Flow Diagram Pills */}
                <div className="p-2.5 rounded-xl bg-white border border-surface-200 flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-surface-100 text-surface-600 font-semibold">START</span>
                  <span className="text-surface-400">➔</span>
                  <span className="px-2 py-0.5 rounded bg-primary-100 text-primary-700 border border-primary-200 font-semibold">
                    analyze_problem
                  </span>
                  <span className="text-surface-400">➔</span>
                  <span className="px-2 py-0.5 rounded bg-primary-100 text-primary-700 border border-primary-200 font-semibold">
                    synthesize_code
                  </span>
                  <span className="text-surface-400">➔</span>
                  <span className="px-2 py-0.5 rounded bg-primary-100 text-primary-700 border border-primary-200 font-semibold">
                    execute_and_verify
                  </span>
                  <span className="text-surface-400">⇄</span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-semibold">
                    reflect_and_fix
                  </span>
                  <span className="text-surface-400">➔</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold">
                    END
                  </span>
                </div>

                {/* Step Logs */}
                <div className="space-y-2 pt-1">
                  {langGraphSteps.map((st) => (
                    <div
                      key={st.id}
                      className="p-2.5 rounded-xl bg-white border border-surface-200 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {st.status === 'completed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : st.status === 'failed' ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                          <span className="font-semibold text-surface-900 text-[11px]">{st.title}</span>
                        </div>
                        <span className="text-[10px] font-mono text-surface-400">{st.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-surface-600 pl-5 font-sans leading-relaxed">{st.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {timeComplexity && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-surface-50 border border-surface-200 space-y-1">
                  <span className="text-[10px] font-mono text-surface-500 uppercase block font-semibold">
                    Time Complexity
                  </span>
                  <p className="text-xs font-bold text-emerald-600">{timeComplexity}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface-50 border border-surface-200 space-y-1">
                  <span className="text-[10px] font-mono text-surface-500 uppercase block font-semibold">
                    Space Complexity
                  </span>
                  <p className="text-xs font-bold text-indigo-600">{spaceComplexity}</p>
                </div>
              </div>
            )}

            {structuredExplanation ? (
              <div className="space-y-3">
                {/* Approach Title */}
                <div className="p-3.5 rounded-2xl bg-primary-50 border border-primary-200 flex items-center gap-2 text-xs font-extrabold text-primary-900">
                  <Sparkles className="w-4 h-4 text-primary-600 shrink-0" />
                  <span>{structuredExplanation.approachTitle}</span>
                </div>

                {/* Key Invariant Card */}
                <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-purple-700 font-bold uppercase tracking-wider">
                    <Key className="w-3.5 h-3.5" />
                    <span>Algorithmic Invariant</span>
                  </div>
                  <p className="text-xs text-surface-800 leading-relaxed font-medium">
                    {structuredExplanation.coreInvariant}
                  </p>
                </div>

                {/* Step-by-Step Cards */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-surface-800 block">
                    Execution Steps ({structuredExplanation.steps.length}):
                  </span>
                  {structuredExplanation.steps.map((st, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-xl bg-surface-50 border border-surface-200 text-xs text-surface-700"
                    >
                      <span className="w-5 h-5 rounded-full bg-primary-100 border border-primary-300 text-primary-700 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{st}</span>
                    </div>
                  ))}
                </div>

                {/* Edge Cases */}
                {structuredExplanation.edgeCases && (
                  <div className="pt-2 border-t border-surface-200 space-y-1.5">
                    <span className="text-[11px] font-semibold text-surface-600 block">
                      Critical Edge Cases:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {structuredExplanation.edgeCases.map((ec, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-surface-100 border border-surface-200 text-surface-700"
                        >
                          {ec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : agentExplanation ? (
              <div className="p-4 rounded-2xl bg-surface-50 border border-surface-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-primary-700">
                  <Sparkles className="w-4 h-4 text-primary-600" />
                  <span>Algorithmic Reasoning</span>
                </div>
                <div className="text-xs text-surface-700 leading-relaxed whitespace-pre-line font-sans space-y-2">
                  {agentExplanation}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center space-y-3 border border-dashed border-surface-300 rounded-2xl">
                <Bot className="w-8 h-8 text-surface-400 mx-auto" />
                <p className="text-xs text-surface-600">
                  Click <strong className="text-surface-900">Solve with Agent</strong> to run the LangGraph StateGraph autonomous coding engine.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Test Cases */}
        {!isLoading && activeConsoleTab === 'tests' && (() => {
          const allPassed = testCases.length > 0 && testCases.every((tc) => tc.passed === true);
          const hasRun = testCases.some((tc) => tc.passed !== undefined);

          return (
            <div className="space-y-4">
              {/* CELEBRATION BANNER: ALL TESTS PASSED! READY FOR LEETCODE */}
              {allPassed && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-xl space-y-3.5 border-2 border-emerald-300 animate-in zoom-in-95">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🎉</span>
                    <div>
                      <h4 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                        <span>ALL TESTS PASSED! READY FOR LEETCODE!</span>
                      </h4>
                      <p className="text-xs text-emerald-100 font-semibold leading-relaxed">
                        Your solution is 100% correct and verified against all test cases. Go ahead and put it directly into LeetCode!
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={handleCopyForLeetCode}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 font-black text-xs shadow-md transition-all hover:scale-105 active:scale-95"
                    >
                      {copiedForLeetCode ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>Copied Clean Code!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-emerald-700" />
                          <span>Copy Code for LeetCode</span>
                        </>
                      )}
                    </button>

                    <a
                      href={selectedProblem.leetcodeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs shadow-md transition-all hover:scale-105 active:scale-95"
                    >
                      <span>Submit on LeetCode</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* NON-SPOILER DIAGNOSTIC GUIDANCE WHEN IN-PROGRESS OR FAILED */}
              {hasRun && !allPassed && diagnostic && (
                <div
                  className={`p-4 rounded-2xl border-2 space-y-3 ${
                    diagnostic.isPartialSolution
                      ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                      : 'bg-rose-50/90 border-rose-300 text-rose-950'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {diagnostic.isPartialSolution ? (
                        <div className="p-1 rounded-lg bg-amber-200 text-amber-900">
                          <Sparkles className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="p-1 rounded-lg bg-rose-200 text-rose-900">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      )}
                      <h4 className="text-xs font-black uppercase tracking-wider">
                        {diagnostic.isPartialSolution
                          ? `Algorithm In-Progress (Step ${diagnostic.completedStepCount} of ${diagnostic.totalStepCount} Completed)`
                          : 'Execution Diagnostic'}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleGetNextLineHint()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs transition-all hover:scale-105 active:scale-95"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                      <span>Agent Help (Get Next Line)</span>
                    </button>
                  </div>

                  <div className="space-y-2 text-xs leading-relaxed">
                    <div className="p-3 rounded-xl bg-white/90 border border-amber-200/80 space-y-1">
                      <strong className="block text-[11px] uppercase tracking-wider text-rose-900 font-mono font-bold">
                        🔴 What is happening / What is wrong:
                      </strong>
                      <p className="text-surface-800 font-medium">{diagnostic.whatIsWrong}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-white/90 border border-amber-200/80 space-y-1">
                      <strong className="block text-[11px] uppercase tracking-wider text-emerald-900 font-mono font-bold">
                        💡 What you should do (Conceptual Direction):
                      </strong>
                      <p className="text-surface-800 font-medium">{diagnostic.whatYouShouldDo}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-surface-600 pb-1">
                <span>LeetCode Example Cases</span>
                <button
                  type="button"
                  onClick={handleRunTests}
                  className="text-primary-600 hover:text-primary-700 font-semibold"
                >
                  Re-run all
                </button>
              </div>

              {testCases.map((tc) => (
                <div
                  key={tc.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    tc.passed === true
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : tc.passed === false
                      ? 'bg-rose-50/70 border-rose-300'
                      : 'bg-surface-50 border-surface-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-surface-900">{tc.name}</span>
                    {tc.passed === true && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Passed {tc.executionTimeMs && `(${tc.executionTimeMs}ms)`}</span>
                      </span>
                    )}
                    {tc.passed === false && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Failed</span>
                      </span>
                    )}
                    {tc.passed === undefined && (
                      <span className="text-[11px] text-surface-400 font-mono">Not Run</span>
                    )}
                  </div>

                  {/* Real Error Diagnostic Box */}
                  {tc.passed === false && tc.error && (
                    <div className="mt-2.5 p-2 rounded-xl bg-rose-100/70 border border-rose-300 text-[11px] font-mono text-rose-800 break-words flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-bold text-rose-900">Execution Error:</span>
                        <p className="leading-relaxed">{tc.error}</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 space-y-1 text-[11px] font-mono">
                    <div className="text-surface-700 break-words">
                      <span className="text-surface-500 font-semibold">Input:</span> {tc.input}
                    </div>
                    <div className="text-surface-700 break-words">
                      <span className="text-surface-500 font-semibold">Expected:</span> {tc.expectedOutput}
                    </div>
                    {tc.actualOutput && (
                      <div
                        className={`break-words ${
                          tc.passed ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'
                        }`}
                      >
                        <span className="text-surface-500 font-semibold">Output:</span> {tc.actualOutput}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* TAB 3: Hints & Socratic Guidance */}
        {!isLoading && activeConsoleTab === 'hints' && (
          <div className="space-y-4">
            {/* 1. AGENT STEP ASSISTANT: NEXT LINE TO WRITE */}
            {nextLineGuidance ? (
              <div className="p-4 rounded-2xl bg-white border border-primary-200 space-y-4 shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-primary-100 text-primary-700 border border-primary-200">
                      <Wand2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-surface-900 flex items-center gap-1.5">
                        <span>Agent Step Assistant: Next Line Guidance</span>
                      </h4>
                      <p className="text-[11px] text-primary-700 font-semibold">{nextLineGuidance.currentPhase}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleGetNextLineHint()}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-100 hover:bg-surface-200 text-surface-800 font-bold text-[11px] border border-surface-200 transition-colors shadow-xs"
                    title="Check editor code and calculate the next line"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-primary-600" />
                    <span>Re-evaluate Code</span>
                  </button>
                </div>

                {/* Step Progression Pills */}
                {nextLineGuidance.steps && nextLineGuidance.steps.length > 0 && (
                  <div className="p-3 rounded-xl bg-surface-50 border border-surface-200 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase text-surface-500">
                      <span>Step-by-Step Algorithm Path</span>
                      <span>
                        {nextLineGuidance.steps.filter((s) => s.completed).length} of {nextLineGuidance.steps.length} Steps Done
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {nextLineGuidance.steps.map((st) => (
                        <div
                          key={st.number}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                            st.completed
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold'
                              : st.number === nextLineGuidance.currentStepIndex
                              ? 'bg-primary-600 text-white font-bold ring-2 ring-primary-300 shadow-xs'
                              : 'bg-white text-surface-500 border border-surface-200'
                          }`}
                        >
                          {st.completed ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                          ) : st.number === nextLineGuidance.currentStepIndex ? (
                            <Wand2 className="w-3 h-3 text-white shrink-0 animate-pulse" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-surface-300 shrink-0" />
                          )}
                          <span>
                            Step {st.number}: {st.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Warning / Variable Misalignment Banner */}
                {nextLineGuidance.activeWarning && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-[11px] font-mono text-rose-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed font-semibold">{nextLineGuidance.activeWarning}</p>
                  </div>
                )}

                {/* CELEBRATION BANNER IF ALL STEPS COMPLETED */}
                {nextLineGuidance.status === 'ready_to_test' && (
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-xl space-y-3.5 border-2 border-emerald-300 animate-in zoom-in-95">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🎉</span>
                      <div>
                        <h4 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                          <span>ALL ALGORITHMIC STEPS COMPLETE! READY FOR LEETCODE!</span>
                        </h4>
                        <p className="text-xs text-emerald-100 font-semibold leading-relaxed">
                          All {nextLineGuidance.totalSteps} steps are implemented. Click 'Run Tests' to verify all test cases, or copy clean code directly for LeetCode!
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={handleRunTests}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 font-black text-xs shadow-md transition-all hover:scale-105 active:scale-95"
                      >
                        <Play className="w-4 h-4 text-emerald-700" />
                        <span>Run Test Suite</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyForLeetCode}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs shadow-md transition-all hover:scale-105 active:scale-95"
                      >
                        {copiedForLeetCode ? <Check className="w-4 h-4 text-black" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedForLeetCode ? 'Copied Clean Code!' : 'Copy Code for LeetCode'}</span>
                      </button>

                      <a
                        href={selectedProblem.leetcodeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-800/80 hover:bg-emerald-800 text-white font-bold text-xs border border-emerald-400/50 shadow-xs"
                      >
                        <span>Submit on LeetCode</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                {/* SUGGESTED CODE BOX WITH PROMINENT ATTACHED "WHY THIS LINE IS NEEDED" */}
                <div className="rounded-2xl border-2 border-primary-500/80 bg-white overflow-hidden shadow-sm">
                  {/* Header */}
                  <div className="p-3 bg-gradient-to-r from-primary-700 via-primary-600 to-indigo-700 text-white flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-amber-300 animate-pulse" />
                      <span className="font-black text-xs uppercase tracking-wider">Suggested Code for Next Line:</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyNextLine(nextLineGuidance.nextLineSnippet)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-white font-bold border border-white/20 shadow-xs"
                      >
                        {copiedLine ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                            <span className="text-emerald-200">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Line</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInsertNextLine(nextLineGuidance.nextLineSnippet)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[11px] text-black font-black transition-all shadow-md hover:scale-105 active:scale-95"
                        title="Insert this line into the editor"
                      >
                        <CornerDownRight className="w-3.5 h-3.5" />
                        <span>Insert Line</span>
                      </button>
                    </div>
                  </div>

                  {/* Code Snippet Pre Box */}
                  <div className="p-3.5 bg-slate-950 border-b border-slate-800">
                    <pre className="text-xs sm:text-sm font-mono text-emerald-400 whitespace-pre-wrap select-all font-bold">
                      {nextLineGuidance.nextLineSnippet}
                    </pre>
                  </div>

                  {/* PROMINENT "WHY WE ARE PUTTING THIS LINE" (ATTACHED DIRECTLY UNDERNEATH) */}
                  <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/70 border-t border-amber-200/90 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-950 uppercase tracking-wide">
                      <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>WHY WE ARE PUTTING THIS LINE:</span>
                    </div>

                    <p className="text-xs sm:text-sm text-amber-950 font-bold leading-relaxed">
                      {nextLineGuidance.whyThisLine || nextLineGuidance.explanation}
                    </p>

                    {nextLineGuidance.howItWorks && (
                      <div className="p-2.5 rounded-xl bg-white/90 border border-amber-200 text-xs text-amber-900 leading-relaxed font-sans">
                        <strong className="text-amber-950 font-bold">How the syntax works: </strong>
                        {nextLineGuidance.howItWorks}
                      </div>
                    )}

                    {nextLineGuidance.beginnerAnalogy && (
                      <div className="p-2.5 rounded-xl bg-white/90 border border-amber-200 text-xs text-amber-950 flex items-start gap-2 shadow-2xs">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <strong className="block text-[11px] uppercase tracking-wider text-amber-900 font-mono font-bold">
                            Intuitive Real-World Analogy:
                          </strong>
                          <p className="leading-relaxed">{nextLineGuidance.beginnerAnalogy}</p>
                        </div>
                      </div>
                    )}

                    {nextLineGuidance.mistakeToAvoid && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950 flex items-start gap-2 shadow-2xs">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <strong className="block text-[11px] uppercase tracking-wider text-rose-900 font-mono font-bold">
                            Beginner Trap to Avoid:
                          </strong>
                          <p className="leading-relaxed">{nextLineGuidance.mistakeToAvoid}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Key Guidance Points */}
                {nextLineGuidance.guidancePoints && nextLineGuidance.guidancePoints.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-mono text-purple-700 font-bold uppercase tracking-wider block">
                      Implementation Checklist:
                    </span>
                    <div className="space-y-1">
                      {nextLineGuidance.guidancePoints.map((pt, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-surface-700">
                          <span className="text-primary-600 font-bold shrink-0">•</span>
                          <span className="leading-relaxed">{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary-100 text-primary-700 border border-primary-200">
                    <Wand2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-surface-900">Stuck on the next line?</h5>
                    <p className="text-[11px] text-surface-600">Get context-aware help on what line to write next based on your current code.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleGetNextLineHint()}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs transition-all hover:scale-105 active:scale-95"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Agent Help (Next Line)</span>
                </button>
              </div>
            )}

            {/* 2. DEDICATED SEPARATE ALGORITHMIC HINTS BOX DOWN BELOW */}
            <div className="rounded-2xl border-2 border-amber-300 bg-white shadow-md overflow-hidden">
              {/* Box Header */}
              <div className="p-3.5 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-white/20 text-white shadow-xs">
                    <Lightbulb className="w-4 h-4 text-amber-100" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                      <span>Algorithmic Hints &amp; Concept Clues</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/25 text-white font-bold">
                        {agentHints.length} Clues
                      </span>
                    </h4>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGetHint}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white text-amber-900 font-black text-[11px] shadow-xs hover:bg-amber-50 transition-all hover:scale-105 active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>+ Next Clue</span>
                </button>
              </div>

              {/* Clues Box Body */}
              <div className="p-4 bg-gradient-to-b from-amber-50/40 via-white to-amber-50/20 space-y-3">
                {agentHints.length > 0 ? (
                  agentHints.map((h, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-white border border-amber-200/90 shadow-2xs space-y-1.5 hover:border-amber-400 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100/80 border border-amber-200 text-[10px] font-mono font-black text-amber-900 uppercase">
                          <Lightbulb className="w-3 h-3 text-amber-700" />
                          <span>CLUE {i + 1}</span>
                        </div>
                        <span className="text-[10px] text-amber-700/70 font-mono font-medium">
                          Progressive Hint #{i + 1}
                        </span>
                      </div>
                      <p className="text-xs text-amber-950 font-medium leading-relaxed pl-0.5 pt-0.5">
                        {h}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center space-y-2 border border-dashed border-amber-200 rounded-xl bg-white/60">
                    <Lightbulb className="w-6 h-6 text-amber-400 mx-auto" />
                    <p className="text-xs text-amber-900 font-medium">
                      No clues revealed yet. Click <strong>+ Next Clue</strong> above or in the bottom bar to uncover algorithmic insights step-by-step.
                    </p>
                  </div>
                )}

                {/* Socratic Inquiry Prompt inside the box */}
                {socraticQuestion && (
                  <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200 text-xs text-purple-950 space-y-1">
                    <strong className="block text-[10px] uppercase font-mono font-bold text-purple-800 tracking-wider">
                      🎯 Socratic Thinking Prompt:
                    </strong>
                    <p className="leading-relaxed font-medium">{socraticQuestion}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Diagnostics & Bugs */}
        {!isLoading && activeConsoleTab === 'debug' && (
          <div className="space-y-4">
            {diagnostic?.isAllPassed ? (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-xl space-y-4 border-2 border-emerald-300 animate-in zoom-in-95">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-100 shrink-0" />
                  <div>
                    <h4 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                      <span>🎉 ZERO BUGS DETECTED — 100% CORRECT!</span>
                    </h4>
                    <p className="text-xs text-emerald-100 font-semibold leading-relaxed">
                      All test cases passed with zero errors. Your algorithm logic and syntax in {language === 'cpp' ? 'C++' : language === 'java' ? 'Java' : language === 'python' ? 'Python' : language} are completely verified and ready for LeetCode!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={handleCopyForLeetCode}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 font-black text-xs shadow-md transition-all hover:scale-105 active:scale-95"
                  >
                    {copiedForLeetCode ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Copied Clean Code!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-emerald-700" />
                        <span>Copy Code for LeetCode</span>
                      </>
                    )}
                  </button>

                  <a
                    href={selectedProblem.leetcodeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs shadow-md transition-all hover:scale-105 active:scale-95"
                  >
                    <span>Submit on LeetCode</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <>
                {/* One-Click Auto-Correct Button Card */}
                {recommendedFixCode && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white shadow-xl space-y-3 border-2 border-purple-500/40 animate-in fade-in-50">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                          <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                            One-Click Solution Auto-Correct
                          </h4>
                        </div>
                        <p className="text-[11px] text-purple-200 font-medium">
                          Automatically corrects syntax, errors, and algorithmic logic for {language === 'cpp' ? 'C++' : language === 'java' ? 'Java' : language === 'python' ? 'Python' : language} and immediately verifies all test cases.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleApplyFix}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-surface-950 font-black text-xs shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <Wand2 className="w-4 h-4 text-surface-950" />
                        <span>🪄 Auto-Correct Code & Pass Tests</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Non-Spoiler Conceptual Diagnostics Card */}
                {diagnostic && (
                  <div
                    className={`p-4 rounded-2xl border-2 space-y-3 ${
                      diagnostic.isPartialSolution
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-rose-50 border-rose-300 text-rose-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Bug className="w-4 h-4 text-rose-600" />
                        <h4 className="text-xs font-black uppercase tracking-wider">
                          {diagnostic.isPartialSolution
                            ? `Algorithm Status (Step ${diagnostic.completedStepCount} of ${diagnostic.totalStepCount})`
                            : 'Issue Diagnosis & Conceptual Guidance'}
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGetNextLineHint()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs transition-all hover:scale-105 active:scale-95"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                        <span>Agent Help (Next Line)</span>
                      </button>
                    </div>

                    <div className="space-y-2 text-xs leading-relaxed">
                      {diagnostic.whatIsWrong && (
                        <div className="p-3 rounded-xl bg-white/90 border border-surface-200 space-y-1">
                          <strong className="block text-[11px] uppercase tracking-wider text-rose-900 font-mono font-bold">
                            🔴 What is wrong / Issue description:
                          </strong>
                          <p className="text-surface-800 font-medium">{diagnostic.whatIsWrong}</p>
                        </div>
                      )}

                      <div className="p-3 rounded-xl bg-white/90 border border-surface-200 space-y-1">
                        <strong className="block text-[11px] uppercase tracking-wider text-emerald-900 font-mono font-bold">
                          💡 What you should do (Concept, No Spoilers):
                        </strong>
                        <p className="text-surface-800 font-medium">{diagnostic.whatYouShouldDo}</p>
                      </div>
                    </div>
                  </div>
                )}

                {debugIssues.length > 0 ? (
                  <div className="space-y-2.5">
                    <span className="text-xs font-bold text-surface-800 block">
                      Detailed Code Issues:
                    </span>
                    {debugIssues.map((issue, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-surface-50 border border-surface-200 flex items-start gap-2.5 text-xs text-surface-700"
                      >
                        <Bug className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                ) : !diagnostic && !recommendedFixCode ? (
                  <div className="p-6 text-center space-y-3 border border-dashed border-surface-300 rounded-2xl">
                    <Bug className="w-8 h-8 text-surface-400 mx-auto" />
                    <p className="text-xs text-surface-600">
                      Click <strong className="text-surface-900">Debug Code</strong> to scan your solution for runtime exceptions, edge cases, and inefficiencies.
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Banner / Problem Header Bar */}
      <div className="p-5 sm:p-7 rounded-3xl bg-white border border-surface-200 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <div className="space-y-2.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary-50 border border-primary-200 text-primary-700 text-xs font-mono font-bold">
              <Bot className="w-3.5 h-3.5 animate-pulse" />
              <span>In-App Autonomous Coding Agent</span>
            </div>

            {/* LeetCode Live Status Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>LeetCode GraphQL Live</span>
            </div>

            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                selectedProblem.difficulty === 'Easy'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : selectedProblem.difficulty === 'Medium'
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-rose-50 text-rose-700 border-rose-300'
              }`}
            >
              {selectedProblem.difficulty}
            </span>

            {/* LeetCode Acceptance Stat */}
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-100 border border-surface-200 text-surface-600">
              AC Rate: <strong className="text-surface-900">{acceptanceRate}</strong>
            </span>

            {isSolved && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Solved</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-extrabold text-surface-900 flex items-center gap-2">
              <span className="text-surface-400 font-mono">#{selectedProblem.frontendQuestionId}</span>
              <span>{selectedProblem.title}</span>
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-surface-600 max-w-3xl leading-relaxed">
            {selectedProblem.description}
          </p>

          {/* Tags */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {selectedProblem.topicTags?.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-surface-100 border border-surface-200 text-surface-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Problem Switcher & LeetCode Links */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto shrink-0">
          <div className="relative">
            <select
              value={selectedProblem.id}
              onChange={(e) => {
                const found = LEETCODE_PROBLEMS.find((p) => p.id === e.target.value);
                if (found) {
                  setSelectedProblem(found);
                  setAgentProblem(found);
                }
              }}
              className="w-full sm:w-64 px-3.5 py-2 text-xs rounded-xl bg-white border border-surface-200 text-surface-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs cursor-pointer"
            >
              {LEETCODE_PROBLEMS.map((prob) => (
                <option key={prob.id} value={prob.id}>
                  #{prob.frontendQuestionId} {prob.title} ({prob.difficulty})
                </option>
              ))}
            </select>
          </div>

          {/* LeetCode External Link */}
          <a
            href={selectedProblem.leetcodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs transition-all shadow-md shadow-orange-500/20"
            title="Open and submit on official LeetCode"
          >
            <span>Solve on LeetCode</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Interchange Panels Button */}
          <button
            type="button"
            onClick={() => setIsInterchanged((v) => !v)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-100 hover:bg-surface-200 border border-surface-200 text-xs font-semibold text-primary-700 hover:text-primary-800 transition-all shadow-xs"
            title="Interchange Left and Right panels"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-primary-600" />
            <span className="hidden sm:inline">{isInterchanged ? 'Original Layout' : 'Interchange'}</span>
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Left / Right interchangeable */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column */}
        <div className={`lg:col-span-5 space-y-4 ${isInterchanged ? 'lg:order-1' : 'lg:order-2'}`}>
          {renderAgentConsole()}
        </div>

        {/* Right Column */}
        <div className={`lg:col-span-7 space-y-4 ${isInterchanged ? 'lg:order-2' : 'lg:order-1'}`}>
          {renderCodeStudio()}
        </div>
      </div>
    </div>
  );
}
