import React from "react";

type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

interface StatusBadgeProps {
  status: AppointmentStatus | string;
  pulse?: boolean; // show animated dot for live statuses
}

const CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  SCHEDULED: {
    label: "Scheduled",
    bg:   "bg-blue-50",
    text: "text-blue-700",
    dot:  "bg-blue-500",
  },
  CONFIRMED: {
    label: "Confirmed",
    bg:   "bg-emerald-50",
    text: "text-emerald-700",
    dot:  "bg-emerald-500",
  },
  COMPLETED: {
    label: "Completed",
    bg:   "bg-slate-100",
    text: "text-slate-600",
    dot:  "bg-slate-400",
  },
  CANCELLED: {
    label: "Cancelled",
    bg:   "bg-red-50",
    text: "text-red-600",
    dot:  "bg-red-500",
  },
  NO_SHOW: {
    label: "No Show",
    bg:   "bg-amber-50",
    text: "text-amber-700",
    dot:  "bg-amber-500",
  },
};

export function StatusBadge({ status, pulse = false }: StatusBadgeProps) {
  const cfg = CONFIG[status] ?? {
    label: status,
    bg: "bg-gray-100",
    text: "text-gray-600",
    dot: "bg-gray-400",
  };

  const shouldPulse = pulse && (status === "SCHEDULED" || status === "CONFIRMED");

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className="relative flex-shrink-0 w-1.5 h-1.5">
        <span className={`block w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {shouldPulse && (
          <span
            className={`absolute inset-0 w-1.5 h-1.5 rounded-full ${cfg.dot} animate-ping opacity-75`}
          />
        )}
      </span>
      {cfg.label}
    </span>
  );
}
