import React from 'react';
import { cn } from './Button';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hoverable?: boolean;
}

export function Card({ className, children, hoverable = false, ...props }: CardProps) {
  return (
    <div 
      className={cn(
        "bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300",
        hoverable && "hover:-translate-y-1 hover:shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
