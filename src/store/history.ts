/**
 * Weekly ScoreSnapshot store.
 *
 * After every successful fetch we write one lightweight record per engineer
 * keyed to the Monday of the current week. This lets us compute:
 *   - score delta vs previous week
 *   - rank change vs previous week
 *   - trend direction (↑ / ↓ / →)
 *
 * Keys: "{giteaHost}|{login}|{YYYY-MM-DD}" where YYYY-MM-DD is the week's Monday.
 */
import { get, set, keys, del } from 'idb-keyval';
import { historyStore } from './db';
import type { EngineerStats } from '../types';

export interface ScoreSnapshot {
  login: string;
  weekStart: string; // ISO Monday YYYY-MM-DD
  score: number;
  rank: number;
  commits: number;
  mergedPRs: number;
  activeDays: number;
  csAiUsageCount: number;
}

export interface TrendResult {
  scoreDelta: number;
  rankDelta: number;       // negative = improved (rank went from 5→3 = delta -2)
  arrow: '↑' | '↓' | '→';
  color: string;
  hasPrev: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMondayISO(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function historyKey(giteaUrl: string, login: string, weekStart: string): string {
  const host = new URL(giteaUrl).host;
  return `${host}|${login}|${weekStart}`;
}

function historyPrefix(giteaUrl: string, login: string): string {
  const host = new URL(giteaUrl).host;
  return `${host}|${login}|`;
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function saveWeeklySnapshots(
  giteaUrl: string,
  engineers: EngineerStats[],
): Promise<void> {
  const weekStart = getMondayISO();
  await Promise.all(
    engineers.map((eng) => {
      const snap: ScoreSnapshot = {
        login: eng.user.login,
        weekStart,
        score: eng.score,
        rank: eng.rank,
        commits: eng.totalCommits,
        mergedPRs: eng.mergedPRs,
        activeDays: eng.activeDays,
        csAiUsageCount: eng.csAiUsageCount ?? 0,
      };
      return set(historyKey(giteaUrl, eng.user.login, weekStart), snap, historyStore);
    }),
  );
}

// ── Read ─────────────────────────────────────────────────────────────────────

/** Returns snapshots for an engineer sorted newest-first. */
export async function getEngineerHistory(
  giteaUrl: string,
  login: string,
): Promise<ScoreSnapshot[]> {
  const prefix = historyPrefix(giteaUrl, login);
  const allKeys = (await keys(historyStore)) as string[];
  const matching = allKeys.filter((k) => k.startsWith(prefix)).sort().reverse();
  const results = await Promise.all(
    matching.map((k) => get<ScoreSnapshot>(k, historyStore)),
  );
  return results.filter(Boolean) as ScoreSnapshot[];
}

/** Compare this week's snapshot with the previous one and return trend info. */
export async function getTrend(
  giteaUrl: string,
  login: string,
): Promise<TrendResult> {
  const history = await getEngineerHistory(giteaUrl, login);
  const thisWeek  = getMondayISO();

  // This week's saved snap (may not exist yet if it's the first fetch today)
  const current  = history.find((s) => s.weekStart === thisWeek) ?? history[0];
  const previous = history.find((s) => s.weekStart !== current?.weekStart);

  if (!current || !previous) {
    return { scoreDelta: 0, rankDelta: 0, arrow: '→', color: '#64748b', hasPrev: false };
  }

  const scoreDelta = current.score - previous.score;
  const rankDelta  = current.rank  - previous.rank;  // negative = improved
  const pct = previous.score > 0 ? (scoreDelta / previous.score) * 100 : 0;

  const arrow: '↑' | '↓' | '→' = pct > 3 ? '↑' : pct < -3 ? '↓' : '→';
  const color = arrow === '↑' ? '#22c55e' : arrow === '↓' ? '#ef4444' : '#94a3b8';

  return { scoreDelta, rankDelta, arrow, color, hasPrev: true };
}

/** Delete history entries older than `maxWeeks` (default 12). */
export async function pruneOldHistory(giteaUrl: string, maxWeeks = 12): Promise<void> {
  const host = new URL(giteaUrl).host;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxWeeks * 7);
  const cutoffISO = getMondayISO(cutoffDate);
  const allKeys = (await keys(historyStore)) as string[];
  await Promise.all(
    allKeys
      .filter((k) => k.startsWith(host) && k.slice(-10) < cutoffISO)
      .map((k) => del(k, historyStore)),
  );
}
