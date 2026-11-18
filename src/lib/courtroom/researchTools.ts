// ============================================================================
// TrackMyWork - AI Courtroom Research Tools
// Phase 2: Bounded, loop-free, read-only external evidence fetchers used
// exclusively by the Feasibility Prosecutor and Architect Counsel.
// Zero recursive ReAct loops — each fetcher is a 1-shot parallel call.
// ============================================================================

import type { EvidenceItem } from './types';
import { invokeCourtroomJson } from './nimClient';

interface ClerkRouterQueries {
  arxivQuery?: string;
  webQuery?: string;
  githubQuery?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deduplicateByUrl(items: EvidenceItem[]): EvidenceItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function capItems(items: EvidenceItem[], max: number): EvidenceItem[] {
  return items.slice(0, max);
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// 1. searchGitHubRepos
// ---------------------------------------------------------------------------

export async function searchGitHubRepos(query: string): Promise<EvidenceItem[]> {
  const token = process.env.GITHUB_TOKEN;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=3`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'User-Agent': 'trackmywork-courtroom-research',
        },
      },
      5000
    );

    if (!response.ok) {
      console.warn(`[Courtroom Research] GitHub search returned ${response.status}`);
      return [];
    }

    const json = await response.json();
    const repos = json.items || [];

    return repos.map((repo: any) => ({
      source: 'github' as const,
      title: `${repo.full_name} (★ ${repo.stargazers_count ?? 0})`,
      url: repo.html_url,
      snippet: [
        repo.description ? `Description: ${repo.description}` : '',
        repo.language ? `Language: ${repo.language}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    }));
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[Courtroom Research] GitHub search timed out');
    } else {
      console.warn('[Courtroom Research] GitHub search error:', error);
    }
    return [];
  }
}

// ---------------------------------------------------------------------------
// 2. searchArxivPapers
// ---------------------------------------------------------------------------

export async function searchArxivPapers(query: string): Promise<EvidenceItem[]> {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=3`;

  try {
    const response = await fetchWithTimeout(url, {}, 5000);

    if (!response.ok) {
      console.warn(`[Courtroom Research] arXiv query returned ${response.status}`);
      return [];
    }

    const xml = await response.text();
    return parseArxivEntries(xml);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[Courtroom Research] arXiv search timed out');
    } else {
      console.warn('[Courtroom Research] arXiv search error:', error);
    }
    return [];
  }
}

/**
 * Parse arXiv Atom XML `<entry>` blocks using lightweight regex.
 * No heavy XML parser dependency — just enough for the 3-entry response.
 */
function parseArxivEntries(xml: string): EvidenceItem[] {
  const entries: EvidenceItem[] = [];
  const entryRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) && entries.length < 3) {
    const entry = match[1];

    const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const idMatch = entry.match(/<id[^>]*>([\s\S]*?)<\/id>/i);
    const summaryMatch = entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);

    if (!titleMatch || !idMatch) continue;

    const title = titleMatch[1].replace(/\s+/g, ' ').trim();
    const url = idMatch[1].trim();
    const rawSummary = summaryMatch ? summaryMatch[1] : '';
    const snippet = rawSummary
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);

    entries.push({
      source: 'arxiv',
      title,
      url,
      snippet: snippet || 'No summary available.',
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// 3. searchWebDocs (Tavily)
// ---------------------------------------------------------------------------

export async function searchWebDocs(query: string): Promise<EvidenceItem[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    // No Tavily key configured — return empty cleanly, no throw.
    return [];
  }

  try {
    const response = await fetchWithTimeout(
      'https://api.tavily.com/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'basic',
          max_results: 3,
        }),
      },
      5000
    );

    if (!response.ok) {
      console.warn(`[Courtroom Research] Tavily search returned ${response.status}`);
      return [];
    }

    const json = await response.json();
    const results = json.results || [];

    return results.map((item: any) => ({
      source: 'web' as const,
      title: item.title || 'Untitled',
      url: item.url || '',
      snippet: (item.content || item.snippet || '').slice(0, 300),
    }));
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[Courtroom Research] Tavily search timed out');
    } else {
      console.warn('[Courtroom Research] Tavily search error:', error);
    }
    return [];
  }
}

// ---------------------------------------------------------------------------
// Role-specific bounded evidence gatherers
// ---------------------------------------------------------------------------

/**
 * Gather evidence for the Feasibility Prosecutor.
 *
 * Uses the Clerk Router (nemotron-3.5-lightning-30b-a3b, maxTokens: 120) to
 * extract at most 2 short search queries (arxivQuery, webQuery) targeting
 * bottlenecks, failure modes, or benchmarks for the motion.
 * Runs arXiv + web search in parallel via Promise.allSettled.
 * Deduplicates by URL and caps at 4 items max.
 */
export async function gatherProsecutorEvidence(
  motion: string
): Promise<EvidenceItem[]> {
  const systemPrompt = `You are a research query extractor for a hackathon AI courtroom.
Given a proposed feature/motion, extract at most 2 short search queries:
- arxivQuery: research papers about bottlenecks, failure modes, or benchmarks
- webQuery: documentation or articles about feasibility concerns

Return JSON: { "arxivQuery": "...", "webQuery": "..." }
Keep queries short (under 10 words each). Omit a field if not applicable.`;

  const userPrompt = `Motion: ${motion}`;

  let queries: ClerkRouterQueries = {};
  try {
    const result = await invokeCourtroomJson<ClerkRouterQueries>({
      role: 'Clerk Router',
      systemPrompt,
      userPrompt,
      maxTokens: 120,
    });
    queries = result.data;
  } catch (error) {
    console.warn('[Courtroom Research] Clerk Router query extraction failed:', error);
  }

  const arxivQuery = queries.arxivQuery || motion;
  const webQuery = queries.webQuery || motion;

  const [arxivResult, webResult] = await Promise.allSettled([
    searchArxivPapers(arxivQuery),
    searchWebDocs(webQuery),
  ]);

  const items: EvidenceItem[] = [];
  if (arxivResult.status === 'fulfilled') items.push(...arxivResult.value);
  if (webResult.status === 'fulfilled') items.push(...webResult.value);

  return capItems(deduplicateByUrl(items), 4);
}

/**
 * Gather evidence for the Architect Counsel.
 *
 * Uses the Clerk Router (nemotron-3.5-lightning-30b-a3b, maxTokens: 120) to
 * extract at most 2 short search queries (githubQuery, webQuery) targeting
 * open-source libraries, starter repos, and implementation patterns.
 * Runs GitHub + web search in parallel via Promise.allSettled.
 * Deduplicates by URL and caps at 4 items max.
 */
export async function gatherArchitectEvidence(
  motion: string,
  prosecutorObjections?: string
): Promise<EvidenceItem[]> {
  const systemPrompt = `You are a research query extractor for a hackathon AI courtroom.
Given a proposed feature/motion and optional prosecutor objections, extract at most 2 short search queries:
- githubQuery: open-source libraries, starter repos, or implementation patterns
- webQuery: documentation or tutorials for implementation

Return JSON: { "githubQuery": "...", "webQuery": "..." }
Keep queries short (under 10 words each). Omit a field if not applicable.`;

  const userPrompt = `Motion: ${motion}${
    prosecutorObjections ? `\nProsecutor Objections: ${prosecutorObjections}` : ''
  }`;

  let queries: ClerkRouterQueries = {};
  try {
    const result = await invokeCourtroomJson<ClerkRouterQueries>({
      role: 'Clerk Router',
      systemPrompt,
      userPrompt,
      maxTokens: 120,
    });
    queries = result.data;
  } catch (error) {
    console.warn('[Courtroom Research] Clerk Router query extraction failed:', error);
  }

  const githubQuery = queries.githubQuery || motion;
  const webQuery = queries.webQuery || motion;

  const [githubResult, webResult] = await Promise.allSettled([
    searchGitHubRepos(githubQuery),
    searchWebDocs(webQuery),
  ]);

  const items: EvidenceItem[] = [];
  if (githubResult.status === 'fulfilled') items.push(...githubResult.value);
  if (webResult.status === 'fulfilled') items.push(...webResult.value);

  return capItems(deduplicateByUrl(items), 4);
}
