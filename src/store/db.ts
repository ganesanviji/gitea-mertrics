/**
 * IndexedDB persistence layer via idb-keyval.
 *
 * Two stores:
 *   "snapshots"  — full TeamStats blobs, keyed by repos+dateRange+date
 *   "history"    — lightweight weekly ScoreSnapshot per engineer
 *
 * All keys are namespaced by giteaUrl so multiple Gitea instances
 * stored in the same browser never collide.
 */
import { createStore, get, set, del, keys } from 'idb-keyval';
import type { TeamStats } from '../types';

// ── Store handles ────────────────────────────────────────────────────────────
// Each store uses its own DB name so idb-keyval's onupgradeneeded fires
// independently for each store (sharing one DB name causes the second store
// to never be created because the DB is already at version 1).
export const snapshotStore = createStore('gitea-metrics-snapshots', 'snapshots');
export const historyStore  = createStore('gitea-metrics-history',   'history');

// ── Snapshot helpers ─────────────────────────────────────────────────────────

/** Deterministic key: "{giteaHost}|{sorted repos}|{dateRange}|{YYYY-MM-DD}" */
export function snapshotKey(giteaUrl: string, repos: string[], dateRange: string): string {
  const host = new URL(giteaUrl).host;
  const date = new Date().toISOString().slice(0, 10);
  return `${host}|${[...repos].sort().join(',')}|${dateRange}|${date}`;
}

/** Key prefix for listing all snapshots for a given config (any date) */
export function snapshotPrefix(giteaUrl: string, repos: string[], dateRange: string): string {
  const host = new URL(giteaUrl).host;
  return `${host}|${[...repos].sort().join(',')}|${dateRange}|`;
}

export async function saveSnapshot(
  giteaUrl: string,
  repos: string[],
  dateRange: string,
  data: TeamStats,
): Promise<void> {
  const key = snapshotKey(giteaUrl, repos, dateRange);
  await set(key, { data, savedAt: Date.now() }, snapshotStore);
}

/** Returns the most recent snapshot for this config, or undefined. */
export async function loadLatestSnapshot(
  giteaUrl: string,
  repos: string[],
  dateRange: string,
): Promise<TeamStats | undefined> {
  const prefix = snapshotPrefix(giteaUrl, repos, dateRange);
  const allKeys = (await keys(snapshotStore)) as string[];
  const matching = allKeys
    .filter((k) => k.startsWith(prefix))
    .sort()
    .reverse(); // most recent date first

  if (matching.length === 0) return undefined;
  const entry = await get<{ data: TeamStats; savedAt: number }>(matching[0], snapshotStore);
  return entry?.data;
}

/** Delete snapshots older than `maxAgeDays` (default 90). */
export async function pruneOldSnapshots(maxAgeDays = 90): Promise<void> {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const allKeys = (await keys(snapshotStore)) as string[];
  await Promise.all(
    allKeys.map(async (k) => {
      const entry = await get<{ data: TeamStats; savedAt: number }>(k, snapshotStore);
      if (entry && entry.savedAt < cutoff) await del(k, snapshotStore);
    }),
  );
}
