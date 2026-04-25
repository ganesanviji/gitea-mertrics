import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { DailyActivity } from '../types';

interface ActivityChartProps {
  data: DailyActivity[];
  type?: 'area' | 'bar' | 'line';
  title: string;
  height?: number;
}

const TOOLTIP_STYLE = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '12px',
};

function formatDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), 'MMM d');
  } catch {
    return dateStr;
  }
}

// Aggregate weekly if data is > 60 days
function aggregateData(data: DailyActivity[], maxDays = 60) {
  if (data.length <= maxDays) return data;
  // Group into weeks
  const weeks: DailyActivity[] = [];
  for (let i = 0; i < data.length; i += 7) {
    const slice = data.slice(i, i + 7);
    weeks.push({
      date: slice[0].date,
      commits: slice.reduce((s, d) => s + d.commits, 0),
      additions: slice.reduce((s, d) => s + d.additions, 0),
      deletions: slice.reduce((s, d) => s + d.deletions, 0),
      prs: slice.reduce((s, d) => s + d.prs, 0),
    });
  }
  return weeks;
}

export function ActivityChart({ data, type = 'area', title, height = 220 }: ActivityChartProps) {
  const chartData = aggregateData(data).map((d) => ({
    ...d,
    date: formatDate(d.date),
  }));

  const commonProps = {
    data: chartData,
    margin: { top: 5, right: 10, left: -20, bottom: 0 },
  };

  const xAxis = <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />;
  const yAxis = <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />;
  const grid = <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />;
  const tooltip = <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        {type === 'bar' ? (
          <BarChart {...commonProps}>
            {grid}{xAxis}{yAxis}{tooltip}
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Bar dataKey="commits" fill="#0ea5e9" radius={[2, 2, 0, 0]} name="Commits" />
            <Bar dataKey="prs" fill="#8b5cf6" radius={[2, 2, 0, 0]} name="PRs" />
          </BarChart>
        ) : type === 'line' ? (
          <LineChart {...commonProps}>
            {grid}{xAxis}{yAxis}{tooltip}
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="commits" stroke="#0ea5e9" strokeWidth={2} dot={false} name="Commits" />
            <Line type="monotone" dataKey="additions" stroke="#22c55e" strokeWidth={2} dot={false} name="Additions" />
            <Line type="monotone" dataKey="deletions" stroke="#ef4444" strokeWidth={2} dot={false} name="Deletions" />
          </LineChart>
        ) : (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="colorCommits" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPRs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            {grid}{xAxis}{yAxis}{tooltip}
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Area type="monotone" dataKey="commits" stroke="#0ea5e9" strokeWidth={2} fill="url(#colorCommits)" name="Commits" />
            <Area type="monotone" dataKey="prs" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorPRs)" name="PRs" />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// Separate chart for additions vs deletions (code churn)
export function ChurnChart({ data, height = 200 }: { data: DailyActivity[]; height?: number }) {
  const chartData = aggregateData(data).map((d) => ({
    date: formatDate(d.date),
    additions: d.additions,
    deletions: -d.deletions,
  }));

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Code Churn (Additions vs Deletions)</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val) => [typeof val === 'number' ? Math.abs(val) : String(val ?? ''), '']} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          <Bar dataKey="additions" fill="#22c55e" radius={[2, 2, 0, 0]} name="Additions" stackId="stack" />
          <Bar dataKey="deletions" fill="#ef4444" radius={[0, 0, 2, 2]} name="Deletions" stackId="stack" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
