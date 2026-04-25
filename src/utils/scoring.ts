import { format, eachDayOfInterval, parseISO, differenceInHours } from 'date-fns';
import type {
  GiteaPullRequest,
  GiteaReview,
  DailyActivity,
  EngineerStats,
  EngineerPREntry,
  EngineerCommitEntry,
  GiteaUser,
  AppSettings,
  PrType,
} from '../types';
import { PR_TYPE_LABELS_MAP, EMPTY_PR_BY_TYPE } from '../types';
import type { RepoData } from '../api/gitea';

// ── PR Classification ────────────────────────────────────────────────────────

/**
 * Classify a PR into a type by checking its labels first, then falling back
 * to title heuristics. Returns the first matched type or 'other'.
 */
export function classifyPR(pr: GiteaPullRequest): PrType {
  const labelNames = pr.labels.map((l) => l.name.toLowerCase().trim());
  for (const [type, keywords] of Object.entries(PR_TYPE_LABELS_MAP) as [PrType, string[]][]) {
    if (type === 'other') continue;
    if (labelNames.some((l) => keywords.some((k) => l === k || l.startsWith(k)))) return type;
  }
  // Title-based heuristic when no matching label found
  const t = pr.title.toLowerCase();
  if (/^(feat|feature|add |new )/i.test(t)) return 'feature';
  if (/^(fix|bug|hotfix|patch)/i.test(t))   return 'bug';
  if (/^(docs?|readme|changelog)/i.test(t)) return 'docs';
  if (/^(refactor|cleanup|clean up)/i.test(t)) return 'refactor';
  if (/^(test|spec|coverage)/i.test(t))      return 'test';
  if (/^(chore|bump|deps?|ci:|build:)/i.test(t)) return 'chore';
  return 'other';
}

/** Returns true for auto-generated merge commits that don't reflect real work */
function isMergeCommit(message: string): boolean {
  return /^Merge (branch|pull request|remote|tag)/i.test(message.trim());
}

function getUserKey(user: GiteaUser | null, authorName: string): string {
  return user?.login ?? authorName.toLowerCase().replace(/\s+/g, '.');
}

export function computeEngineerStats(
  allRepoData: RepoData[],
  allReviews: Map<string, GiteaReview[]>, // key: "owner/repo#prNumber"
  weights: AppSettings['scoringWeights'],
  sinceDate: Date,
  untilDate: Date,
  csAiLabel = 'cs_used',
): EngineerStats[] {
  // Collect all unique users
  const userMap = new Map<string, GiteaUser | null>();
  const commitsByUser = new Map<string, EngineerCommitEntry[]>();
  const prsByUser = new Map<string, EngineerPREntry[]>();
  const reviewsByUser = new Map<string, GiteaReview[]>();
  const reposByUser = new Map<string, Set<string>>();

  for (const { owner, repo, commits, prs } of allRepoData) {
    const repoKey = `${owner}/${repo}`;

    for (const commit of commits) {
      // Skip auto-generated merge commits — they inflate count without real work
      if (isMergeCommit(commit.commit.message)) continue;
      const key = getUserKey(commit.author, commit.commit.author.name);
      if (!userMap.has(key)) userMap.set(key, commit.author);
      if (!commitsByUser.has(key)) commitsByUser.set(key, []);
      commitsByUser.get(key)!.push({ commit, repoKey });
      if (!reposByUser.has(key)) reposByUser.set(key, new Set());
      reposByUser.get(key)!.add(repoKey);
    }

    for (const pr of prs) {
      const key = pr.user.login;
      if (!userMap.has(key)) userMap.set(key, pr.user);
      if (!prsByUser.has(key)) prsByUser.set(key, []);
      prsByUser.get(key)!.push({ pr, repoKey });
      if (!reposByUser.has(key)) reposByUser.set(key, new Set());
      reposByUser.get(key)!.add(repoKey);
    }
  }

  // Collect reviews
  for (const [, reviews] of Array.from(allReviews.entries())) {
    for (const review of reviews) {
      const key = review.user.login;
      if (!userMap.has(key)) userMap.set(key, review.user);
      if (!reviewsByUser.has(key)) reviewsByUser.set(key, []);
      reviewsByUser.get(key)!.push(review);
    }
  }

  // ── Identity merge ───────────────────────────────────────────────────────
  // When a git commit's author email doesn't match any Gitea account, the API
  // returns commit.author = null and we fall back to a key derived from the
  // git author name (e.g. "Aravind Dharani" → "aravind.dharani").
  // PRs always use the real Gitea login (e.g. "AravindDharani").
  // Without merging, the same person appears twice — once with commits and
  // once with PRs — producing the "0 commits / 12 merged PRs" split.
  //
  // Strategy: build three normalised forms for every known Gitea user, then
  // check each fallback key against all three to find its canonical login.
  //   1. dot-separated full_name  : "aravind.dharani"
  //   2. lowercase login          : "aravinddharani"
  //   3. stripped (no separators) : "aravinddharani"  ← catches mixed cases
  const strip = (s: string) => s.toLowerCase().replace(/[\s._\-]+/g, '');

  const nameToLoginMap = new Map<string, string>();
  for (const [login, user] of Array.from(userMap.entries())) {
    if (!user) continue;
    const forms = [
      user.full_name.toLowerCase().replace(/\s+/g, '.'),   // "aravind.dharani"
      user.login.toLowerCase(),                              // "aravinddharani"
      strip(user.full_name),                                 // "aravinddharani"
      strip(user.login),                                     // "aravinddharani"
    ];
    for (const f of forms) {
      if (f && !nameToLoginMap.has(f)) nameToLoginMap.set(f, login);
    }
  }

  for (const [fallbackKey, user] of Array.from(userMap.entries())) {
    if (user !== null) continue; // only process ghost (null-user) entries

    // Try exact match first, then strip-match
    const canonicalLogin =
      nameToLoginMap.get(fallbackKey) ??
      nameToLoginMap.get(strip(fallbackKey));

    if (!canonicalLogin || canonicalLogin === fallbackKey) continue;

    // Merge commits into the canonical bucket
    const src = commitsByUser.get(fallbackKey) ?? [];
    const dst = commitsByUser.get(canonicalLogin) ?? [];
    commitsByUser.set(canonicalLogin, [...dst, ...src]);
    commitsByUser.delete(fallbackKey);

    // Merge repos
    const srcRepos = reposByUser.get(fallbackKey) ?? new Set<string>();
    const dstRepos = reposByUser.get(canonicalLogin) ?? new Set<string>();
    for (const r of srcRepos) dstRepos.add(r);
    reposByUser.set(canonicalLogin, dstRepos);
    reposByUser.delete(fallbackKey);

    // Drop the now-redundant ghost entry
    userMap.delete(fallbackKey);
  }
  // ────────────────────────────────────────────────────────────────────────

  const allDays = eachDayOfInterval({ start: sinceDate, end: untilDate });
  const stats: EngineerStats[] = [];

  for (const [login, user] of Array.from(userMap.entries())) {
    const commitEntries = commitsByUser.get(login) ?? [];
    const commits = commitEntries.map((e) => e.commit);
    const prEntries = prsByUser.get(login) ?? [];
    const prs = prEntries.map((e) => e.pr);
    const reviews = reviewsByUser.get(login) ?? [];

    const totalAdditions = commits.reduce((s, c) => s + (c.stats?.additions ?? 0), 0);
    const totalDeletions = commits.reduce((s, c) => s + (c.stats?.deletions ?? 0), 0);
    const mergedPRs = prs.filter((p) => p.merged);
    const openPRs = prs.filter((p) => p.state === 'open');

    // PR type breakdown
    const prsByType: Record<PrType, number> = { ...EMPTY_PR_BY_TYPE };
    let csAiUsageCount = 0;
    for (const pr of prs) {
      prsByType[classifyPR(pr)]++;
      if (pr.labels.some((l) => l.name.toLowerCase() === csAiLabel.toLowerCase())) {
        csAiUsageCount++;
      }
    }

    // Avg PR merge time
    const mergeTimes = mergedPRs
      .filter((p) => p.merged_at)
      .map((p) => differenceInHours(parseISO(p.merged_at!), parseISO(p.created_at)));
    const avgPRMergeTimeHours =
      mergeTimes.length > 0 ? mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length : 0;

    // Daily activity map
    const commitDateMap = new Map<string, { commits: number; adds: number; dels: number; prs: number }>();
    for (const day of allDays) {
      commitDateMap.set(format(day, 'yyyy-MM-dd'), { commits: 0, adds: 0, dels: 0, prs: 0 });
    }
    for (const c of commits) {
      const d = format(parseISO(c.commit.author.date), 'yyyy-MM-dd');
      if (commitDateMap.has(d)) {
        const entry = commitDateMap.get(d)!;
        entry.commits++;
        entry.adds += c.stats?.additions ?? 0;
        entry.dels += c.stats?.deletions ?? 0;
      }
    }
    for (const p of prs) {
      const d = format(parseISO(p.created_at), 'yyyy-MM-dd');
      if (commitDateMap.has(d)) commitDateMap.get(d)!.prs++;
    }

    const dailyActivity: DailyActivity[] = Array.from(commitDateMap.entries()).map(
      ([date, v]) => ({
        date,
        commits: v.commits,
        additions: v.adds,
        deletions: v.dels,
        prs: v.prs,
      }),
    );

    // Active days & streaks
    const activeDays = dailyActivity.filter((d) => d.commits > 0 || d.prs > 0).length;
    let streak = 0;
    let longestStreak = 0;
    let currentStreak = 0;
    for (let i = dailyActivity.length - 1; i >= 0; i--) {
      const active = dailyActivity[i].commits > 0 || dailyActivity[i].prs > 0;
      if (active) {
        currentStreak++;
        if (i === dailyActivity.length - 1 || i === dailyActivity.length - 2) streak = currentStreak;
      } else {
        if (currentStreak > longestStreak) longestStreak = currentStreak;
        currentStreak = 0;
      }
    }
    if (currentStreak > longestStreak) longestStreak = currentStreak;

    // Weekly commits (last 12 weeks)
    const weeklyCommits: number[] = Array(12).fill(0);
    for (const c of commits) {
      const date = parseISO(c.commit.author.date);
      const weeksAgo = Math.floor((untilDate.getTime() - date.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (weeksAgo >= 0 && weeksAgo < 12) weeklyCommits[11 - weeksAgo]++;
    }

    // Scoring
    const score =
      commits.length * weights.commits +
      totalAdditions * weights.additions +
      prs.length * weights.prsCreated +
      mergedPRs.length * weights.prsMerged +
      reviews.length * weights.reviewsGiven +
      activeDays * weights.activeDays +
      csAiUsageCount * (weights.csAiUsage ?? 6);

    const ghostUser: GiteaUser = {
      id: -1,
      login,
      full_name: login,
      email: '',
      avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(login)}&background=0ea5e9&color=fff`,
      created: '',
    };

    stats.push({
      user: user ?? ghostUser,
      totalCommits: commits.length,
      totalAdditions,
      totalDeletions,
      totalPRs: prs.length,
      mergedPRs: mergedPRs.length,
      openPRs: openPRs.length,
      reviewsGiven: reviews.length,
      avgPRMergeTimeHours,
      activeDays,
      commitStreak: streak,
      longestStreak,
      dailyActivity,
      weeklyCommits,
      reposContributed: Array.from(reposByUser.get(login) ?? []),
      csAiUsageCount,
      prsByType,
      prs: prEntries,
      commits: commitEntries,
      score,
      rank: 0,
    });
  }

  // Sort by score and assign ranks
  stats.sort((a, b) => b.score - a.score);
  stats.forEach((s, i) => (s.rank = i + 1));

  return stats;
}

export function formatMergeTime(hours: number): string {
  if (hours < 1) return '< 1h';
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

export function getScoreColor(rank: number, total: number): string {
  const pct = rank / total;
  if (pct <= 0.2) return '#22c55e'; // top 20% — green
  if (pct <= 0.5) return '#f59e0b'; // mid — amber
  return '#ef4444'; // lower — red
}

export function getTrendIndicator(current: number, previous: number): { arrow: string; color: string; pct: number } {
  if (previous === 0) return { arrow: '→', color: '#94a3b8', pct: 0 };
  const pct = ((current - previous) / previous) * 100;
  if (pct > 5) return { arrow: '↑', color: '#22c55e', pct };
  if (pct < -5) return { arrow: '↓', color: '#ef4444', pct };
  return { arrow: '→', color: '#f59e0b', pct };
}
