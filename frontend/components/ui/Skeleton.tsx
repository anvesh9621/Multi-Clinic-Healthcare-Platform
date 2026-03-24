import React from "react";

// ── Skeleton primitives ──────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/** A single shimmer block. Pass className for sizing. */
export function Skeleton({ className = "", style }: SkeletonProps) {
  return <div className={`skeleton ${className}`} style={style} />;
}

// ── Composed Skeleton patterns ───────────────────────────────────────────

/** A standard card skeleton (icon + two text lines) */
export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 p-5 shadow-soft glass">
      <div className="flex items-start gap-4">
        <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

/** A stat card skeleton */
export function SkeletonStat() {
  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 p-6 shadow-soft glass">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

/** A table row skeleton */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-4 border-b border-slate-100 dark:border-slate-700/50">
          <Skeleton className="h-4" style={{ width: `${60 + Math.random() * 30}%` }} />
        </td>
      ))}
    </tr>
  );
}

/** A grid of skeleton cards */
export function SkeletonGrid({ count = 4, cols = 2 }: { count?: number; cols?: number }) {
  return (
    <div className={`grid gap-4 grid-cols-1 sm:grid-cols-${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Full-page loading overlay */
export function PageLoader({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center fixed inset-0 z-50">
      <div className="flex flex-col items-center gap-6 glass p-10 rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700/50 animate-fade-in-up">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-slate-700" />
          <div className="absolute inset-0 rounded-full border-4 border-t-cyan-400 border-r-indigo-500 border-b-transparent border-l-transparent animate-spin blur-[1px]" />
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-lg shadow-lg flex items-center justify-center rotate-45 animate-pulse">
            <div className="w-3 h-3 bg-white rounded-sm -rotate-45" />
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold tracking-wide uppercase heading-font">{message}</p>
      </div>
    </div>
  );
}
