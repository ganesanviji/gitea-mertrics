import { useQuery } from '@tanstack/react-query';
import { useMemo, useEffect, useState } from 'react';
import { fetchRepoData, getOrgMembers, getOrgRepos, getUser } from '../api/gitea';
import { computeEngineerStats } from '../utils/scoring';
import { loadSettings, getDateRangeStart } from '../store/settings';
import type { TeamStats, EngineerStats, GiteaReview, GiteaUser, PrType } from '../types';
import { EMPTY_PR_BY_TYPE } from '../types';
import { saveSnapshot, loadLatestSnapshot } from '../store/db';
import { saveWeeklySnapshots, getTrend } from '../store/history';
import type { TrendResult } from '../store/history';

// ── Concurrency limiter ───────────────────────────────────────────────────────
// Limits how many repo fetches run in parallel so we don't hammer the server
// with dozens of simultaneous requests (which causes queueing & rate-limits).
function createConcurrencyLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            if (queue.length > 0) queue.shift()!();
          });
      };
      if (active < concurrency) run();
      else queue.push(run);
    });
  };
}

// 4 concurrent repo fetches — empirically a good balance between speed and
// server friendliness. Increase to 6 if your Gitea instance handles it well.
const REPO_FETCH_CONCURRENCY = 4;

// Stable query key — serialised so React Query deduplicates identical requests
// across multiple components mounting simultaneously (100s of users on same page)
function buildQueryKey(giteaUrl: string, repos: string[], orgName: string, dateRange: string) {
  return ['analytics', giteaUrl, [...repos].sort().join(','), orgName, dateRange] as const;
}

export function useAnalytics() {
  const settings = loadSettings();
  // Configured when credentials exist AND (repos pinned OR org set for auto-discovery)
  const isConfigured = !!(settings.giteaUrl && settings.token && (settings.repos.length > 0 || settings.orgName));

  // Load IndexedDB snapshot as placeholder so UI renders immediately on revisit
  const [placeholder, setPlaceholder] = useState<TeamStats | undefined>(undefined);
  useEffect(() => {
    if (!isConfigured || !settings.repos.length) return;
    loadLatestSnapshot(settings.giteaUrl, settings.repos, settings.dateRange)
      .then(setPlaceholder)
      .catch(() => {/* non-fatal */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.giteaUrl, settings.repos.join(','), settings.dateRange, isConfigured]);

  return useQuery<TeamStats, Error>({
    queryKey: buildQueryKey(settings.giteaUrl, settings.repos, settings.orgName, settings.dateRange),
    enabled: isConfigured,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: placeholder,
    queryFn: async ({ signal }) => {
      const since = getDateRangeStart(settings.dateRange);
      const until = new Date();
      const sinceISO = since.toISOString();

      // ── Step 1: discover org repos (if orgName configured) ─────────────────
      // Done first so we know which repos to fetch when settings.repos is empty
      const orgRepoList = settings.orgName
        ? await getOrgRepos(settings.orgName).catch(() => [])
        : [];

      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      // Use pinned repos when set, otherwise fall back to ALL org repos
      const reposToFetch =
        settings.repos.length > 0
          ? settings.repos.map((r) => { const [owner, repo] = r.split('/'); return { owner, repo }; })
          : orgRepoList.map((r) => ({ owner: r.owner.login, repo: r.name }));

      const availableRepos: string[] =
        orgRepoList.length > 0
          ? orgRepoList.map((r) => r.full_name)
          : settings.repos;

      // ── Step 2: parallel data fetches ──────────────────────────────────────
      // Repos are fetched with a concurrency cap so we don't fire hundreds of
      // simultaneous requests that overwhelm the server or hit rate-limits.
      const limit = createConcurrencyLimiter(REPO_FETCH_CONCURRENCY);

      const [allRepoData, orgMemberList, teamMemberDetails] = await Promise.all([
        Promise.all(
          reposToFetch.map(({ owner, repo }) =>
            limit(() => fetchRepoData(owner, repo, sinceISO, signal)),
          ),
        ),
        settings.orgName
          ? getOrgMembers(settings.orgName).catch(() => [] as GiteaUser[])
          : Promise.resolve([] as GiteaUser[]),
        // Fetch user objects for manually added team members
        settings.teamMembers && settings.teamMembers.length > 0
          ? Promise.all(
              settings.teamMembers.map((login) =>
                getUser(login).catch(() => null),
              ),
            ).then((users) => users.filter((u): u is GiteaUser => u !== null))
          : Promise.resolve([] as GiteaUser[]),
      ]);

      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      // Merge org members + manually added team members (deduplicated by login)
      const allMembersMap = new Map<string, GiteaUser>();
      for (const m of [...orgMemberList, ...teamMemberDetails]) {
        allMembersMap.set(m.login, m);
      }
      const allMembers = Array.from(allMembersMap.values());

      const allReviews = new Map<string, GiteaReview[]>();

      // Compute stats — CPU-bound work; runs once per cache miss, result memoised by React Query
      const engineers = computeEngineerStats(
        allRepoData,
        allReviews,
        settings.scoringWeights,
        since,
        until,
        settings.csAiLabel || 'cs_used',
      );

      const totalCommits = engineers.reduce((s, e) => s + e.totalCommits, 0);
      const totalPRs = engineers.reduce((s, e) => s + e.totalPRs, 0);
      const totalMergedPRs = engineers.reduce((s, e) => s + e.mergedPRs, 0);

      const dayTotals = new Map<string, number>();
      for (const eng of engineers) {
        for (const d of eng.dailyActivity) {
          dayTotals.set(d.date, (dayTotals.get(d.date) ?? 0) + d.commits);
        }
      }
      let mostActiveDay = '';
      let maxCommits = 0;
      for (const [day, count] of Array.from(dayTotals.entries())) {
        if (count > maxCommits) { maxCommits = count; mostActiveDay = day; }
      }

      const totalCsAiUsage = engineers.reduce((s, e) => s + e.csAiUsageCount, 0);
      const teamPrsByType = engineers.reduce((acc, e) => {
        for (const [type, count] of Object.entries(e.prsByType) as [PrType, number][]) {
          acc[type] = (acc[type] ?? 0) + count;
        }
        return acc;
      }, { ...EMPTY_PR_BY_TYPE });

      const result: TeamStats = {
        engineers,
        totalCommits,
        totalPRs,
        totalMergedPRs,
        activePeriod: { start: since.toISOString(), end: until.toISOString() },
        mostActiveDay,
        topContributor: engineers[0] ?? null,
        totalCsAiUsage,
        teamPrsByType,
        allMembers,
        availableRepos,
      };

      // Persist to IndexedDB (non-blocking — never throws to avoid failing the query)
      Promise.all([
        saveSnapshot(settings.giteaUrl, settings.repos, settings.dateRange, result),
        saveWeeklySnapshots(settings.giteaUrl, engineers),
      ]).catch(() => {/* non-fatal */});

      return result;
    },
  });
}

/** Hook that returns trend info for a single engineer (async, resolves from IndexedDB). */
export function useTrend(login: string): TrendResult {
  const settings = loadSettings();
  const noTrend: TrendResult = { scoreDelta: 0, rankDelta: 0, arrow: '→', color: '#64748b', hasPrev: false };
  const [trend, setTrend] = useState<TrendResult>(noTrend);

  useEffect(() => {
    if (!settings.giteaUrl || !login) return;
    getTrend(settings.giteaUrl, login)
      .then(setTrend)
      .catch(() => {/* non-fatal */});
  }, [settings.giteaUrl, login]);

  return trend;
}

/** Derived hook — individual engineer detail, memoised from team data (no extra API call) */
export function useEngineerDetail(username: string) {
  const { data, ...rest } = useAnalytics();
  const engineer = useMemo<EngineerStats | undefined>(
    () => data?.engineers.find((e) => e.user.login === username),
    [data, username],
  );
  return { engineer, teamSize: data?.engineers.length ?? 0, ...rest };
}

/** Derived hook — team activity aggregated from cached engineer data */
export function useTeamActivity() {
  const { data, ...rest } = useAnalytics();
  const teamActivity = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { date: string; commits: number; additions: number; deletions: number; prs: number }>();
    for (const eng of data.engineers) {
      for (const d of eng.dailyActivity) {
        const e = map.get(d.date) ?? { date: d.date, commits: 0, additions: 0, deletions: 0, prs: 0 };
        e.commits += d.commits; e.additions += d.additions; e.deletions += d.deletions; e.prs += d.prs;
        map.set(d.date, e);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);
  return { data, teamActivity, ...rest };
}
