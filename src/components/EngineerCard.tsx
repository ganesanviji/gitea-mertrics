import { Link } from 'react-router-dom';
import { GitCommit, GitPullRequest, Star, Flame } from 'lucide-react';
import type { EngineerStats } from '../types';
import { cn } from '../utils/cn';
import { useTrend } from '../hooks/useAnalytics';

interface EngineerCardProps {
  stats: EngineerStats;
  totalEngineers: number;
}

const RANK_BADGE: Record<number, { label: string; color: string }> = {
  1: { label: '🥇', color: 'border-yellow-500/40 bg-yellow-500/10' },
  2: { label: '🥈', color: 'border-slate-400/40 bg-slate-400/10' },
  3: { label: '🥉', color: 'border-amber-600/40 bg-amber-600/10' },
};

export function EngineerCard({ stats, totalEngineers }: EngineerCardProps) {
  const pct = Math.round((stats.rank / totalEngineers) * 100);
  const rankBadge = RANK_BADGE[stats.rank];
  const trend = useTrend(stats.user.login);

  return (
    <Link
      to={`/engineers/${stats.user.login}`}
      className={cn(
        'block bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-sky-500/50 hover:bg-slate-800/80 transition-all group',
        rankBadge?.color,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <img
            src={stats.user.avatar_url}
            alt={stats.user.login}
            className="w-11 h-11 rounded-full border-2 border-slate-600 group-hover:border-sky-500 transition-colors"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(stats.user.login)}&background=0ea5e9&color=fff`;
            }}
          />
          {rankBadge && (
            <span className="absolute -top-1 -right-1 text-xs">{rankBadge.label}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-100 truncate">{stats.user.full_name || stats.user.login}</p>
          <p className="text-xs text-slate-400 truncate">@{stats.user.login}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1">
            <p className="text-lg font-bold text-sky-400">{Math.round(stats.score)}</p>
            {trend.hasPrev && (
              <span className="text-sm font-bold" style={{ color: trend.color }} title={`${trend.scoreDelta > 0 ? '+' : ''}${Math.round(trend.scoreDelta)} pts vs last week`}>
                {trend.arrow}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {trend.hasPrev && trend.scoreDelta !== 0
              ? `${trend.scoreDelta > 0 ? '+' : ''}${Math.round(trend.scoreDelta)} pts`
              : 'score'}
          </p>
        </div>
      </div>

      {/* Mini bar chart: weekly commits */}
      <div className="flex items-end gap-0.5 h-8 mb-4">
        {stats.weeklyCommits.map((count, i) => {
          const max = Math.max(...stats.weeklyCommits, 1);
          const h = Math.max((count / max) * 100, count > 0 ? 10 : 2);
          return (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all"
              style={{
                height: `${h}%`,
                backgroundColor: count > 0 ? '#0ea5e9' : '#1e293b',
                opacity: i === 11 ? 1 : 0.4 + (i / 11) * 0.6,
              }}
              title={`Week ${i + 1}: ${count} commits`}
            />
          );
        })}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <Metric icon={GitCommit} label="Commits" value={stats.totalCommits} color="text-sky-400" />
        <Metric icon={GitPullRequest} label="PRs" value={`${stats.mergedPRs}/${stats.totalPRs}`} color="text-violet-400" />
        <Metric icon={Flame} label="Active Days" value={stats.activeDays} color="text-orange-400" />
        <Metric icon={Star} label="Streak" value={`${stats.commitStreak}d`} color="text-yellow-400" />
      </div>

      {/* Rank bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Rank #{stats.rank}</span>
          <span>Top {pct}%</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500"
            style={{ width: `${100 - pct + 5}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof GitCommit;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-slate-700/40 rounded-lg px-2.5 py-2 flex items-center gap-2">
      <Icon size={13} className={color} />
      <div>
        <p className="text-xs text-slate-500 leading-none">{label}</p>
        <p className="text-sm font-semibold text-slate-100 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
