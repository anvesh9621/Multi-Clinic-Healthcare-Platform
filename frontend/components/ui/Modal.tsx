"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "./Button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        ref={overlayRef}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div 
        className={cn(
          "relative bg-paper rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up",
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-lg font-bold text-ink heading-font">{title}</h2>
            <button 
              onClick={onClose}
              className="p-1 rounded-md text-muted hover:text-ink hover:bg-warm-surface transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {!title && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1 z-10 rounded-md text-muted hover:text-ink hover:bg-warm-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
