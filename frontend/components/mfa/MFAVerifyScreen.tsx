"use client";

import React, { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthContext } from "@/context/AuthContext";
import { verifyMFA, getCurrentUser } from "@/services/auth";
import {
  ShieldCheck,
  KeyRound,
  AlertCircle,
  RotateCw,
  ArrowRight,
  LifeBuoy,
  Lock,
} from "lucide-react";

export function MFAVerifyScreen() {
  const router = useRouter();
  const { setUser } = useContext(AuthContext);

  const [pendingToken, setPendingToken] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let token = "";
    if (typeof window !== "undefined") {
      token = sessionStorage.getItem("pending_mfa_token") || localStorage.getItem("pending_mfa_token") || "";
    }
    setPendingToken(token);

    if (!token) {
      setError("No active pending login session. Please log in with your email and password first.");
    }
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Please enter the 6-digit code from your authenticator app.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await verifyMFA(code, pendingToken);
      if (res.success || res.access) {
        sessionStorage.removeItem("pending_mfa_token");
        const userRes = await getCurrentUser();
        setUser(userRes.data || userRes);
        router.push("/dashboard");
      } else {
        setError(res.error || "Invalid verification code.");
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          "Invalid verification code. Please check your app and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[440px] mx-auto">
      <Card className="p-8 sm:p-10 shadow-2xl shadow-gray-200/50 border border-border/80 relative">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-50 text-primary border border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold rounded-full mb-3">
            <Lock className="w-3.5 h-3.5" />
            Two-Factor Authentication Required
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-2">
            Enter Authenticator Code
          </h1>
          <p className="text-sm text-muted">
            Open your authenticator app (Google Authenticator, Authy, etc.) and enter the 6-digit code.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              6-Digit Authenticator Code
            </label>
            <Input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              icon={<KeyRound className="w-5 h-5" />}
              placeholder="123456"
              className="tracking-widest text-xl font-mono text-center"
              autoFocus
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading || code.length < 6 || !pendingToken}
            className="w-full flex items-center justify-center gap-2"
            size="lg"
          >
            {loading ? (
              <>
                <RotateCw className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                Verify & Sign In
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>
        </form>

        {/* Link to Backup Code Recovery */}
        <div className="mt-8 pt-6 border-t border-border text-center space-y-3">
          <Link
            href="/mfa/recover"
            className="text-xs text-primary font-semibold hover:underline flex items-center justify-center gap-1.5 mx-auto"
          >
            <LifeBuoy className="w-4 h-4" />
            Use a backup code instead
          </Link>
          <div>
            <Link
              href="/login"
              className="text-xs text-muted hover:text-ink font-medium underline"
            >
              Back to Password Login
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
