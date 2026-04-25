import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, GitCommit, GitPullRequest, GitMerge, Star, Flame, Code2, Clock, Trophy, Bot,
} from 'lucide-react';
import { useEngineerDetail } from '../hooks/useAnalytics';
import { PageSkeleton } from '../components/Skeleton';
import { StatCard } from '../components/StatCard';
import { CommitHeatmap } from '../components/CommitHeatmap';
import { ActivityChart, ChurnChart } from '../components/ActivityChart';
import { formatMergeTime, getScoreColor } from '../utils/scoring';
import { loadSettings } from '../store/settings';
import type { PrType } from '../types';
import { PR_TYPE_COLORS } from '../types';

export function EngineerDetail() {
  const { username } = useParams<{ username: string }>();
  const { engineer: eng, teamSize, isLoading, error } = useEngineerDetail(username ?? '');

  if (isLoading) return <PageSkeleton />;

  if (error) {
    return <div className="p-6 text-slate-400">{error.message}</div>;
  }

  if (!eng) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400 mb-4">Engineer <strong>@{username}</strong> not found in dataset.</p>
        <Link to="/engineers" className="text-sky-400 hover:underline text-sm">← Back to Engineers</Link>
      </div>
    );
  }

  const scoreColor = getScoreColor(eng.rank, teamSize);
  const settings = loadSettings();
  const csLabel = settings.csAiLabel || 'cs_used';
  const prsByType = eng.prsByType ?? { feature: 0, bug: 0, chore: 0, docs: 0, refactor: 0, test: 0, other: 0 };
  const csAiUsageCount = eng.csAiUsageCount ?? 0;
  const totalClassifiedPRs = Object.values(prsByType).reduce((a, b) => a + b, 0) || 1;
  const PR_TYPE_ORDER: PrType[] = ['feature', 'bug', 'refactor', 'chore', 'docs', 'test', 'other'];

  return (
    <div className="p-6 space-y-6">
      {/* Back */}
      <Link to="/engineers" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-sky-400 transition-colors w-fit">
        <ArrowLeft size={15} />
        Back to Engineers
      </Link>

      {/* Profile header */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
        <img
          src={eng.user.avatar_url}
          alt={eng.user.login}
          className="w-20 h-20 rounded-full border-4 border-slate-600"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(eng.user.login)}&background=0ea5e9&color=fff&size=80`;
          }}
        />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-100">{eng.user.full_name || eng.user.login}</h1>
          <p className="text-slate-400 mt-0.5">@{eng.user.login}</p>
          {eng.user.email && <p className="text-slate-500 text-sm mt-0.5">{eng.user.email}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            {eng.reposContributed.map((repo) => (
              <span key={repo} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{repo}</span>
            ))}
          </div>
        </div>
        {/* Score bubble */}
        <div className="text-center flex flex-col items-center">
          <div
            className="w-20 h-20 rounded-full border-4 flex items-center justify-center flex-col"
            style={{ borderColor: scoreColor }}
          >
            <span className="text-xl font-black" style={{ color: scoreColor }}>{Math.round(eng.score)}</span>
            <span className="text-xs text-slate-500">pts</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
            <Trophy size={12} />
            Rank #{eng.rank} of {teamSize}
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard title="Commits" value={eng.totalCommits} icon={GitCommit} iconColor="text-sky-400" />
        <StatCard title="PRs Created" value={eng.totalPRs} icon={GitPullRequest} iconColor="text-violet-400" />
        <StatCard title="PRs Merged" value={eng.mergedPRs} subtitle={`Open: ${eng.openPRs}`} icon={GitMerge} iconColor="text-emerald-400" />
        <StatCard title="Reviews Given" value={eng.reviewsGiven} icon={Code2} iconColor="text-yellow-400" />
        <StatCard title="Active Days" value={eng.activeDays} icon={Flame} iconColor="text-orange-400" />
        <StatCard
          title="Avg Merge Time"
          value={eng.avgPRMergeTimeHours > 0 ? formatMergeTime(eng.avgPRMergeTimeHours) : '—'}
          icon={Clock}
          iconColor="text-pink-400"
        />
        <StatCard
          title="AI PRs"
          value={csAiUsageCount}
          subtitle={csAiUsageCount > 0 ? `label: ${csLabel}` : 'None yet'}
          icon={Bot}
          iconColor="text-cyan-400"
        />
      </div>

      {/* PR Type Breakdown + AI Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* PR type distribution */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">PR Type Breakdown</h3>
          <div className="space-y-2.5">
            {PR_TYPE_ORDER.filter((t) => prsByType[t] > 0).map((type) => {
              const count = prsByType[type];
              const pct = Math.round((count / totalClassifiedPRs) * 100);
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium capitalize" style={{ color: PR_TYPE_COLORS[type] }}>{type}</span>
                    <span className="text-xs text-slate-400">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: PR_TYPE_COLORS[type] }}
                    />
                  </div>
                </div>
              );
            })}
            {eng.totalPRs === 0 && (
              <p className="text-xs text-slate-500">No PRs in this period.</p>
            )}
          </div>
        </div>

        {/* AI IDE Usage */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={16} className="text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-300">Code Studio AI Usage</h3>
          </div>
          {csAiUsageCount > 0 ? (
            <>
              <div className="flex items-end gap-3 mb-4">
                <span className="text-5xl font-black text-cyan-400">{csAiUsageCount}</span>
                <div className="pb-1">
                  <p className="text-sm text-slate-400">PRs raised with AI assistance</p>
                  <p className="text-xs text-slate-600">label: <code className="text-slate-400">{csLabel}</code></p>
                </div>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 rounded-full"
                  style={{ width: `${Math.min(100, Math.round((csAiUsageCount / Math.max(eng.totalPRs, 1)) * 100))}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                {Math.round((csAiUsageCount / Math.max(eng.totalPRs, 1)) * 100)}% of all PRs used Code Studio
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-28 text-center gap-2">
              <Bot size={28} className="text-slate-600" />
              <p className="text-sm text-slate-500">No AI-assisted PRs yet</p>
              <p className="text-xs text-slate-600">Add <code className="text-slate-500">{csLabel}</code> label to a PR after using Code Studio</p>
            </div>
          )}
        </div>
      </div>

      {/* Streaks */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-2xl">
            🔥
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Current Streak</p>
            <p className="text-3xl font-black text-yellow-400">{eng.commitStreak}</p>
            <p className="text-xs text-slate-500">consecutive days</p>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
            <Star size={20} className="text-sky-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Best Streak</p>
            <p className="text-3xl font-black text-sky-400">{eng.longestStreak}</p>
            <p className="text-xs text-slate-500">consecutive days</p>
          </div>
        </div>
      </div>

      {/* Code additions/deletions totals */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Lines Added</p>
          <p className="text-3xl font-black text-emerald-400">+{eng.totalAdditions.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Lines Deleted</p>
          <p className="text-3xl font-black text-red-400">-{eng.totalDeletions.toLocaleString()}</p>
        </div>
      </div>

      {/* Commit Heatmap */}
      <CommitHeatmap data={eng.dailyActivity} title="Commit Heatmap" />

      {/* Activity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityChart data={eng.dailyActivity} type="area" title="Daily Commit Activity" height={200} />
        <ChurnChart data={eng.dailyActivity} height={200} />
      </div>

      {/* Weekly commits bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Weekly Commit Trend (Last 12 Weeks)</h3>
        <div className="flex items-end gap-1.5 h-24">
          {eng.weeklyCommits.map((count, i) => {
            const max = Math.max(...eng.weeklyCommits, 1);
            const h = (count / max) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${h}%`,
                    minHeight: count > 0 ? 4 : 2,
                    backgroundColor: i === 11 ? '#0ea5e9' : '#1e40af',
                    opacity: 0.5 + (i / 11) * 0.5,
                  }}
                  title={`Week ${i - 11 === 0 ? 'this' : Math.abs(i - 11)}: ${count} commits`}
                />
                {i % 3 === 0 && (
                  <span className="text-xs text-slate-600">{i === 11 ? 'now' : `w${i + 1}`}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
