"use client";

import React, { useState, useContext } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthContext } from "@/context/AuthContext";
import { recoverMFA, requestMFAReset, getCurrentUser } from "@/services/auth";
import {
  LifeBuoy,
  KeyRound,
  Mail,
  AlertTriangle,
  RotateCw,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export function MFARecoverScreen() {
  const router = useRouter();
  const { setUser } = useContext(AuthContext);

  const [email, setEmail] = useState<string>("");
  const [backupCode, setBackupCode] = useState<string>("");

  // Low backup code state after successful recovery
  const [showLowBanner, setShowLowBanner] = useState<boolean>(false);
  const [remainingCount, setRemainingCount] = useState<number>(0);

  // Reset request state
  const [resetRequested, setResetRequested] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [infoMessage, setInfoMessage] = useState<string>("");

  // Recover login via single-use backup code
  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !backupCode.trim()) {
      setError("Please enter both your registered email and a single-use backup code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await recoverMFA(email, backupCode);
      if (res.success || res.access) {
        sessionStorage.removeItem("pending_mfa_token");
        const userRes = await getCurrentUser();
        setUser(userRes.data || userRes);

        // Check if remaining backup codes are low (<= 2)
        if (res.prompt_regeneration) {
          setRemainingCount(res.remaining_backup_codes || 0);
          setShowLowBanner(true);
        } else {
          router.push("/dashboard");
        }
      } else {
        setError(res.error || "Invalid backup code.");
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          "Invalid or already used backup code. Please check your code and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Request admin assistance for reset
  const handleRequestReset = async () => {
    if (!email.trim()) {
      setError("Please enter your registered email address first.");
      return;
    }

    setLoading(true);
    setError("");
    setInfoMessage("");

    try {
      const res = await requestMFAReset(email);
      setResetRequested(true);
      setInfoMessage(
        res.message ||
          "Your administrator has been notified to assist with resetting your MFA credentials."
      );
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to submit MFA reset request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[460px] mx-auto">
      <Card className="p-8 sm:p-10 shadow-2xl shadow-gray-200/50 border border-border/80 relative">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-amber-50 text-amber-700 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <LifeBuoy className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-2">
            MFA Account Recovery
          </h1>
          <p className="text-sm text-muted">
            Lost access to your authenticator app? Enter one of your single-use backup codes to sign in.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Info Message Alert */}
        {infoMessage && !error && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* State 1: Low Backup Codes Warning Banner (post recovery login) */}
        {showLowBanner ? (
          <div className="space-y-6">
            <div className="p-5 bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
                <h3 className="font-bold text-base text-amber-900">
                  Low Backup Codes Warning
                </h3>
              </div>
              <p className="text-sm text-amber-800 leading-relaxed mb-3">
                You have only <span className="font-bold text-amber-950 underline">{remainingCount} backup code(s)</span> remaining! Each code can only be used once. Please generate a new set of backup codes in account settings soon to avoid being locked out.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="w-full flex items-center justify-center gap-2"
              size="lg"
            >
              I Understand, Proceed to Dashboard
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          /* State 2: Backup Code Form */
          <form onSubmit={handleRecover} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                icon={<Mail className="w-5 h-5" />}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Single-Use Backup Code
              </label>
              <Input
                type="text"
                value={backupCode}
                onChange={(e) => {
                  setBackupCode(e.target.value.toUpperCase());
                  setError("");
                }}
                icon={<KeyRound className="w-5 h-5" />}
                placeholder="XXXX-XXXX"
                className="font-mono text-center text-lg tracking-widest uppercase"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !email || !backupCode}
              className="w-full flex items-center justify-center gap-2"
              size="lg"
            >
              {loading ? (
                <>
                  <RotateCw className="w-5 h-5 animate-spin" />
                  Recovering Account...
                </>
              ) : (
                <>
                  Recover Account & Sign In
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>

            {/* Lost Everything Option */}
            <div className="mt-8 pt-6 border-t border-border text-center space-y-3">
              {!resetRequested ? (
                <button
                  type="button"
                  onClick={handleRequestReset}
                  disabled={loading}
                  className="text-xs text-amber-700 font-semibold hover:underline flex items-center justify-center gap-1.5 mx-auto"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Lost everything? Request administrator assistance
                </button>
              ) : (
                <p className="text-xs text-emerald-700 font-medium">
                  ✓ Reset request submitted to your administrator.
                </p>
              )}

              <div>
                <Link
                  href="/mfa/verify"
                  className="text-xs text-primary font-medium hover:underline"
                >
                  Back to Authenticator App Code Input
                </Link>
              </div>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
