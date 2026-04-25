import type { CSSProperties } from 'react';
import { cn } from '../utils/cn';

/** Base shimmer block */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-slate-700/60',
        className,
      )}
      style={style}
    />
  );
}

/** KPI stat card skeleton */
export function StatCardSkeleton() {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-2.5 w-24" />
        </div>
        <Skeleton className="w-9 h-9 rounded-lg" />
      </div>
    </div>
  );
}

/** Engineer card skeleton */
export function EngineerCardSkeleton() {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-11 h-11 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="space-y-1 items-end">
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-2.5 w-8" />
        </div>
      </div>
      <Skeleton className="h-8 w-full mb-4 rounded" />
      <div className="grid grid-cols-2 gap-2">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
      <div className="mt-4 space-y-1">
        <div className="flex justify-between">
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-10" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
    </div>
  );
}

/** Leaderboard row skeleton */
export function LeaderboardSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56 mt-1.5" />
      </div>
      <div className="divide-y divide-slate-700/50">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-4">
            <Skeleton className="w-6 h-6 rounded" />
            <div className="flex items-center gap-2.5">
              <Skeleton className="w-7 h-7 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
            {[...Array(7)].map((_, j) => (
              <Skeleton key={j} className="h-3 w-12 hidden sm:block" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Chart skeleton */
export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <Skeleton className="h-4 w-40 mb-4" />
      <div className="flex items-end gap-1" style={{ height }}>
        {[35,60,45,80,55,70,40,90,65,50,75,30,85,60,45,70,55,40,80,65,50,75,35,60].map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-sm"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Full-page skeleton for Suspense fallback */
export function PageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3.5 w-72" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <ChartSkeleton height={220} />
      <LeaderboardSkeleton rows={5} />
    </div>
  );
}

/** Inline spinner for async sub-sections */
export function Spinner({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn('border-2 border-sky-500 border-t-transparent rounded-full animate-spin', className)}
      style={{ width: size, height: size }}
    />
  );
}
