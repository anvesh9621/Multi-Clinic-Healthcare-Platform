"use client";

import React, { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthContext } from "@/context/AuthContext";
import { setupMFA, confirmMFA, getCurrentUser } from "@/services/auth";
import {
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  Download,
  AlertTriangle,
  RotateCw,
  CheckCircle2,
  Lock,
  ArrowRight,
} from "lucide-react";

export function MFASetupScreen() {
  const router = useRouter();
  const { setUser } = useContext(AuthContext);

  // Setup Step: 1 (Scan & Confirm) | 2 (Backup Codes Display)
  const [step, setStep] = useState<1 | 2>(1);

  // Credentials & Tokens
  const [pendingToken, setPendingToken] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [provisioningUri, setProvisioningUri] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [tokensData, setTokensData] = useState<{ access?: string; refresh?: string; role?: string }>({});

  // UI States
  const [loading, setLoading] = useState<boolean>(true);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [secretCopied, setSecretCopied] = useState<boolean>(false);
  const [codesCopied, setCodesCopied] = useState<boolean>(false);
  const [hasSavedCodes, setHasSavedCodes] = useState<boolean>(false);

  // Initial load: fetch secret + provisioning URI
  useEffect(() => {
    let token = "";
    if (typeof window !== "undefined") {
      token = sessionStorage.getItem("pending_mfa_token") || localStorage.getItem("pending_mfa_token") || "";
    }
    setPendingToken(token);

    const initSetup = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await setupMFA(token);
        if (res.success && res.secret && res.provisioning_uri) {
          setSecret(res.secret);
          setProvisioningUri(res.provisioning_uri);
        } else {
          setError(res.error || "Failed to initialize MFA setup.");
        }
      } catch (err: any) {
        setError(
          err?.response?.data?.error ||
            "Unable to start MFA setup. Please log in again to restart setup."
        );
      } finally {
        setLoading(false);
      }
    };

    initSetup();
  }, []);

  // Copy raw secret to clipboard
  const handleCopySecret = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2500);
  };

  // Copy all backup codes to clipboard
  const handleCopyBackupCodes = () => {
    if (backupCodes.length === 0) return;
    const formatted = `MEDICLINIC MFA BACKUP CODES\nGenerated: ${new Date().toLocaleString()}\n\n${backupCodes.join("\n")}\n\nKeep these single-use codes secure!`;
    navigator.clipboard.writeText(formatted);
    setCodesCopied(true);
    setTimeout(() => setCodesCopied(false), 2500);
  };

  // Download backup codes as .txt file
  const handleDownloadBackupCodes = () => {
    if (backupCodes.length === 0) return;
    const content = `MEDICLINIC MFA BACKUP CODES\nGenerated: ${new Date().toLocaleString()}\n\n${backupCodes.join("\n")}\n\nKeep these single-use codes secure!`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mediclinic-mfa-backup-codes.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Confirm TOTP code
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Please enter the 6-digit code from your authenticator app.");
      return;
    }

    setConfirming(true);
    setError("");

    try {
      const res = await confirmMFA(code, pendingToken);
      if (res.success && res.backup_codes) {
        setBackupCodes(res.backup_codes);
        setTokensData({
          access: res.access,
          refresh: res.refresh,
          role: res.role,
        });
        setStep(2); // Advance to backup codes screen
      } else {
        setError(res.error || "Invalid verification code.");
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          "Invalid verification code. Please check your app and try again."
      );
    } finally {
      setConfirming(false);
    }
  };

  // Finalize setup & navigate to dashboard
  const handleCompleteSetup = async () => {
    if (!hasSavedCodes) return;
    if (tokensData.access && tokensData.refresh) {
      localStorage.setItem("access", tokensData.access);
      localStorage.setItem("refresh", tokensData.refresh);
      sessionStorage.removeItem("pending_mfa_token");
    }

    try {
      const userRes = await getCurrentUser();
      setUser(userRes.data || userRes);
    } catch {
      // Continue even if profile fetch fails
    }

    router.push("/dashboard");
  };

  return (
    <div className="w-full max-w-[540px] mx-auto">
      <Card className="p-8 sm:p-10 shadow-2xl shadow-gray-200/50 border border-border/80 relative">
        {/* Unskippable Badge & Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-50 text-primary border border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-full mb-3">
            <Lock className="w-3.5 h-3.5" />
            Mandatory Security Setup
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-2">
            {step === 1 ? "Set Up Two-Factor Authentication" : "Save Your Backup Codes"}
          </h1>
          <p className="text-sm text-muted">
            {step === 1
              ? "Scan the QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.) to get started."
              : "Store these 10 single-use codes in a safe place. They will be displayed only this once."}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Spinner on Init */}
        {loading ? (
          <div className="py-16 text-center text-muted flex flex-col items-center justify-center gap-3">
            <RotateCw className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Generating your secure MFA credentials...</p>
          </div>
        ) : (
          <>
            {/* Step 1: QR Code & Code Confirmation */}
            {step === 1 && (
              <div className="space-y-6">
                {/* QR Code Container */}
                {provisioningUri && (
                  <div className="bg-warm-surface p-6 rounded-2xl border border-border flex flex-col items-center justify-center shadow-inner">
                    <div className="p-3 bg-white rounded-xl shadow-md border border-border">
                      <QRCodeSVG value={provisioningUri} size={180} level="H" includeMargin />
                    </div>
                    <p className="mt-3 text-xs text-muted font-medium">
                      Scan with Google Authenticator or any TOTP app
                    </p>
                  </div>
                )}

                {/* Raw Secret Fallback */}
                {secret && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                      Can&apos;t scan? Enter this secret manually:
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-50 border border-border rounded-xl px-4 py-3 text-sm font-mono text-ink tracking-wider break-all select-all font-semibold">
                        {secret}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={handleCopySecret}
                        className="shrink-0 flex items-center gap-1.5"
                      >
                        {secretCopied ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span className="text-emerald-600 font-semibold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* 6-Digit Confirmation Form */}
                <form onSubmit={handleConfirm} className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                      Enter 6-Digit Code from App to Confirm
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
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={confirming || code.length < 6}
                    className="w-full flex items-center justify-center gap-2"
                    size="lg"
                  >
                    {confirming ? (
                      <>
                        <RotateCw className="w-5 h-5 animate-spin" />
                        Verifying Code...
                      </>
                    ) : (
                      <>
                        Confirm & Enable MFA
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </Button>
                </form>
              </div>
            )}

            {/* Step 2: One-Time Backup Codes Display */}
            {step === 2 && (
              <div className="space-y-6">
                {/* One-Time Notice Alert */}
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-sm font-medium flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block uppercase text-xs tracking-wider text-amber-800 mb-1">
                      Shown Only This Once
                    </span>
                    These 10 backup codes can be used to log in if you lose access to your phone or authenticator app. Each code can be used only once.
                  </div>
                </div>

                {/* 10 Backup Codes Grid */}
                <div className="bg-gray-900 text-gray-100 p-5 rounded-2xl border border-gray-800 shadow-xl">
                  <div className="grid grid-cols-2 gap-2.5 font-mono text-sm tracking-wider text-center">
                    {backupCodes.map((bCode, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-800/80 border border-gray-700/60 rounded-xl py-2 px-3 text-emerald-400 font-semibold select-all"
                      >
                        {bCode}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons: Copy & Download */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCopyBackupCodes}
                    className="flex items-center justify-center gap-2"
                  >
                    {codesCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">Copied All</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Codes
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleDownloadBackupCodes}
                    className="flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download (.txt)
                  </Button>
                </div>

                {/* Mandatory Checkbox */}
                <label className="flex items-start gap-3 p-3.5 bg-gray-50 border border-border rounded-xl cursor-pointer hover:bg-gray-100/80 transition-colors">
                  <input
                    type="checkbox"
                    checked={hasSavedCodes}
                    onChange={(e) => setHasSavedCodes(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-accent mt-0.5"
                  />
                  <span className="text-xs text-ink font-semibold leading-relaxed">
                    I have saved these backup codes in a safe place and understand they will not be shown again.
                  </span>
                </label>

                {/* Submit / Proceed Button */}
                <Button
                  type="button"
                  disabled={!hasSavedCodes}
                  onClick={handleCompleteSetup}
                  className="w-full flex items-center justify-center gap-2"
                  size="lg"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Complete Setup & Proceed to Dashboard
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
