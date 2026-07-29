import React from 'react';
import { cn } from './Button';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function Select({ className, label, required, helperText, icon, children, ...props }: SelectProps) {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-sm font-semibold text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative w-full text-muted focus-within:text-primary transition-colors duration-200">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            {icon}
          </div>
        )}
        <select
          required={required}
          className={cn(
            "flex w-full rounded-lg border border-border bg-paper px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed",
            icon && "pl-11",
            className
          )}
          {...props}
        >
          {children}
        </select>
      </div>
      {helperText && <p className="text-xs text-muted mt-1">{helperText}</p>}
    </div>
  );
}
