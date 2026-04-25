import { useState } from 'react';
import { useTeamActivity } from '../hooks/useAnalytics';
import { ActivityChart, ChurnChart } from '../components/ActivityChart';
import type { DailyActivity } from '../types';
import { ChartSkeleton } from '../components/Skeleton';

export function Activity() {
  const { data, teamActivity, isLoading, error } = useTeamActivity();
  const [selectedUser, setSelectedUser] = useState<string>('__team__');

  if (isLoading) {
    return (
      <div className="p-6 space-y-5">
        <div className="space-y-1"><div className="h-6 w-28 bg-slate-700 rounded animate-pulse" /></div>
        <ChartSkeleton height={280} />
        <ChartSkeleton height={240} />
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-6 text-slate-400">{error?.message ?? 'No data. Configure Settings first.'}</div>;
  }

  const displayActivity: DailyActivity[] =
    selectedUser === '__team__'
      ? teamActivity
      : (data.engineers.find((e) => e.user.login === selectedUser)?.dailyActivity ?? teamActivity);

  const label = selectedUser === '__team__' ? 'Team' : `@${selectedUser}`;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Activity</h1>
          <p className="text-sm text-slate-500 mt-0.5">Commit and PR activity over time</p>
        </div>
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
        >
          <option value="__team__">Entire Team</option>
          {data.engineers.map((e) => (
            <option key={e.user.login} value={e.user.login}>
              @{e.user.login}
            </option>
          ))}
        </select>
      </div>

      <ActivityChart data={displayActivity} type="area" title={`${label} — Commit & PR Activity`} height={280} />
      <ActivityChart data={displayActivity} type="bar" title={`${label} — Daily Breakdown`} height={240} />
      <ChurnChart data={displayActivity} height={220} />
    </div>
  );
}
