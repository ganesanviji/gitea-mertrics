import type { LucideIcon } from 'lucide-react';
import { cn } from '../utils/cn';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-sky-400',
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col gap-3',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className={cn('p-2 rounded-lg bg-slate-700/60', iconColor.replace('text-', 'bg-').replace('-4', '-500/10'))}>
          <Icon size={20} className={iconColor} />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-xs font-medium',
              trend.value > 0 ? 'text-emerald-400' : trend.value < 0 ? 'text-red-400' : 'text-slate-400',
            )}
          >
            {trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '→'}{' '}
            {Math.abs(trend.value).toFixed(1)}%
          </span>
          <span className="text-xs text-slate-500">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
