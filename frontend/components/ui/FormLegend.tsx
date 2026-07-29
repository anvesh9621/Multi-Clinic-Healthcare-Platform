import React from 'react';

export function FormLegend({ text = "Fields marked * are required", className }: { text?: string; className?: string }) {
  return (
    <p className={`text-xs text-gray-500 font-medium ${className || 'mb-4'}`}>
      Fields marked <span className="text-red-500 font-bold">*</span> are required
    </p>
  );
}
