"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { MFAVerifyScreen } from "@/components/mfa/MFAVerifyScreen";

export default function MFAVerifyPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 selection:bg-blue-100 selection:text-blue-900 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] rounded-full bg-blue-100/40 blur-3xl mix-blend-multiply" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[800px] h-[800px] rounded-full bg-sky-100/40 blur-3xl mix-blend-multiply" />
      </div>

      {/* Header */}
      <div className="p-6 relative z-10 max-w-7xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2 w-fit group">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <HeartPulse className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-bold text-gray-900 tracking-tight">Mediclinic</span>
        </Link>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10 w-full">
        <Suspense fallback={
          <div className="w-full max-w-[440px] h-[480px] bg-white rounded-3xl animate-pulse shadow-xl" />
        }>
          <MFAVerifyScreen />
        </Suspense>
      </div>

      {/* Footer */}
      <footer className="p-6 text-center text-xs text-gray-400 relative z-10">
        MediClinic Security & Auth Subsystem • Two-Factor Verification
      </footer>
    </div>
  );
}
