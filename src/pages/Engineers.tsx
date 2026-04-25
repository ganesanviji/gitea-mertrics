import { useState, useEffect, useRef } from 'react';
import {
  Search, SlidersHorizontal, ChevronDown, ChevronRight,
  GitMerge, GitPullRequest, GitCommit, Flame, ExternalLink,
  X, AlertTriangle, Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, parseISO, differenceInHours } from 'date-fns';
import { useAnalytics } from '../hooks/useAnalytics';
import { EngineerCardSkeleton } from '../components/Skeleton';
import { loadSettings } from '../store/settings';
import { classifyPR, formatMergeTime } from '../utils/scoring';
import type { EngineerStats, EngineerPREntry, EngineerCommitEntry, GiteaUser } from '../types';
import { PR_TYPE_COLORS } from '../types';

type SortKey = 'score' | 'totalCommits' | 'mergedPRs' | 'activeDays' | 'commitStreak';
type PRFilter = 'all' | 'merged' | 'open' | 'closed';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'score',        label: 'Score' },
  { key: 'totalCommits', label: 'Commits' },
  { key: 'mergedPRs',    label: 'Merged PRs' },
  { key: 'activeDays',   label: 'Active Days' },
  { key: 'commitStreak', label: 'Streak' },
];

// ── PR Table ──────────────────────────────────────────────────────────────────
function PRTable({ entries = [], giteaUrl }: { entries?: EngineerPREntry[]; giteaUrl: string }) {
  const [filter, setFilter] = useState<PRFilter>('all');

  const merged = entries.filter((e) => e.pr.merged);
  const open   = entries.filter((e) => !e.pr.merged && e.pr.state === 'open');
  const closed = entries.filter((e) => !e.pr.merged && e.pr.state === 'closed');

  const visible = filter === 'all'   ? [...merged, ...open, ...closed]
                : filter === 'merged' ? merged
                : filter === 'open'   ? open
                : closed;

  const counts: Record<PRFilter, number> = {
    all:    entries.length,
    merged: merged.length,
    open:   open.length,
    closed: closed.length,
  };

  if (entries.length === 0) {
    return <p className="text-xs text-slate-500 px-1 py-3">No PRs in the selected date range.</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {(['all', 'merged', 'open', 'closed'] as PRFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
            }`}
          >
            {f} <span className="opacity-60">({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-900/60">
              <th className="text-left text-slate-500 font-medium px-3 py-2 w-10">#</th>
              <th className="text-left text-slate-500 font-medium px-3 py-2">Title</th>
              <th className="text-left text-slate-500 font-medium px-3 py-2 hidden sm:table-cell">Repo</th>
              <th className="text-left text-slate-500 font-medium px-3 py-2">Type</th>
              <th className="text-left text-slate-500 font-medium px-3 py-2">State</th>
              <th className="text-left text-slate-500 font-medium px-3 py-2 hidden md:table-cell">Created</th>
              <th className="text-left text-slate-500 font-medium px-3 py-2 hidden md:table-cell">Merge&nbsp;Time</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ pr, repoKey }) => {
              const type = classifyPR(pr);
              const typeColor = PR_TYPE_COLORS[type];
              const prUrl = `${giteaUrl.replace(/\/$/, '')}/${repoKey}/pulls/${pr.number}`;
              const mergeTime = pr.merged && pr.merged_at
                ? differenceInHours(parseISO(pr.merged_at), parseISO(pr.created_at))
                : null;

              return (
                <tr key={`${repoKey}#${pr.number}`} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                  {/* Number */}
                  <td className="px-3 py-2 text-slate-500 tabular-nums">#{pr.number}</td>

                  {/* Title */}
                  <td className="px-3 py-2 max-w-xs">
                    <a
                      href={prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-200 hover:text-sky-300 transition-colors flex items-start gap-1 group"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="truncate leading-snug">{pr.title}</span>
                      <ExternalLink size={10} className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </a>
                  </td>

                  {/* Repo */}
                  <td className="px-3 py-2 text-slate-400 hidden sm:table-cell whitespace-nowrap">{repoKey.split('/')[1]}</td>

                  {/* Type */}
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium capitalize"
                      style={{ backgroundColor: `${typeColor}22`, color: typeColor, border: `1px solid ${typeColor}44` }}
                    >
                      {type}
                    </span>
                  </td>

                  {/* State */}
                  <td className="px-3 py-2">
                    {pr.merged ? (
                      <span className="inline-flex items-center gap-1 text-violet-400 font-medium">
                        <GitMerge size={11} /> merged
                      </span>
                    ) : pr.state === 'open' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                        <GitPullRequest size={11} /> open
                      </span>
                    ) : (
                      <span className="text-slate-500">closed</span>
                    )}
                  </td>

                  {/* Created */}
                  <td className="px-3 py-2 text-slate-500 hidden md:table-cell whitespace-nowrap">
                    {formatDistanceToNow(parseISO(pr.created_at), { addSuffix: true })}
                  </td>

                  {/* Merge time */}
                  <td className="px-3 py-2 text-slate-500 hidden md:table-cell">
                    {mergeTime !== null ? formatMergeTime(mergeTime) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Commit Modal ─────────────────────────────────────────────────────────────
function CommitModal({
  entries, login, giteaUrl, onClose,
}: {
  entries: EngineerCommitEntry[];
  login: string;
  giteaUrl: string;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  const baseUrl = giteaUrl.replace(/\/$/, '');

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <GitCommit size={16} className="text-sky-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                Commits by <span className="text-sky-300">@{login}</span>
              </h2>
              <p className="text-xs text-slate-500">{entries.length} commit{entries.length !== 1 ? 's' : ''} in selected period</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors p-1 rounded-md hover:bg-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          {entries.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-10">No commits in the selected date range.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-500 font-medium px-4 py-2.5 w-20">SHA</th>
                  <th className="text-left text-slate-500 font-medium px-4 py-2.5">Message</th>
                  <th className="text-left text-slate-500 font-medium px-4 py-2.5 hidden sm:table-cell">Repo</th>
                  <th className="text-left text-slate-500 font-medium px-4 py-2.5 hidden md:table-cell">Date</th>
                  <th className="text-right text-slate-500 font-medium px-4 py-2.5 hidden md:table-cell">+/-</th>
                </tr>
              </thead>
              <tbody>
                {[...entries]
                  .sort((a, b) =>
                    new Date(b.commit.commit.author.date).getTime() -
                    new Date(a.commit.commit.author.date).getTime(),
                  )
                  .map(({ commit, repoKey }) => {
                    const sha7 = commit.sha.slice(0, 7);
                    const commitUrl = commit.html_url || `${baseUrl}/${repoKey}/commit/${commit.sha}`;
                    const additions = commit.stats?.additions ?? 0;
                    const deletions = commit.stats?.deletions ?? 0;
                    const date = new Date(commit.commit.author.date);
                    const firstLine = commit.commit.message.split('\n')[0];

                    return (
                      <tr
                        key={commit.sha}
                        className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
                      >
                        {/* SHA */}
                        <td className="px-4 py-2.5">
                          <a
                            href={commitUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1 group"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {sha7}
                            <ExternalLink size={10} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                          </a>
                        </td>

                        {/* Message */}
                        <td className="px-4 py-2.5 max-w-xs">
                          <span className="text-slate-200 truncate block leading-snug" title={commit.commit.message}>
                            {firstLine}
                          </span>
                        </td>

                        {/* Repo */}
                        <td className="px-4 py-2.5 text-slate-400 hidden sm:table-cell whitespace-nowrap">
                          {repoKey.split('/')[1]}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell whitespace-nowrap">
                          {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>

                        {/* Additions / Deletions */}
                        <td className="px-4 py-2.5 text-right hidden md:table-cell whitespace-nowrap">
                          <span className="text-emerald-400">+{additions}</span>
                          <span className="text-slate-600 mx-0.5">/</span>
                          <span className="text-red-400">-{deletions}</span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Non-Contributor Row ────────────────────────────────────────────────────────
function NonContributorRow({ user }: { user: GiteaUser }) {
  return (
    <div className="bg-slate-800/60 border border-red-500/20 rounded-xl overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3.5">
        {/* Spacer for expand icon column */}
        <span className="w-4 flex-shrink-0" />

        {/* Avatar */}
        <img
          src={user.avatar_url}
          alt={user.login}
          className="w-8 h-8 rounded-full border border-slate-600 flex-shrink-0 opacity-60"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              `https://ui-avatars.com/api/?name=${encodeURIComponent(user.login)}&background=ef4444&color=fff`;
          }}
        />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-300 text-sm">{user.full_name || user.login}</p>
          <p className="text-xs text-slate-500">@{user.login}</p>
        </div>

        {/* Escalation badge */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
          <AlertTriangle size={13} />
          <span className="font-medium">No commits or PRs — escalate</span>
        </div>

        {/* 0 stats */}
        <div className="flex items-center gap-4 flex-shrink-0 opacity-40">
          <Stat icon={GitCommit}      label="Commits"   value={0} iconClass="text-sky-400" />
          <Stat icon={GitMerge}       label="Merged"    value={0} iconClass="text-violet-400" />
          <Stat icon={GitPullRequest} label="Total PRs" value={0} iconClass="text-emerald-400" />
        </div>

        {/* Score: 0 */}
        <div className="text-right flex-shrink-0 ml-2 opacity-40">
          <p className="text-base font-bold text-red-400">0</p>
          <p className="text-xs text-slate-500">score</p>
        </div>
      </div>
    </div>
  );
}

// ── Engineer Row ──────────────────────────────────────────────────────────────
function EngineerRow({ stats, giteaUrl }: { stats: EngineerStats; giteaUrl: string }) {
  const [expanded, setExpanded] = useState(false);
  const [commitModalOpen, setCommitModalOpen] = useState(false);

  return (
    <>
      {commitModalOpen && (
        <CommitModal
          entries={stats.commits ?? []}
          login={stats.user.login}
          giteaUrl={giteaUrl}
          onClose={() => setCommitModalOpen(false)}
        />
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden transition-all">
        {/* Summary row */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-700/30 transition-colors text-left"
        >
          {/* Expand icon */}
          <span className="text-slate-500 flex-shrink-0">
            {expanded
              ? <ChevronDown size={16} />
              : <ChevronRight size={16} />}
          </span>

          {/* Avatar */}
          <img
            src={stats.user.avatar_url}
            alt={stats.user.login}
            className="w-8 h-8 rounded-full border border-slate-600 flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                `https://ui-avatars.com/api/?name=${encodeURIComponent(stats.user.login)}&background=0ea5e9&color=fff`;
            }}
          />

          {/* Name */}
          <div className="flex-1 min-w-0">
            <Link
              to={`/engineers/${stats.user.login}`}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-slate-100 hover:text-sky-300 transition-colors text-sm"
            >
              {stats.user.full_name || stats.user.login}
            </Link>
            <p className="text-xs text-slate-500">@{stats.user.login}</p>
          </div>

          {/* Metrics */}
          <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
            <Stat
              icon={GitCommit}
              label="Commits"
              value={stats.totalCommits}
              iconClass="text-sky-400"
              onClick={(e) => {
                e.stopPropagation();
                if (stats.totalCommits > 0) setCommitModalOpen(true);
              }}
              clickable={stats.totalCommits > 0}
              title="Click to view commit details"
            />
            <Stat icon={GitMerge}       label="Merged"    value={stats.mergedPRs}        iconClass="text-violet-400" />
            <Stat icon={GitPullRequest} label="Total PRs" value={stats.totalPRs}         iconClass="text-emerald-400" />
            <Stat icon={Flame}          label="Active"    value={`${stats.activeDays}d`} iconClass="text-orange-400" />
          </div>

          {/* Score */}
          <div className="text-right flex-shrink-0 ml-2">
            <p className="text-base font-bold text-sky-400">{Math.round(stats.score)}</p>
            <p className="text-xs text-slate-500">score</p>
          </div>
        </button>

        {/* Expanded PR table */}
        {expanded && (
          <div className="px-4 pb-4 border-t border-slate-700/50">
            <PRTable entries={stats.prs ?? []} giteaUrl={giteaUrl} />
          </div>
        )}
      </div>
    </>
  );
}

function Stat({
  icon: Icon, label, value, iconClass, onClick, clickable, title,
}: {
  icon: typeof GitCommit;
  label: string;
  value: string | number;
  iconClass: string;
  onClick?: (e: React.MouseEvent) => void;
  clickable?: boolean;
  title?: string;
}) {
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      title={title}
      onClick={onClick}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick?.(e as unknown as React.MouseEvent) : undefined}
      className={`flex flex-col items-center gap-0.5 ${
        clickable
          ? 'cursor-pointer group hover:bg-slate-700/50 rounded-md px-1.5 py-0.5 -mx-1.5 transition-colors'
          : ''
      }`}
    >
      <Icon size={13} className={`${iconClass} ${clickable ? 'group-hover:scale-110 transition-transform' : ''}`} />
      <p className={`text-sm font-semibold tabular-nums leading-none ${
        clickable ? 'text-sky-300 underline decoration-dotted underline-offset-2' : 'text-slate-100'
      }`}>{value}</p>
      <p className="text-xs text-slate-500 leading-none">{label}</p>
    </div>
  );
}

type ViewFilter = 'contributors' | 'non-contributors' | 'all';

// ── Page ──────────────────────────────────────────────────────────────────────
export function Engineers() {
  const { data, isLoading, error } = useAnalytics();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('contributors');
  const settings = loadSettings();

  if (isLoading) {
    return (
      <div className="p-6 space-y-5">
        <div className="space-y-1">
          <div className="h-6 w-32 bg-slate-700 rounded animate-pulse" />
          <div className="h-3 w-48 bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <EngineerCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-slate-400">
        {error?.message ?? 'No data available. Configure Settings first.'}
      </div>
    );
  }

  // Compute non-contributors: org members who have no commits / PRs
  const contributorLogins = new Set(data.engineers.map((e) => e.user.login));
  const nonContributors = (data.allMembers ?? []).filter(
    (m) => !contributorLogins.has(m.login),
  );

  const q = search.toLowerCase();

  const filteredContributors = data.engineers
    .filter((e) =>
      e.user.login.toLowerCase().includes(q) ||
      e.user.full_name?.toLowerCase().includes(q) ||
      e.user.email?.toLowerCase().includes(q),
    )
    .sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))
    .map((e, i) => ({ ...e, rank: i + 1 } as EngineerStats));

  const filteredNonContributors = nonContributors.filter(
    (m) =>
      m.login.toLowerCase().includes(q) ||
      m.full_name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q),
  );

  // hasMemberList covers both org members (fetched via orgName) AND manually added team members
  const hasMemberList = (data.allMembers?.length ?? 0) > 0;

  const VIEW_TABS: { key: ViewFilter; label: string; count: number; color?: string }[] = [
    { key: 'contributors',     label: 'Contributors',     count: data.engineers.length },
    { key: 'non-contributors', label: 'Non-contributors', count: nonContributors.length, color: 'red' },
    { key: 'all',              label: 'All Members',      count: hasMemberList ? (data.allMembers?.length ?? 0) : data.engineers.length },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">Engineers</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {data.engineers.length} contributors
          {nonContributors.length > 0 && (
            <> · <span className="text-red-400 font-medium">{nonContributors.length} non-contributor{nonContributors.length !== 1 ? 's' : ''}</span></>
          )}
          {' '}· click row to expand PRs · click commit count to view commits
        </p>
      </div>

      {/* View filter tabs — shown when org members or manually added team members exist */}
      {hasMemberList && (
        <div className="flex gap-1.5 flex-wrap">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewFilter === tab.key
                  ? tab.color === 'red'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700 border border-transparent'
              }`}
            >
              {tab.key === 'non-contributors' && <AlertTriangle size={12} />}
              {tab.key === 'contributors' && <GitCommit size={12} />}
              {tab.key === 'all' && <Users size={12} />}
              {tab.label}
              <span className="opacity-60">({tab.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or username..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
        {viewFilter !== 'non-contributors' && (
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-slate-500" />
            <span className="text-xs text-slate-500">Sort by:</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Lists */}
      <div className="space-y-2">
        {/* Contributors */}
        {(viewFilter === 'contributors' || viewFilter === 'all') && (
          <>
            {filteredContributors.map((e) => (
              <EngineerRow key={e.user.login} stats={e} giteaUrl={settings.giteaUrl} />
            ))}
            {filteredContributors.length === 0 && viewFilter === 'contributors' && (
              <p className="text-sm text-slate-500 text-center py-10">No engineers match your search.</p>
            )}
          </>
        )}

        {/* Non-contributors */}
        {(viewFilter === 'non-contributors' || viewFilter === 'all') && (
          <>
            {viewFilter === 'all' && filteredNonContributors.length > 0 && (
              <div className="flex items-center gap-2 pt-3 pb-1">
                <AlertTriangle size={14} className="text-red-400" />
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                  Non-contributors ({filteredNonContributors.length}) — no commits or PR activity
                </p>
              </div>
            )}
            {filteredNonContributors.map((m) => (
              <NonContributorRow key={m.login} user={m} />
            ))}
            {filteredNonContributors.length === 0 && viewFilter === 'non-contributors' && (
              nonContributors.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  {!hasMemberList ? (
                    <>
                      <Users size={28} className="mx-auto text-slate-600" />
                      <p className="text-sm text-slate-500">
                        Add engineers via <strong className="text-slate-400">Team Members</strong> in Settings, or set an
                        {' '}<strong className="text-slate-400">Organisation Name</strong> to auto-load all members.
                      </p>
                    </>
                  ) : (
                    <>
                      <GitCommit size={28} className="mx-auto text-emerald-500" />
                      <p className="text-sm text-slate-400">Everyone is contributing — great work! 🎉</p>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-10">No members match your search.</p>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
