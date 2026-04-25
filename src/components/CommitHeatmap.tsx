import { format, parseISO, eachWeekOfInterval, eachDayOfInterval, addDays } from 'date-fns';
import type { DailyActivity } from '../types';

interface CommitHeatmapProps {
  data: DailyActivity[];
  title?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getColor(count: number, max: number): string {
  if (count === 0) return '#1e293b';
  const intensity = count / max;
  if (intensity < 0.25) return '#0c4a6e';
  if (intensity < 0.5) return '#0369a1';
  if (intensity < 0.75) return '#0284c7';
  return '#0ea5e9';
}

export function CommitHeatmap({ data, title = 'Commit Activity' }: CommitHeatmapProps) {
  if (!data.length) return null;

  const activityMap = new Map(data.map((d) => [d.date, d.commits]));
  const max = Math.max(...data.map((d) => d.commits), 1);

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const start = parseISO(sorted[0].date);
  const end = parseISO(sorted[sorted.length - 1].date);

  const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 0 });

  // Month labels
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((weekStart, col) => {
    const month = weekStart.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({ label: MONTHS[month], col });
      lastMonth = month;
    }
  });

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Month labels */}
          <div className="flex mb-1 ml-8">
            {weeks.map((_, i) => {
              const monthLabel = monthLabels.find((m) => m.col === i);
              return (
                <div key={i} className="w-3.5 mr-0.5 text-xs text-slate-500 text-center leading-none">
                  {monthLabel ? monthLabel.label : ''}
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div className="flex gap-0.5">
            {/* Day labels */}
            <div className="flex flex-col gap-0.5 mr-1.5">
              {DAYS.map((d, i) => (
                <div key={i} className="h-3.5 flex items-center text-xs text-slate-500 pr-1" style={{ opacity: i % 2 === 1 ? 1 : 0 }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Cells */}
            {weeks.map((weekStart, wi) => {
              const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
              return (
                <div key={wi} className="flex flex-col gap-0.5">
                  {days.map((day, di) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const count = activityMap.get(dateStr) ?? 0;
                    return (
                      <div
                        key={di}
                        className="w-3.5 h-3.5 rounded-sm cursor-pointer transition-opacity hover:opacity-80 group relative"
                        style={{ backgroundColor: getColor(count, max) }}
                        title={`${dateStr}: ${count} commit${count !== 1 ? 's' : ''}`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-3 justify-end">
            <span className="text-xs text-slate-500">Less</span>
            {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
              <div
                key={intensity}
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: getColor(intensity === 0 ? 0 : Math.ceil(intensity * max), max) }}
              />
            ))}
            <span className="text-xs text-slate-500">More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
