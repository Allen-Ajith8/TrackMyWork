import {
  LEETCODE_PROBLEMS,
  DSA_TOPICS,
  getTopicsByLevel,
  getProblemsByTopic,
} from './data';
import { fetchLiveLeetCodeDailyChallenge } from './daily';
import type {
  DSALevel,
  Difficulty,
  PreferredDifficulty,
  LeetCodeProblem,
  UserProblemProgress,
  IndependenceLevel,
  ConfidenceLevel,
  NextPreference,
} from '@/types/codetrack';

export interface MentorContext {
  userLevel: DSALevel;
  preferredDifficulty?: PreferredDifficulty;
  currentTopicId?: string;
  progressMap: Record<string, UserProblemProgress>;
  userQuery?: string;
  recentDebrief?: {
    problemId: string;
    independence?: IndependenceLevel;
    challengeFaced?: string;
    confidence?: ConfidenceLevel;
    preferredNext?: NextPreference;
  };
}

export interface RecommendationResult {
  message: string;
  recommendationReason?: string;
  recommendedProblem?: LeetCodeProblem;
  recommendedProblems?: LeetCodeProblem[];
  conceptExplanation?: string;
  source?: 'llm' | 'rule_based';
  suggestions: Array<{
    label: string;
    action: 'solve' | 'revise' | 'difficulty' | 'topic' | 'custom';
    payload?: string;
  }>;
}

/**
 * Intelligent recommendation engine that analyzes:
 * - Skill level & preferred difficulty
 * - Post-problem debrief answers (independence, challenge, confidence, next preference)
 * - Attempt counts and topic mastery
 * - Avoids solved problems and explains WHY the problem was chosen.
 */
export function getIntelligentRecommendation(context: MentorContext): RecommendationResult {
  const {
    userLevel,
    preferredDifficulty = 'Mixed Practice',
    currentTopicId = 'arrays',
    progressMap,
    recentDebrief,
  } = context;

  const solvedIds = Object.keys(progressMap).filter((id) => progressMap[id]?.status === 'solved');
  const activeTopic = DSA_TOPICS.find((t) => t.id === currentTopicId) || DSA_TOPICS[0];
  const topicProblems = getProblemsByTopic(activeTopic.id);
  const unsolvedTopicProblems = topicProblems.filter((p) => !solvedIds.includes(p.id));

  // Determine target difficulty with respect to strict user preference:
  let targetDifficulty: Difficulty = 'Easy';

  if (preferredDifficulty === 'Easy') {
    targetDifficulty = 'Easy';
  } else if (preferredDifficulty === 'Medium') {
    targetDifficulty = 'Medium';
  } else if (preferredDifficulty === 'Hard') {
    targetDifficulty = 'Hard';
  } else {
    // Mixed Practice: calculate adaptive difficulty
    if (userLevel === 'beginner') {
      targetDifficulty = 'Easy';
    } else if (userLevel === 'intermediate') {
      targetDifficulty = 'Medium';
    } else {
      targetDifficulty = 'Hard';
    }
  }

  // Evaluate recent debrief if available
  if (recentDebrief) {
    const recentProblem = LEETCODE_PROBLEMS.find((p) => p.id === recentDebrief.problemId);
    const title = recentProblem?.title || 'the last challenge';

    // CASE E: User explicitly chooses preferred next
    if (recentDebrief.preferredNext === 'another_easy') {
      const easyCandidate = unsolvedTopicProblems.find((p) => p.difficulty === 'Easy') ||
        LEETCODE_PROBLEMS.find((p) => p.difficulty === 'Easy' && !solvedIds.includes(p.id));

      if (easyCandidate) {
        return {
          message: `Got it! You chose to continue with an **Easy** problem. Practicing fundamentals builds ironclad muscle memory. Let's tackle **${easyCandidate.title}** (#${easyCandidate.frontendQuestionId}).`,
          recommendationReason: `Selected per your preference for an Easy problem to reinforce foundational patterns.`,
          recommendedProblem: easyCandidate,
          source: 'rule_based',
          suggestions: [
            { label: `Solve #${easyCandidate.frontendQuestionId} ${easyCandidate.title}`, action: 'solve', payload: easyCandidate.id },
            { label: 'Show problem hint first', action: 'custom', payload: `hint:${easyCandidate.id}` },
            { label: 'Explore other topics', action: 'topic' },
          ],
        };
      }
    }

    if (recentDebrief.preferredNext === 'medium') {
      const medCandidate = unsolvedTopicProblems.find((p) => p.difficulty === 'Medium') ||
        LEETCODE_PROBLEMS.find((p) => p.difficulty === 'Medium' && !solvedIds.includes(p.id));

      if (medCandidate) {
        return {
          message: `Ready for a step up! You selected a **Medium** challenge. Here is **${medCandidate.title}** (#${medCandidate.frontendQuestionId}) in ${activeTopic.name}. Take your time breaking down the test cases.`,
          recommendationReason: `Selected because you opted to level up to a Medium problem in ${activeTopic.name}.`,
          recommendedProblem: medCandidate,
          source: 'rule_based',
          suggestions: [
            { label: `Solve #${medCandidate.frontendQuestionId} ${medCandidate.title}`, action: 'solve', payload: medCandidate.id },
            { label: 'Show problem hint first', action: 'custom', payload: `hint:${medCandidate.id}` },
            { label: 'Stay on Easy instead', action: 'difficulty', payload: 'Easy' },
          ],
        };
      }
    }

    if (recentDebrief.preferredNext === 'hard') {
      const hardCandidate = unsolvedTopicProblems.find((p) => p.difficulty === 'Hard') ||
        LEETCODE_PROBLEMS.find((p) => p.difficulty === 'Hard' && !solvedIds.includes(p.id));

      if (hardCandidate) {
        return {
          message: `Ambitious move! You selected a **Hard** challenge. Let's test your algorithmic limits on **${hardCandidate.title}** (#${hardCandidate.frontendQuestionId}). Remember to analyze boundary conditions and space constraints.`,
          recommendationReason: `Selected because you requested a high-difficulty challenge to test advanced edge cases.`,
          recommendedProblem: hardCandidate,
          source: 'rule_based',
          suggestions: [
            { label: `Solve #${hardCandidate.frontendQuestionId} ${hardCandidate.title}`, action: 'solve', payload: hardCandidate.id },
            { label: 'Show problem hint first', action: 'custom', payload: `hint:${hardCandidate.id}` },
            { label: 'Try Medium instead', action: 'difficulty', payload: 'Medium' },
          ],
        };
      }
    }

    if (recentDebrief.preferredNext === 'revise_topic') {
      return {
        message: `Wise decision! Taking time to revise **${activeTopic.name}** concepts before moving forward prevents recurring bugs. Review the core concepts and retry any problem where you used hints.`,
        recommendationReason: `Focusing on concept revision as requested to solidify core invariants.`,
        source: 'rule_based',
        suggestions: [
          { label: `Review ${activeTopic.name} problem list`, action: 'topic', payload: activeTopic.id },
          { label: 'Explain common mistakes in this topic', action: 'custom', payload: `explain:${activeTopic.id}` },
          { label: 'Give me a quick quiz problem', action: 'solve' },
        ],
      };
    }

    // CASE B: Needed substantial help / hints
    if (
      recentDebrief.independence === 'substantial_help' ||
      recentDebrief.independence === 'unsolved' ||
      recentDebrief.confidence === 'low'
    ) {
      const similarCandidate = unsolvedTopicProblems.find((p) => p.difficulty === 'Easy') ||
        unsolvedTopicProblems[0] ||
        LEETCODE_PROBLEMS.find((p) => p.topicId === activeTopic.id);

      return {
        message: `You noted that you ${
          recentDebrief.independence === 'unsolved'
            ? 'could not solve'
            : 'needed substantial help on'
        } **${title}**${
          recentDebrief.challengeFaced ? ` (challenge: ${recentDebrief.challengeFaced})` : ''
        }. That is completely normal! Let's practice a high-yield foundational problem in **${activeTopic.name}** so the pattern clicks naturally.`,
        recommendationReason: `Recommended to rebuild intuition after encountering challenges on ${title}.`,
        recommendedProblem: similarCandidate,
        source: 'rule_based',
        suggestions: [
          { label: `Solve #${similarCandidate?.frontendQuestionId} ${similarCandidate?.title}`, action: 'solve', payload: similarCandidate?.id },
          { label: 'Explain this pattern step-by-step', action: 'custom', payload: `explain:${activeTopic.id}` },
          { label: 'Show hint for this candidate', action: 'custom', payload: `hint:${similarCandidate?.id}` },
        ],
      };
    }

    // CASE C: Struggled with identifying the approach
    if (recentDebrief.challengeFaced?.includes('approach') || recentDebrief.challengeFaced?.includes('data structure')) {
      const approachCandidate = unsolvedTopicProblems.find((p) => p.difficulty === (recentProblem?.difficulty || 'Easy')) ||
        unsolvedTopicProblems[0];

      return {
        message: `Recognizing the right approach is often the hardest part of coding interviews. For **${activeTopic.name}**, ask yourself: "Can we trade O(N) space for O(1) time with a hash map?" or "Is the input sorted so two pointers apply?" Let's test this mindset on **${approachCandidate?.title}**.`,
        recommendationReason: `Selected to target pattern recognition and data structure choice.`,
        recommendedProblem: approachCandidate,
        source: 'rule_based',
        suggestions: [
          { label: `Solve #${approachCandidate?.frontendQuestionId} ${approachCandidate?.title}`, action: 'solve', payload: approachCandidate?.id },
          { label: 'Give me an approach breakdown', action: 'custom', payload: `hint:${approachCandidate?.id}` },
          { label: 'Switch to a different topic', action: 'topic' },
        ],
      };
    }

    // CASE A / D: Independent solve + high confidence
    if (recentDebrief.independence === 'independent' && recentDebrief.confidence === 'high') {
      const nextDiff = (preferredDifficulty === 'Easy')
        ? 'Easy'
        : (recentProblem?.difficulty === 'Easy' ? 'Medium' : recentProblem?.difficulty === 'Medium' ? 'Hard' : 'Hard');

      const advancedCandidate = unsolvedTopicProblems.find((p) => p.difficulty === nextDiff) ||
        LEETCODE_PROBLEMS.find((p) => p.difficulty === nextDiff && !solvedIds.includes(p.id));

      if (advancedCandidate) {
        return {
          message: `🔥 Excellent performance! You solved **${title}** independently with high confidence. Would you like to tackle **${advancedCandidate.title}** (#${advancedCandidate.frontendQuestionId}, ${advancedCandidate.difficulty}) or continue mastering ${activeTopic.name}?`,
          recommendationReason: `Recommended because of your flawless independent solve on ${title}.`,
          recommendedProblem: advancedCandidate,
          source: 'rule_based',
          suggestions: [
            { label: `Solve #${advancedCandidate.frontendQuestionId} ${advancedCandidate.title}`, action: 'solve', payload: advancedCandidate.id },
            { label: 'Stay with another Easy problem', action: 'difficulty', payload: 'Easy' },
            { label: 'Explore another topic', action: 'topic' },
          ],
        };
      }
    }
  }

  // Default flow: pick next unsolved problem respecting preferred difficulty
  let candidate = unsolvedTopicProblems.find((p) => p.difficulty === targetDifficulty);

  // Fallback to any unsolved problem in active topic
  if (!candidate) {
    candidate = unsolvedTopicProblems[0];
  }

  // If topic is completely solved, recommend moving to the next topic in curriculum
  if (!candidate) {
    const nextTopic = DSA_TOPICS.find((t) => t.id !== activeTopic.id && t.level === userLevel) || DSA_TOPICS[0];
    const nextTopicProblems = getProblemsByTopic(nextTopic.id);
    const nextCandidate = nextTopicProblems.find((p) => !solvedIds.includes(p.id)) || nextTopicProblems[0];

    return {
      message: `🎉 **Curriculum Milestone!** You have solved all curated problems in **${activeTopic.name}**! Let's branch out into **${nextTopic.name}** with **${nextCandidate.title}** (#${nextCandidate.frontendQuestionId}, ${nextCandidate.difficulty}).`,
      recommendationReason: `Recommended because you achieved 100% completion in ${activeTopic.name}.`,
      recommendedProblem: nextCandidate,
      source: 'rule_based',
      suggestions: [
        { label: `Start ${nextTopic.name} (#${nextCandidate.frontendQuestionId})`, action: 'solve', payload: nextCandidate.id },
        { label: `Open ${nextTopic.name} topic`, action: 'topic', payload: nextTopic.id },
        { label: 'Review solved problems', action: 'revise', payload: activeTopic.id },
      ],
    };
  }

  const reason = `Selected because it matches your preferred ${targetDifficulty} difficulty and strengthens ${activeTopic.name} principles.`;

  return {
    message: `Based on your **${userLevel}** skill level and current focus on **${activeTopic.name}**, your next recommended problem is **${candidate.title}** (#${candidate.frontendQuestionId}, ${candidate.difficulty}).`,
    recommendationReason: reason,
    recommendedProblem: candidate,
    source: 'rule_based',
    suggestions: [
      { label: `Solve #${candidate.frontendQuestionId} ${candidate.title}`, action: 'solve', payload: candidate.id },
      { label: 'Show problem hint first', action: 'custom', payload: `hint:${candidate.id}` },
      { label: 'Select another topic', action: 'topic' },
    ],
  };
}

/**
 * Handle conversational user messages:
 * - Quick Actions (Learn concept, practice problems, daily challenge, analyze progress, continue practice)
 * - "Teach me [topic] from basics"
 * - "Give me five Easy Array problems"
 * - "I want to practice Medium problems"
 * - "Explain Sliding Window"
 * - "Give me a problem similar to Two Sum"
 * - "Analyze my weak DSA topics"
 * - "What should I solve next?"
 */
export async function getMentorReply(context: MentorContext): Promise<RecommendationResult> {
  const rawQuery = context.userQuery || '';
  const query = rawQuery.toLowerCase().trim();
  const solvedIds = Object.keys(context.progressMap).filter(
    (id) => context.progressMap[id]?.status === 'solved'
  );
  const attemptedIds = Object.keys(context.progressMap).filter(
    (id) => context.progressMap[id]?.status === 'attempted' || context.progressMap[id]?.status === 'practice'
  );

  // ==========================================
  // QUICK ACTION 1: Learn a DSA Concept
  // ==========================================
  if (query === 'action:learn_concept' || query.includes('learn a dsa concept') || query === 'learn concept') {
    return {
      message: `🎯 **Choose a DSA Concept to Master**:\n\nLearning DSA is about recognizing patterns, not memorizing solutions. Which area would you like to master today?\n\n• **Arrays & Strings**: Contiguous memory, indexing, two pointers, prefix sums.\n• **Two Pointers & Sliding Window**: Subarrays, window optimization from O(N²) to O(N).\n• **Linked Lists**: Node pointer manipulation, fast/slow runner cycle detection.\n• **Binary Search**: Divide & conquer on sorted ranges and monotonic predicates.\n• **Binary Trees & BST**: In-order/Pre-order DFS traversals, BFS level-order queues.\n• **Dynamic Programming**: Overlapping subproblems, state transitions, memoization.\n• **Graphs**: BFS shortest path, DFS connected components, Dijkstra, Union-Find.`,
      source: 'rule_based',
      suggestions: [
        { label: 'Teach me Arrays from basics', action: 'custom', payload: 'Teach me Arrays from basics' },
        { label: 'Explain Sliding Window', action: 'custom', payload: 'Explain Sliding Window' },
        { label: 'Teach me Binary Search', action: 'custom', payload: 'Teach me Binary Search from basics' },
        { label: 'Explain Dynamic Programming', action: 'custom', payload: 'Explain Dynamic Programming' },
      ],
    };
  }

  // ==========================================
  // QUICK ACTION 2: Practice LeetCode Problems
  // ==========================================
  if (query === 'action:practice_problems' || query.includes('practice leetcode problems')) {
    const targetDiff: Difficulty =
      context.preferredDifficulty === 'Easy'
        ? 'Easy'
        : context.preferredDifficulty === 'Medium'
        ? 'Medium'
        : context.preferredDifficulty === 'Hard'
        ? 'Hard'
        : context.userLevel === 'beginner'
        ? 'Easy'
        : context.userLevel === 'intermediate'
        ? 'Medium'
        : 'Hard';

    const candidates = LEETCODE_PROBLEMS.filter(
      (p) => p.difficulty === targetDiff && !solvedIds.includes(p.id)
    ).slice(0, 4);

    return {
      message: `🚀 **Curated LeetCode Practice Set (${targetDiff})**:\n\nHere are high-yield, interview-tested problems aligned with your **${context.userLevel.toUpperCase()}** track and **${targetDiff}** difficulty preference. Pick one to begin:`,
      recommendedProblems: candidates,
      source: 'rule_based',
      suggestions: candidates.map((c) => ({
        label: `Solve #${c.frontendQuestionId} ${c.title}`,
        action: 'solve' as const,
        payload: c.id,
      })),
    };
  }

  // ==========================================
  // QUICK ACTION 3: Today's Daily Challenge
  // ==========================================
  if (
    query === 'action:daily_challenge' ||
    query.includes("today's daily challenge") ||
    query.includes('daily challenge')
  ) {
    try {
      const liveDaily = await fetchLiveLeetCodeDailyChallenge();
      if (liveDaily) {
        return {
          message: `📅 **Official LeetCode Daily Challenge — ${liveDaily.date}**\n\n**#${liveDaily.frontendQuestionId} ${liveDaily.title}**\n- **Difficulty**: ${liveDaily.difficulty}\n- **Acceptance Rate**: ${liveDaily.acRate}%\n- **Topic Tags**: ${liveDaily.topicTags.join(', ')}\n\n💡 **Tactical Mentor Strategy**:\n1. Read the constraints carefully. An N of 10⁵ implies O(N) or O(N log N); N ≤ 20 implies backtracking or bitmasking.\n2. State your brute force first before jumping to optimal data structures.\n3. Verify edge cases: empty input, minimum value, all identical elements.`,
          source: 'rule_based',
          recommendedProblem: {
            id: liveDaily.titleSlug,
            frontendQuestionId: liveDaily.frontendQuestionId,
            title: liveDaily.title,
            slug: liveDaily.titleSlug,
            difficulty: liveDaily.difficulty,
            topicId: 'daily',
            topicTags: liveDaily.topicTags,
            leetcodeUrl: liveDaily.url,
            description: `Official LeetCode Daily Challenge for ${liveDaily.date}`,
            acceptance: `${liveDaily.acRate}%`,
            orderIndex: 0,
            hints: [
              'Break the problem into sub-problems and check if overlapping optimal sub-structures exist.',
              'Consider whether a greedy choice or dynamic programming memoization is required.',
            ],
          },
          recommendationReason: `Official LeetCode problem of the day for ${liveDaily.date}.`,
          suggestions: [
            { label: `Solve #${liveDaily.frontendQuestionId} on LeetCode`, action: 'solve', payload: liveDaily.titleSlug },
            { label: 'Give me a hint for this daily challenge', action: 'custom', payload: `hint:${liveDaily.titleSlug}` },
            { label: 'Show regular practice instead', action: 'custom', payload: 'action:practice_problems' },
          ],
        };
      }
    } catch {
      // Fallback
    }

    return {
      message: `📅 **Today's LeetCode Daily Challenge**\n\nDaily challenges build the discipline needed for coding interviews. Check out today's live question in the **Live Daily Challenge** tab or solve our top recommended problem for today!`,
      source: 'rule_based',
      suggestions: [
        { label: 'View Daily Challenge Tab', action: 'custom', payload: 'action:daily_tab' },
        { label: 'Practice Recommended Problems', action: 'custom', payload: 'action:practice_problems' },
      ],
    };
  }

  // ==========================================
  // QUICK ACTION 4: Analyze My Progress / Weak Topics
  // ==========================================
  if (
    query === 'action:analyze_progress' ||
    query.includes('analyze my progress') ||
    query.includes('analyze my weak') ||
    query.includes('weak dsa topics') ||
    query.includes('weak topics')
  ) {
    const totalSolved = solvedIds.length;
    const totalAttempted = attemptedIds.length;

    let independentCount = 0;
    let hintCount = 0;
    const hurdlesRecorded: Record<string, number> = {};

    Object.values(context.progressMap).forEach((p) => {
      if (p.independence === 'independent') independentCount++;
      if (p.independence === 'small_hint' || p.independence === 'substantial_help') hintCount++;
      if (p.challengeFaced) {
        hurdlesRecorded[p.challengeFaced] = (hurdlesRecorded[p.challengeFaced] || 0) + 1;
      }
    });

    const independentRatio = totalSolved > 0 ? Math.round((independentCount / totalSolved) * 100) : 0;
    const topHurdles = Object.entries(hurdlesRecorded)
      .sort((a, b) => b[1] - a[1])
      .map(([hurdle, count]) => `• **${hurdle}** (${count} time${count > 1 ? 's' : ''})`);

    const weakDiagnosis =
      totalSolved === 0
        ? `You haven't completed any problems yet. Start with foundational **Arrays** and **Strings** to build momentum.`
        : `You have completed **${totalSolved}** problem(s) (${totalAttempted} in progress). Your independent solve rate is **${independentRatio}%**.\n\n${
            topHurdles.length > 0
              ? `⚠️ **Primary Friction Points Encountered in Debriefs**:\n${topHurdles.join('\n')}\n\n`
              : ''
          }🎯 **Recommended Focus**: Practice the problems below where you previously used hints or faced friction, then step up once you can code them cleanly from a blank canvas.`;

    const nextRec = LEETCODE_PROBLEMS.find((p) => !solvedIds.includes(p.id)) || LEETCODE_PROBLEMS[0];

    return {
      message: `📊 **DSA Diagnostic & Progress Analysis**:\n\n${weakDiagnosis}`,
      recommendationReason: `Diagnosed from your recorded post-problem debriefs and practice history.`,
      recommendedProblem: nextRec,
      source: 'rule_based',
      suggestions: [
        { label: `Practice #${nextRec.frontendQuestionId} ${nextRec.title}`, action: 'solve', payload: nextRec.id },
        { label: 'Teach me Arrays from basics', action: 'custom', payload: 'Teach me Arrays from basics' },
        { label: 'Explain Sliding Window', action: 'custom', payload: 'Explain Sliding Window' },
      ],
    };
  }

  // ==========================================
  // QUICK ACTION 5: Continue Previous Practice
  // ==========================================
  if (query === 'action:continue_practice' || query.includes('continue previous practice')) {
    // Find last attempted or in-progress problem
    const inProgressProblem = LEETCODE_PROBLEMS.find((p) => attemptedIds.includes(p.id));
    if (inProgressProblem) {
      return {
        message: `🔄 **Resuming Your Previous Practice**:\n\nYou were previously working on **#${inProgressProblem.frontendQuestionId} ${inProgressProblem.title}** (${inProgressProblem.difficulty}) in **${inProgressProblem.topicTags.join(', ')}**.\n\nWould you like a strategic hint or are you ready to jump back into LeetCode?`,
        recommendedProblem: inProgressProblem,
        recommendationReason: `Resuming your active attempt from your learning history.`,
        source: 'rule_based',
        suggestions: [
          { label: `Solve #${inProgressProblem.frontendQuestionId} on LeetCode`, action: 'solve', payload: inProgressProblem.id },
          { label: 'Show hint first', action: 'custom', payload: `hint:${inProgressProblem.id}` },
          { label: 'Try a different problem', action: 'custom', payload: 'action:practice_problems' },
        ],
      };
    }

    // Default to next unsolved problem
    const candidate = LEETCODE_PROBLEMS.find((p) => !solvedIds.includes(p.id)) || LEETCODE_PROBLEMS[0];
    return {
      message: `Let's keep your streak active! Your next practice challenge is **#${candidate.frontendQuestionId} ${candidate.title}** (${candidate.difficulty}).`,
      recommendedProblem: candidate,
      recommendationReason: `Next uncompleted problem in your learning journey.`,
      source: 'rule_based',
      suggestions: [
        { label: `Solve #${candidate.frontendQuestionId} on LeetCode`, action: 'solve', payload: candidate.id },
        { label: 'Show problem hint first', action: 'custom', payload: `hint:${candidate.id}` },
      ],
    };
  }

  // ==========================================
  // NATURAL QUERY: "Teach me [Topic] from basics"
  // ==========================================
  if (query.includes('teach me') || query.includes('from basics') || query.includes('learn basics')) {
    let topicName = 'Arrays';
    let topicDescription = 'Contiguous memory structure for constant-time random access.';
    let complexity = 'Access: O(1) | Search: O(N) | Insertion/Deletion: O(N)';
    let patterns = 'Two Pointers (converging & fast-slow), Sliding Window, Prefix Sums, Hash Map lookup.';
    let starterProblems = LEETCODE_PROBLEMS.filter((p) => p.topicId === 'arrays').slice(0, 3);

    if (query.includes('string')) {
      topicName = 'Strings';
      topicDescription = 'Sequence of characters. In languages like Java and Python, strings are immutable.';
      complexity = 'Access: O(1) | Substring search: O(N) with KMP/Rabin-Karp | Concatenation: O(N)';
      patterns = 'Frequency counts with int[26], Two Pointers for palindrome checks, Sliding Window for substring optimization.';
      starterProblems = LEETCODE_PROBLEMS.filter((p) => p.topicId === 'strings').slice(0, 3);
    } else if (query.includes('linked list')) {
      topicName = 'Linked Lists';
      topicDescription = 'Linear data structure where elements point to the next node via pointers.';
      complexity = 'Access: O(N) | Insertion/Deletion at head: O(1) | Search: O(N)';
      patterns = 'Dummy head node technique to eliminate null checks, Fast & Slow pointer (Floyd’s Cycle Finding), Reverse list in-place.';
      starterProblems = LEETCODE_PROBLEMS.filter((p) => p.topicId === 'linked-lists').slice(0, 3);
    } else if (query.includes('binary search') || query.includes('search')) {
      topicName = 'Binary Search';
      topicDescription = 'Search algorithm that repeatedly halves the search space on sorted inputs or monotonic condition functions.';
      complexity = 'Time: O(log N) | Space: O(1)';
      patterns = 'Template invariant: `low <= high`, `mid = low + (high - low) // 2`. Binary search on answer space.';
      starterProblems = LEETCODE_PROBLEMS.filter((p) => p.topicId === 'binary-search').slice(0, 3);
    } else if (query.includes('tree') || query.includes('binary tree')) {
      topicName = 'Binary Trees';
      topicDescription = 'Hierarchical data structure where each node has at most two children (left and right).';
      complexity = 'Traversal: O(N) | Search in balanced BST: O(log N) | Worst BST: O(N)';
      patterns = 'DFS Traversals (In-order for sorted BST, Pre-order for cloning, Post-order for deletion/DP), BFS Level-order with a Queue.';
      starterProblems = LEETCODE_PROBLEMS.filter((p) => p.topicId === 'binary-trees').slice(0, 3);
    } else if (query.includes('dynamic programming') || query.includes('dp')) {
      topicName = 'Dynamic Programming';
      topicDescription = 'Algorithmic technique for optimization problems exhibiting Overlapping Subproblems and Optimal Substructure.';
      complexity = 'Time: O(States × Transitions) | Space: O(States) with rolling-array space optimization';
      patterns = '1D DP (Fibonacci, House Robber), 2D Grid DP (Unique Paths), Knapsack patterns, Interval DP.';
      starterProblems = LEETCODE_PROBLEMS.filter((p) => p.topicId === 'dynamic-programming').slice(0, 3);
    } else if (query.includes('graph')) {
      topicName = 'Graphs';
      topicDescription = 'Non-linear data structure of vertices connected by edges (directed, undirected, weighted, acyclic).';
      complexity = 'BFS/DFS: O(V + E) | Dijkstra: O((V + E) log V) | Union-Find: O(α(V))';
      patterns = 'BFS for unweighted shortest path, DFS for connected components & cycle detection, Topological Sort with Kahn’s in-degree algorithm.';
      starterProblems = LEETCODE_PROBLEMS.filter((p) => p.topicId === 'graph-theory' || p.topicId === 'bfs' || p.topicId === 'dfs').slice(0, 3);
    }

    return {
      message: `📚 **Mastering ${topicName} from Basics**\n\n1. **Core Concept**: ${topicDescription}\n2. **Time & Space Complexity**: ${complexity}\n3. **Essential Interview Patterns**:\n${patterns}\n\n4. **Recommended Starter Problems**:\n${starterProblems.map((p) => `• #${p.frontendQuestionId} **${p.title}** (${p.difficulty})`).join('\n')}`,
      recommendedProblems: starterProblems,
      source: 'rule_based',
      suggestions: [
        { label: `Solve #${starterProblems[0]?.frontendQuestionId || '1'} ${starterProblems[0]?.title || 'Starter'}`, action: 'solve', payload: starterProblems[0]?.id },
        { label: `Give me 5 Easy ${topicName} problems`, action: 'custom', payload: `Give me five Easy ${topicName} problems` },
        { label: 'Explain common mistakes', action: 'custom', payload: `explain:${starterProblems[0]?.topicId || 'arrays'}` },
      ],
    };
  }

  // ==========================================
  // NATURAL QUERY: "Give me a problem similar to Two Sum" / "similar to ..."
  // ==========================================
  if (query.includes('similar')) {
    let similarProblems = LEETCODE_PROBLEMS.filter(
      (p) => p.id === '3sum' || p.id === 'subarray-sum-equals-k' || p.id === 'contains-duplicate'
    );
    let refTitle = '#1 Two Sum';

    if (query.includes('3sum') || query.includes('three sum')) {
      similarProblems = LEETCODE_PROBLEMS.filter((p) => p.id === 'two-sum' || p.id === 'container-with-most-water');
      refTitle = '#15 3Sum';
    } else if (query.includes('island')) {
      similarProblems = LEETCODE_PROBLEMS.filter((p) => p.topicId === 'bfs' || p.topicId === 'dfs');
      refTitle = '#200 Number of Islands';
    }

    return {
      message: `🔄 **Problems Similar to ${refTitle}**:\n\n${refTitle} is a benchmark question that teaches recognizing algorithmic complements and two-pointer state reductions.\n\nHere are problems that evolve this exact pattern:\n\n1. **#167 Two Sum II** (Medium/Easy): Same goal, but array is pre-sorted. Explores the Two-Pointer O(1) memory technique.\n2. **#15 3Sum** (Medium): Fixes one number and applies Two Sum on the remainder.\n3. **#560 Subarray Sum Equals K** (Medium): Applies the complement lookup pattern to Prefix Sums in contiguous arrays.\n4. **#217 Contains Duplicate** (Easy): Foundational hash set lookup.`,
      recommendedProblems: similarProblems,
      source: 'rule_based',
      suggestions: [
        { label: 'Solve #15 3Sum', action: 'solve', payload: '3sum' },
        { label: 'Solve #560 Subarray Sum Equals K', action: 'solve', payload: 'subarray-sum-equals-k' },
        { label: 'Explain Two Pointers template', action: 'custom', payload: 'Explain Two Pointers' },
      ],
    };
  }

  // ==========================================
  // NATURAL QUERY: "I want to practice Medium problems" / Practice by Difficulty
  // ==========================================
  if (query.includes('practice medium') || query.includes('practice hard') || query.includes('practice easy')) {
    const diff: Difficulty = query.includes('hard') ? 'Hard' : query.includes('easy') ? 'Easy' : 'Medium';
    const targetProblems = LEETCODE_PROBLEMS.filter(
      (p) => p.difficulty === diff && !solvedIds.includes(p.id)
    ).slice(0, 4);

    return {
      message: `🎯 **Setting Focus to ${diff} Practice**:\n\n${
        diff === 'Medium'
          ? 'Medium problems represent the core 70% of FAANG and tech interview questions. They test combining two patterns (e.g. Hash Map + Two Pointers, or Binary Search + Greedy predicate).'
          : diff === 'Hard'
          ? 'Hard problems test advanced invariants, dynamic programming states, multi-source graph algorithms, and edge-case mastery.'
          : 'Easy problems are essential for building fast implementation mechanics and pattern recognition.'
      }\n\nHere are 4 high-yield ${diff} challenges to accelerate your readiness:`,
      recommendedProblems: targetProblems,
      source: 'rule_based',
      suggestions: targetProblems.map((p) => ({
        label: `Solve #${p.frontendQuestionId} ${p.title}`,
        action: 'solve' as const,
        payload: p.id,
      })),
    };
  }

  // ==========================================
  // NATURAL QUERY: "Give me five/X [Easy/Medium/Hard] [Topic] problems"
  // ==========================================
  if (
    query.includes('give me') ||
    query.includes('list') ||
    query.includes('show me') ||
    query.includes('five') ||
    query.includes('5 ')
  ) {
    const diff: Difficulty = query.includes('hard')
      ? 'Hard'
      : query.includes('medium')
      ? 'Medium'
      : 'Easy';

    let matchedTopic = 'arrays';
    if (query.includes('string')) matchedTopic = 'strings';
    else if (query.includes('tree')) matchedTopic = 'binary-trees';
    else if (query.includes('dp') || query.includes('dynamic programming')) matchedTopic = 'dynamic-programming';
    else if (query.includes('graph')) matchedTopic = 'graph-theory';
    else if (query.includes('linked list')) matchedTopic = 'linked-lists';
    else if (query.includes('search')) matchedTopic = 'binary-search';

    let matchingProblems = LEETCODE_PROBLEMS.filter(
      (p) => (p.topicId === matchedTopic || p.topicTags.some((t) => t.toLowerCase().includes(matchedTopic))) && p.difficulty === diff
    );

    if (matchingProblems.length === 0) {
      matchingProblems = LEETCODE_PROBLEMS.filter((p) => p.difficulty === diff);
    }

    const problemSet = matchingProblems.slice(0, 5);

    return {
      message: `📋 **Here are ${problemSet.length} ${diff} problems**:\n\n${problemSet
        .map(
          (p, i) =>
            `${i + 1}. **#${p.frontendQuestionId} ${p.title}** (${p.difficulty}${p.acceptance ? `, ${p.acceptance} acceptance` : ''})\n   *${p.description}*`
        )
        .join('\n\n')}\n\nClick any problem card below to solve it on LeetCode:`,
      recommendedProblems: problemSet,
      source: 'rule_based',
      suggestions: problemSet.map((p) => ({
        label: `Solve #${p.frontendQuestionId} ${p.title}`,
        action: 'solve' as const,
        payload: p.id,
      })),
    };
  }

  // ==========================================
  // NATURAL QUERY: "Explain Sliding Window"
  // ==========================================
  if (query.includes('sliding window')) {
    const swProblem = LEETCODE_PROBLEMS.find((p) => p.id === 'longest-substring-without-repeating') || LEETCODE_PROBLEMS[0];
    return {
      message: `🪟 **Sliding Window Pattern In-Depth**:\n\n**Intuition**:\nInstead of recalculating overlapping sub-segments from scratch in O(N²), maintain a window \`[left, right]\` that dynamically expands to consume new elements and shrinks to satisfy constraints.\n\n**Standard Template (O(N) Time, O(K) Space)**:\n\`\`\`python\ndef sliding_window(nums, k):\n    left = 0\n    window_state = {}\n    max_ans = 0\n    for right in range(len(nums)):\n        # 1. Expand right\n        add_to_state(window_state, nums[right])\n        # 2. Shrink left while invalid\n        while condition_violated(window_state):\n            remove_from_state(window_state, nums[left])\n            left += 1\n        # 3. Update result\n        max_ans = max(max_ans, right - left + 1)\n    return max_ans\n\`\`\`\n\n**Benchmark Problems**:\n• #3 Longest Substring Without Repeating Characters\n• #76 Minimum Window Substring\n• #209 Minimum Size Subarray Sum`,
      recommendedProblem: swProblem,
      recommendationReason: `Classic benchmark problem to solidify the sliding window pattern.`,
      source: 'rule_based',
      suggestions: [
        { label: `Solve #${swProblem.frontendQuestionId} ${swProblem.title}`, action: 'solve', payload: swProblem.id },
        { label: 'Show hint for #3 Longest Substring', action: 'custom', payload: 'hint:longest-substring-without-repeating' },
        { label: 'Teach me Two Pointers next', action: 'custom', payload: 'Explain Two Pointers' },
      ],
    };
  }

  // ==========================================
  // NATURAL QUERY: "Explain Two Pointers"
  // ==========================================
  if (query.includes('two pointers')) {
    const tpProblem = LEETCODE_PROBLEMS.find((p) => p.id === '3sum') || LEETCODE_PROBLEMS[0];
    return {
      message: `👉👈 **Two Pointers Pattern In-Depth**:\n\n**Intuition**:\nWhen dealing with sorted arrays or linear structures, two pointers converging from both ends or moving at different speeds (fast/slow) can reduce an O(N²) quadratic search into an O(N) linear sweep.\n\n**Key Variants**:\n1. **Converging Pointers**: \`left = 0, right = n - 1\`. If \`sum < target\`, increment \`left\`; if \`sum > target\`, decrement \`right\`.\n2. **Fast & Slow Pointers**: Detect cycles in Linked Lists (Floyd's algorithm) or find middle element in one pass.\n3. **Partition Pointers**: Quicksort partition, moving zeros to end in-place.\n\n**Classic Benchmarks**:\n• #167 Two Sum II - Input Array Is Sorted\n• #15 3Sum\n• #11 Container With Most Water`,
      recommendedProblem: tpProblem,
      recommendationReason: `High-yield interview question implementing converging two pointers.`,
      source: 'rule_based',
      suggestions: [
        { label: `Solve #${tpProblem.frontendQuestionId} ${tpProblem.title}`, action: 'solve', payload: tpProblem.id },
        { label: 'Show hint for 3Sum', action: 'custom', payload: `hint:${tpProblem.id}` },
        { label: 'Give me another Two Pointers problem', action: 'custom', payload: 'Give me five Easy Array problems' },
      ],
    };
  }


  // ==========================================
  // NATURAL QUERY: "What should I solve next?"
  // ==========================================
  if (query.includes('what should i solve next') || query.includes('what to solve next') || query.includes('recommend next')) {
    return getIntelligentRecommendation(context);
  }

  // ==========================================
  // HINT REQUEST: "hint:..." or "give me a hint"
  // ==========================================
  if (query.startsWith('hint:') || query.includes('hint')) {
    const problemId = query.startsWith('hint:')
      ? query.replace('hint:', '').trim()
      : LEETCODE_PROBLEMS.find((p) => query.includes(p.title.toLowerCase()) || query.includes(p.frontendQuestionId))?.id || '';

    const targetProblem = problemId ? LEETCODE_PROBLEMS.find((p) => p.id === problemId) : LEETCODE_PROBLEMS[0];

    if (targetProblem && targetProblem.hints && targetProblem.hints.length > 0) {
      return {
        message: `💡 **Algorithmic Hint for #${targetProblem.frontendQuestionId} ${targetProblem.title}**:\n\n${targetProblem.hints
          .map((h, i) => `• **Clue ${i + 1}**: ${h}`)
          .join('\n\n')}\n\n*Notice how this narrows down the search space without giving away the full code implementation!*`,
        recommendedProblem: targetProblem,
        recommendationReason: `Non-spoiler conceptual hint designed to spark the right invariant.`,
        source: 'rule_based',
        suggestions: [
          { label: `Solve #${targetProblem.frontendQuestionId} on LeetCode`, action: 'solve', payload: targetProblem.id },
          { label: 'Explain the optimal time complexity', action: 'custom', payload: `explain:${targetProblem.topicId}` },
          { label: 'Recommend a different problem', action: 'solve' },
        ],
      };
    }
  }

  // ==========================================
  // EXPLAIN TOPIC: "explain:..."
  // ==========================================
  if (query.startsWith('explain:')) {
    const topicId = query.replace('explain:', '').trim();
    const topic = DSA_TOPICS.find((t) => t.id === topicId) || DSA_TOPICS[0];

    return {
      message: `📚 **${topic.name} Core Patterns & Pitfalls**:\n\n1. **Core Invariant**: ${topic.description}\n2. **Time/Space Tradeoff**: Often optimizing search from O(N) to O(1) requires O(N) memory allocation.\n3. **Interview Invariant**: Always verify empty inputs, single-element arrays, and negative indices.\n4. **Common Mistake**: Off-by-one errors in boundary conditions (e.g. \`low < high\` vs \`low <= high\`).`,
      source: 'rule_based',
      suggestions: [
        { label: `Practice a ${topic.name} problem`, action: 'topic', payload: topic.id },
        { label: 'Ask a specific question', action: 'custom' },
      ],
    };
  }

  // Default intelligent recommendation
  return getIntelligentRecommendation(context);
}
