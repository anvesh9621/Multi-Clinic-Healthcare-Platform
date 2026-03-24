import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-16"} animate-fade-in`}>
      <div className={`${compact ? "w-12 h-12" : "w-16 h-16"} bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4`}>
        <Icon className={`${compact ? "w-6 h-6" : "w-8 h-8"} text-slate-400`} />
      </div>
      <p className={`font-semibold text-slate-700 mb-1 ${compact ? "text-sm" : "text-base"}`}>{title}</p>
      {description && (
        <p className={`text-slate-400 mb-5 max-w-xs ${compact ? "text-xs" : "text-sm"}`}>{description}</p>
      )}
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
