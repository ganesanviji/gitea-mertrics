import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type {
  GiteaUser,
  GiteaCommit,
  GiteaPullRequest,
  GiteaRepo,
  GiteaIssue,
  GiteaReview,
} from '../types';

let client: AxiosInstance | null = null;

// ── In-memory repo data cache ──────────────────────────────
// Avoids hammering the server with duplicate fetches when the component
// tree re-mounts or React Query retries within a short window.
interface CacheEntry<T> {
  data: T;
  expiry: number;
}
const repoDataCache = new Map<string, CacheEntry<RepoData>>();
const REPO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function clearRepoCache(): void {
  repoDataCache.clear();
}

// Detect if we're in production build
const isProduction = import.meta.env.PROD;

// Store for production proxy
let storedGiteaUrl = '';
let storedToken = '';

/**
 * Registers the Gitea URL and sets up the appropriate base URL for API calls.
 * - Dev mode: Routes through Vite proxy at /gitea-api/* (no CORS issues)
 * - Prod mode: Uses Vercel serverless function at /api/proxy with headers
 */
export async function initClient(baseUrl: string, token: string): Promise<void> {
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  // In production, store for proxy headers
  if (isProduction) {
    storedGiteaUrl = cleanBaseUrl;
    storedToken = token;
  }

  // Headers: always include auth, plus Gitea URL + token in prod for the proxy
  const headers: Record<string, string> = {
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
  };
  
  if (isProduction) {
    headers['X-Gitea-Url'] = cleanBaseUrl;
    headers['X-Gitea-Token'] = token;
  }

  // Use relative /gitea-api base in dev (Vite proxy), absolute URL in prod
  const baseURL = isProduction ? '/api/proxy' : '/gitea-api/api/v1';
  
  client = axios.create({
    baseURL,
    headers,
  });
}

function getClient(): AxiosInstance {
  if (!client) throw new Error('Gitea client not initialized. Please configure settings.');
  return client;
}

// Paginate through all results — stops immediately when AbortSignal fires.
// On the first page we read the x-total-count header to calculate remaining
// pages and fetch them in parallel, cutting round-trips to ceil(total/limit).
async function paginate<T>(url: string, params: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T[]> {
  const limit = 50;
  const MAX_PAGES = 20; // safety cap at 1000 items

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // Fetch page 1 first to learn the total count
  const firstResponse = await getClient().get<T[]>(url, {
    params: { ...params, page: 1, limit },
    signal,
  });

  const firstPage: T[] = firstResponse.data ?? [];
  if (firstPage.length === 0) return [];
  if (firstPage.length < limit) return firstPage; // single page — done

  // Try to read Gitea's x-total-count header for parallel fetching
  const totalCount = parseInt(firstResponse.headers?.['x-total-count'] ?? '', 10);
  const totalPages = !isNaN(totalCount)
    ? Math.min(Math.ceil(totalCount / limit), MAX_PAGES)
    : MAX_PAGES;

  if (totalPages <= 1) return firstPage;

  // Fetch remaining pages in parallel
  const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
  const pageResults = await Promise.all(
    remainingPages.map((page) => {
      if (signal?.aborted) return Promise.resolve([] as T[]);
      return getClient()
        .get<T[]>(url, { params: { ...params, page, limit }, signal })
        .then((r) => r.data ?? [] as T[])
        .catch(() => [] as T[]);
    }),
  );

  const results = [...firstPage];
  for (const page of pageResults) results.push(...page);
  return results;
}

// ── Repositories ─────────────────────────────────────────
export async function getRepo(owner: string, repo: string): Promise<GiteaRepo> {
  const { data } = await getClient().get<GiteaRepo>(`/repos/${owner}/${repo}`);
  return data;
}

export async function getOrgRepos(org: string): Promise<GiteaRepo[]> {
  return paginate<GiteaRepo>(`/orgs/${org}/repos`);
}

// ── Commits ───────────────────────────────────────────────
export async function getCommits(
  owner: string,
  repo: string,
  since: string,
  until?: string,
): Promise<GiteaCommit[]> {
  return paginate<GiteaCommit>(`/repos/${owner}/repos/${repo}/git/commits`, { since, until });
}

export async function getRepoCommits(
  owner: string,
  repo: string,
  since: string,
  signal?: AbortSignal,
): Promise<GiteaCommit[]> {
  return paginate<GiteaCommit>(`/repos/${owner}/${repo}/commits`, { since }, signal);
}

// ── Pull Requests ─────────────────────────────────────────
export async function getPullRequests(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'all',
  signal?: AbortSignal,
): Promise<GiteaPullRequest[]> {
  return paginate<GiteaPullRequest>(`/repos/${owner}/${repo}/pulls`, { state, type: 'pulls' }, signal);
}

export async function getPRReviews(
  owner: string,
  repo: string,
  index: number,
): Promise<GiteaReview[]> {
  const { data } = await getClient().get<GiteaReview[]>(
    `/repos/${owner}/${repo}/pulls/${index}/reviews`,
  );
  return data || [];
}

// ── Issues ────────────────────────────────────────────────
export async function getIssues(
  owner: string,
  repo: string,
  since: string,
  signal?: AbortSignal,
): Promise<GiteaIssue[]> {
  return paginate<GiteaIssue>(`/repos/${owner}/${repo}/issues`, {
    type: 'issues',
    state: 'all',
    since,
  }, signal);
}

// ── Users ─────────────────────────────────────────────────
export async function getUser(username: string): Promise<GiteaUser> {
  const { data } = await getClient().get<GiteaUser>(`/users/${username}`);
  return data;
}

export async function getOrgMembers(org: string): Promise<GiteaUser[]> {
  return paginate<GiteaUser>(`/orgs/${org}/members`);
}

export async function getCurrentUser(): Promise<GiteaUser> {
  const { data } = await getClient().get<GiteaUser>('/user');
  return data;
}

// ── Aggregate: all data for one repo ─────────────────────
export interface RepoData {
  repo: string;
  owner: string;
  commits: GiteaCommit[];
  prs: GiteaPullRequest[];
  issues: GiteaIssue[];
}

export async function fetchRepoData(
  owner: string,
  repo: string,
  since: string,
  signal?: AbortSignal,
): Promise<RepoData> {
  const cacheKey = `${owner}/${repo}|${since}`;
  const now = Date.now();

  // Return cached result if still fresh
  const cached = repoDataCache.get(cacheKey);
  if (cached && cached.expiry > now) {
    return cached.data;
  }

  const abortErr = (e: unknown) => {
    if ((e as DOMException).name === 'AbortError') throw e;
    return undefined;
  };

  const [commits, prs, issues] = await Promise.all([
    getRepoCommits(owner, repo, since, signal).catch((e) => { abortErr(e); return [] as GiteaCommit[]; }),
    getPullRequests(owner, repo, 'all', signal).catch((e) => { abortErr(e); return [] as GiteaPullRequest[]; }),
    getIssues(owner, repo, since, signal).catch((e) => { abortErr(e); return [] as GiteaIssue[]; }),
  ]);

  // Filter PRs by date
  const filteredPRs = prs.filter(
    (pr) => new Date(pr.created_at) >= new Date(since),
  );

  const result: RepoData = { repo, owner, commits, prs: filteredPRs, issues };

  // Only cache if not aborted
  if (!signal?.aborted) {
    repoDataCache.set(cacheKey, { data: result, expiry: now + REPO_CACHE_TTL });
  }

  return result;
}
