import React from 'react';
import { cn } from './Button';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
}

export function Textarea({ className, label, required, helperText, ...props }: TextareaProps) {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-sm font-semibold text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea
        required={required}
        className={cn(
          "flex w-full rounded-lg border border-border bg-paper px-4 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-sm resize-none disabled:bg-gray-100 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
      {helperText && <p className="text-xs text-muted mt-1">{helperText}</p>}
    </div>
  );
}
