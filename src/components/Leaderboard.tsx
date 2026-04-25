import { Link } from 'react-router-dom';
import type { EngineerStats } from '../types';
import { formatMergeTime } from '../utils/scoring';
import { cn } from '../utils/cn';
import { useTrend } from '../hooks/useAnalytics';

interface LeaderboardProps {
  engineers: EngineerStats[];
}

// Separate component so each row can call useTrend (hooks must be at top level)
function LeaderboardRow({ eng, maxScore }: { eng: EngineerStats; maxScore: number }) {
  const trend = useTrend(eng.user.login);
  const barWidth = (eng.score / maxScore) * 100;
  const rankLabel = ['🥇', '🥈', '🥉'][eng.rank - 1] ?? `#${eng.rank}`;

  // Rank change badge: negative rankDelta = improved (went from #5 to #3)
  const rankChange = trend.hasPrev && trend.rankDelta !== 0
    ? trend.rankDelta < 0
      ? { label: `▲${Math.abs(trend.rankDelta)}`, color: 'text-emerald-400' }
      : { label: `▼${trend.rankDelta}`, color: 'text-red-400' }
    : null;

  return (
    <tr className="hover:bg-slate-700/30 transition-colors group">
      <td className="px-4 py-3 text-center">
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-slate-400">{rankLabel}</span>
          {rankChange && (
            <span className={cn('text-xs font-semibold leading-none mt-0.5', rankChange.color)}>
              {rankChange.label}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <Link to={`/engineers/${eng.user.login}`} className="flex items-center gap-2.5 group-hover:text-sky-400 transition-colors">
          <img
            src={eng.user.avatar_url}
            alt={eng.user.login}
            className="w-7 h-7 rounded-full border border-slate-600"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(eng.user.login)}&background=0ea5e9&color=fff&size=28`;
            }}
          />
          <div>
            <p className="font-medium text-slate-200 text-sm leading-tight">{eng.user.full_name || eng.user.login}</p>
            <p className="text-xs text-slate-500">@{eng.user.login}</p>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-sky-400 font-bold text-sm whitespace-nowrap">{Math.round(eng.score)}</span>
              {trend.hasPrev && (
                <span className="text-xs font-bold" style={{ color: trend.color }}>{trend.arrow}</span>
              )}
            </div>
            {trend.hasPrev && trend.scoreDelta !== 0 && (
              <span className="text-xs" style={{ color: trend.color }}>
                {trend.scoreDelta > 0 ? '+' : ''}{Math.round(trend.scoreDelta)}
              </span>
            )}
          </div>
          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500" style={{ width: `${barWidth}%` }} />
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-300 font-medium">{eng.totalCommits}</td>
      <td className="px-4 py-3 text-slate-300">{eng.totalPRs}</td>
      <td className="px-4 py-3">
        <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', eng.mergedPRs > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500')}>
          {eng.mergedPRs}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-300">{eng.reviewsGiven}</td>
      <td className="px-4 py-3">
        <span className="text-orange-400 font-medium">{eng.activeDays}</span>
        <span className="text-slate-500 text-xs ml-1">days</span>
      </td>
      <td className="px-4 py-3 text-slate-400 text-xs">
        {eng.avgPRMergeTimeHours > 0 ? formatMergeTime(eng.avgPRMergeTimeHours) : '—'}
      </td>
      <td className="px-4 py-3">
        <span className={cn('text-xs font-medium', eng.commitStreak > 0 ? 'text-yellow-400' : 'text-slate-600')}>
          🔥 {eng.commitStreak}d
        </span>
      </td>
    </tr>
  );
}

export function Leaderboard({ engineers }: LeaderboardProps) {
  const maxScore = engineers[0]?.score ?? 1;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300">Productivity Leaderboard</h3>
        <p className="text-xs text-slate-500 mt-0.5">Ranked by composite score · ▲▼ = rank change vs last week</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {['Rank', 'Engineer', 'Score', 'Commits', 'PRs', 'Merged', 'Reviews', 'Active Days', 'Avg Merge Time', 'Streak'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {engineers.map((eng) => (
              <LeaderboardRow key={eng.user.login} eng={eng} maxScore={maxScore} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
