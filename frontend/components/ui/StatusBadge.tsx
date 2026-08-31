import React from "react";

export type DomainStatus = 
  | "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
  | "ACTIVE" | "PENDING" | "ACCEPTED" | "EXPIRED" | "INACTIVE"
  | "PAID" | "TRIALING" | "PAST_DUE" | "SUSPENDED" | "FAILED"
  | "LOW_STOCK" | "OUT_OF_STOCK" | "AVAILABLE"
  | string;

interface StatusBadgeProps {
  status: DomainStatus;
  label?: string;
  pulse?: boolean; // show animated dot for live/pending statuses
  className?: string;
}

const CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  // Appointment Statuses
  SCHEDULED: {
    label: "Scheduled",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  CONFIRMED: {
    label: "Confirmed",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  COMPLETED: {
    label: "Completed",
    bg: "bg-warm-surface",
    text: "text-muted",
    border: "border-border",
    dot: "bg-muted",
  },
  CANCELLED: {
    label: "Cancelled",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  NO_SHOW: {
    label: "No Show",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
  },

  // General & Invitation Statuses
  ACTIVE: {
    label: "Active",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  ACCEPTED: {
    label: "Accepted",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  PENDING: {
    label: "Pending",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  EXPIRED: {
    label: "Expired",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  INACTIVE: {
    label: "Inactive",
    bg: "bg-warm-surface",
    text: "text-muted",
    border: "border-border",
    dot: "bg-muted",
  },

  // Subscription / Billing Statuses
  PAID: {
    label: "Paid",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  TRIALING: {
    label: "Trialing",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  PAST_DUE: {
    label: "Past Due",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  DUNNING: {
    label: "Dunning",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  SUSPENDED: {
    label: "Suspended",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
  },

  // Inventory Statuses
  AVAILABLE: {
    label: "In Stock",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  LOW_STOCK: {
    label: "Low Stock",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  OUT_OF_STOCK: {
    label: "Out of Stock",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
  },
};

export function StatusBadge({ status, label, pulse = false, className = "" }: StatusBadgeProps) {
  const normalizedKey = (status || "").toString().toUpperCase();
  const cfg = CONFIG[normalizedKey] ?? {
    label: label || status,
    bg: "bg-warm-surface",
    text: "text-muted",
    border: "border-border",
    dot: "bg-muted",
  };

  const displayLabel = label || cfg.label;
  const shouldPulse = pulse && (normalizedKey === "SCHEDULED" || normalizedKey === "PENDING" || normalizedKey === "CONFIRMED");

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border} ${className}`}>
      <span className="relative flex-shrink-0 w-1.5 h-1.5">
        <span className={`block w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {shouldPulse && (
          <span
            className={`absolute inset-0 w-1.5 h-1.5 rounded-full ${cfg.dot} animate-ping opacity-75`}
          />
        )}
      </span>
      {displayLabel}
    </span>
  );
}
