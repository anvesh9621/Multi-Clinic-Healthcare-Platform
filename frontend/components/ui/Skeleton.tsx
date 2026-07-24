import React from "react";

// ── Skeleton primitives ──────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/** A single shimmer block. Pass className for sizing. */
export function Skeleton({ className = "", style }: SkeletonProps) {
  return <div className={`animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded-md ${className}`} style={style} />;
}

// ── Composed Skeleton patterns ───────────────────────────────────────────

/** A standard card skeleton (icon + two text lines) */
export function SkeletonCard() {
  return (
    <div className="bg-paper rounded-2xl border border-border p-5 shadow-sm">
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
    <div className="bg-paper rounded-2xl border border-border p-6 shadow-sm">
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
        <td key={i} className="px-4 py-4 border-b border-border">
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

/** Localized page content loader */
export function PageLoader({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="w-full py-24 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 p-8 rounded-3xl animate-fade-in-up">
        <div className="relative w-16 h-16 flex items-center justify-center">
          {/* Track ring */}
          <div className="absolute inset-0 rounded-full border-4 border-border" />
          {/* Spinning accent arc */}
          <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-accent border-b-transparent border-l-transparent animate-spin" />
          {/* Center pip */}
          <div className="w-6 h-6 bg-primary rounded-md shadow-sm" />
        </div>
        <p className="text-sm text-muted font-semibold tracking-wide uppercase heading-font">{message}</p>
      </div>
    </div>
  );
}
