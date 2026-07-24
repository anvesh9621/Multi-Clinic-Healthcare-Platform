import React from 'react';
import { cn } from './Button';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export function Input({ className, icon, ...props }: InputProps) {
  return (
    <div className="relative w-full text-muted focus-within:text-primary transition-colors duration-200">
      {icon && (
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          {icon}
        </div>
      )}
      <input
        className={cn(
          "flex w-full rounded-lg border border-border bg-paper px-4 py-4 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-sm",
          icon && "pl-11",
          className
        )}
        {...props}
      />
    </div>
  );
}
