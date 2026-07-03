"use client";

import { Check } from "lucide-react";
import { useBooking } from "../layout";

export default function StepIndicator() {
  const { state, goToStep } = useBooking();

  const steps = [
    { num: 1, label: "Start" },
    { num: 2, label: "Clinic" },
    { num: 3, label: "Doctor" },
    { num: 4, label: "Date" },
    { num: 5, label: "Payment" },
  ];

  // We don't show the indicator on step 1
  if (state.step === 1) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 z-0 rounded-full" />
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-violet-600 z-0 rounded-full transition-all duration-300"
          style={{ width: `${((state.step - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((s, i) => {
          const isCompleted = state.step > s.num;
          const isCurrent = state.step === s.num;
          const isUpcoming = state.step < s.num;

          return (
            <div key={s.num} className="relative z-10 flex flex-col items-center">
              <button
                disabled={isUpcoming}
                onClick={() => goToStep(s.num)}
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-200 ${
                  isCompleted
                    ? "bg-violet-600 text-white cursor-pointer hover:bg-violet-700 hover:scale-110"
                    : isCurrent
                    ? "bg-white border-2 border-violet-600 text-violet-700 shadow-md ring-4 ring-violet-50"
                    : "bg-white border-2 border-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : s.num}
              </button>
              <span 
                className={`absolute -bottom-6 text-xs font-medium ${
                  isCurrent ? "text-violet-700 font-bold" : isCompleted ? "text-gray-700" : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
