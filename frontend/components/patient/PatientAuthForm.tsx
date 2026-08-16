"use client";

import React, { useState, useEffect, useContext } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthContext } from "@/context/AuthContext";
import {
  login,
  getCurrentUser,
  requestPatientOTP,
  verifyPatientOTP,
  googleAuthPatient,
} from "@/services/auth";
import {
  Mail,
  KeyRound,
  User as UserIcon,
  Lock,
  ArrowRight,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";

interface PatientAuthFormProps {
  initialPurpose?: "LOGIN" | "REGISTER";
}

export function PatientAuthForm({ initialPurpose = "LOGIN" }: PatientAuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams?.get("redirect") || "/";
  const initialEmail = searchParams?.get("email") || "";
  const { setUser } = useContext(AuthContext);

  // Auth Mode: 'otp' | 'password'
  const [authMode, setAuthMode] = useState<"otp" | "password">("otp");

  // OTP Step: 1 (Details/Email entry) | 2 (Code entry)
  const [otpStep, setOtpStep] = useState<1 | 2>(1);
  const [purpose] = useState<"LOGIN" | "REGISTER">(initialPurpose);

  // Form Fields
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [cooldownTimer, setCooldownTimer] = useState(0);

  // Sync email from search params if query param changes
  useEffect(() => {
    const paramEmail = searchParams?.get("email");
    if (paramEmail) {
      setEmail(paramEmail);
    }
  }, [searchParams]);

  // Countdown timer effect
  useEffect(() => {
    if (cooldownTimer <= 0) return;
    const interval = setInterval(() => {
      setCooldownTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownTimer]);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // Google Sign-In SDK Initialization
  useEffect(() => {
    if (!googleClientId) {
      return;
    }

    const scriptId = "google-jssdk";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const handleGoogleCallback = async (response: { credential?: string }) => {
      if (!response.credential) return;
      setLoading(true);
      setError("");
      try {
        const res = await googleAuthPatient(response.credential);
        if (res.success || res.access) {
          const userRes = await getCurrentUser();
          setUser(userRes.data || userRes);
          router.push(redirectTarget);
        } else {
          setError(res.error || "Google authentication failed.");
        }
      } catch (err: any) {
        setError(
          err?.response?.data?.error ||
            "Google Sign-In is only available for patient accounts."
        );
      } finally {
        setLoading(false);
      }
    };

    const initializeGoogleBtn = () => {
      if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCallback,
          });

          const btnParent = document.getElementById("google-signin-container");
          if (btnParent) {
            btnParent.innerHTML = "";
            (window as any).google.accounts.id.renderButton(btnParent, {
              theme: "outline",
              size: "large",
              width: "100%",
              text: "continue_with",
              shape: "pill",
            });
          }
        } catch {
          // Ignore script init issues in test environments
        }
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleBtn;
      document.body.appendChild(script);
    } else {
      initializeGoogleBtn();
    }
  }, [setUser, router, redirectTarget, googleClientId]);

  // Request OTP (Step 1)
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (purpose === "REGISTER" && !firstName.trim()) {
      setError("Please enter your first name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");
    setInfoMessage("");

    try {
      const res = await requestPatientOTP(email.trim(), purpose);
      if (res.success) {
        setOtpStep(2);
        setCooldownTimer(60);
        setInfoMessage(`Verification code sent to ${email.trim()}`);
      } else {
        setError(res.error || "Failed to send verification code.");
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || "Failed to request verification code. Please try again.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP Code
  const handleResendOTP = async () => {
    if (cooldownTimer > 0) return;
    setLoading(true);
    setError("");
    setInfoMessage("");

    try {
      const res = await requestPatientOTP(email.trim(), purpose);
      if (res.success) {
        setCooldownTimer(60);
        setInfoMessage(`A fresh 6-digit code has been sent to ${email.trim()}`);
      } else {
        setError(res.error || "Failed to resend verification code.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to resend verification code.");
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP (Step 2)
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await verifyPatientOTP({
        email: email.trim(),
        code: code.trim(),
        purpose,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });

      if (res.success || res.access) {
        const userRes = await getCurrentUser();
        setUser(userRes.data || userRes);
        router.push(redirectTarget);
      } else {
        setError(res.error || "Invalid verification code.");
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || "Verification failed. Please try again.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Password Login Fallback
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please fill in email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await login(email.trim(), password);
      if (res.mfa_required) {
        if (res.mfa_setup_required) {
          router.push("/mfa/setup");
        } else {
          router.push("/mfa/verify");
        }
        return;
      }

      const userRes = await getCurrentUser();
      const user = userRes.data || userRes;
      setUser(user);
      router.push(user.role === "PATIENT" ? redirectTarget : "/dashboard");
    } catch (err: any) {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isNoAccountError =
    purpose === "LOGIN" &&
    (error.toLowerCase().includes("no account found") ||
      error.toLowerCase().includes("register first") ||
      error.toLowerCase().includes("not found"));

  const isAccountExistsError =
    purpose === "REGISTER" &&
    (error.toLowerCase().includes("already exists") ||
      error.toLowerCase().includes("log in instead"));

  return (
    <Card className="w-full max-w-[440px] p-8 sm:p-10 shadow-2xl shadow-gray-200/50 border border-border/80">
      {/* Header Title */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-2">
          {authMode === "password"
            ? "Patient Password Login"
            : otpStep === 1
            ? purpose === "REGISTER"
              ? "Create your account"
              : "Welcome back"
            : "Enter verification code"}
        </h1>
        <p className="text-sm text-muted">
          {authMode === "password"
            ? "Sign in with your registered email and password"
            : otpStep === 1
            ? purpose === "REGISTER"
              ? "Enter your details to get started with Mediclinic"
              : "Sign in to your patient account"
            : `We sent a 6-digit code to ${email}`}
        </p>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
              {isNoAccountError && (
                <div className="mt-2 pt-2 border-t border-red-200/60">
                  <Link
                    href={`/register?email=${encodeURIComponent(email)}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    No account found. Create an account instead &rarr;
                  </Link>
                </div>
              )}
              {isAccountExistsError && (
                <div className="mt-2 pt-2 border-t border-red-200/60">
                  <Link
                    href={`/login?email=${encodeURIComponent(email)}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Account already exists. Log in instead &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {infoMessage && !error && (
        <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <span>{infoMessage}</span>
        </div>
      )}

      {/* Mode 1: OTP Auth */}
      {authMode === "otp" && (
        <>
          {/* Step 1: Details / Request OTP */}
          {otpStep === 1 && (
            <form onSubmit={handleRequestOTP} className="space-y-4">
              {purpose === "REGISTER" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        setError("");
                      }}
                      icon={<UserIcon className="w-4 h-4" />}
                      placeholder="Jane"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      Last Name
                    </label>
                    <Input
                      type="text"
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        setError("");
                      }}
                      placeholder="Doe"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Email Address <span className="text-red-500">*</span>
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

              <Button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2"
                size="lg"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-5 h-5 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    Continue with Email OTP
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>

              {/* Divider & Google Sign-In Container */}
              {googleClientId && (
                <>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-paper px-3 text-muted font-medium">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <div id="google-signin-container" className="w-full min-h-[44px] flex justify-center" />
                </>
              )}

              {/* Cross-navigation prompt */}
              <div className="mt-6 pt-4 border-t border-border text-center">
                {purpose === "REGISTER" ? (
                  <p className="text-xs text-muted">
                    Already have an account?{" "}
                    <Link
                      href={`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                      className="text-primary font-semibold hover:underline"
                    >
                      Sign in
                    </Link>
                  </p>
                ) : (
                  <p className="text-xs text-muted">
                    Don&apos;t have an account?{" "}
                    <Link
                      href={`/register${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                      className="text-primary font-semibold hover:underline"
                    >
                      Create an account
                    </Link>
                  </p>
                )}
              </div>
            </form>
          )}

          {/* Step 2: Verify OTP (Code Entry only) */}
          {otpStep === 2 && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                    6-Digit Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep(1);
                      setCode("");
                      setError("");
                      setInfoMessage("");
                    }}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Change Email
                  </button>
                </div>
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
                  className="tracking-widest text-lg font-mono text-center"
                  autoFocus
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full flex items-center justify-center gap-2"
                size="lg"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Sign In"
                )}
              </Button>

              {/* Resend Cooldown UI */}
              <div className="pt-2 text-center text-sm text-muted">
                {cooldownTimer > 0 ? (
                  <span className="text-muted font-medium">
                    Resend code in{" "}
                    <span className="text-ink font-semibold">{cooldownTimer}s</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="text-primary font-semibold hover:underline flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <RotateCw className="w-4 h-4" />
                    Resend Code
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Password Fallback Link (Only for Login) */}
          {purpose === "LOGIN" && (
            <div className="mt-8 pt-6 border-t border-border text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("password");
                  setError("");
                  setInfoMessage("");
                }}
                className="text-xs text-muted hover:text-ink font-medium underline transition-colors"
              >
                Log in with password instead
              </button>
            </div>
          )}
        </>
      )}

      {/* Mode 2: Password Auth Fallback */}
      {authMode === "password" && (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
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
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-primary hover:underline font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                icon={<Lock className="w-5 h-5" />}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2"
            size="lg"
          >
            {loading ? (
              <>
                <RotateCw className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In with Password"
            )}
          </Button>

          {/* Switch Back Link */}
          <div className="mt-6 pt-4 border-t border-border text-center">
            <button
              type="button"
              onClick={() => {
                setAuthMode("otp");
                setOtpStep(1);
                setError("");
                setInfoMessage("");
              }}
              className="text-xs text-primary font-semibold hover:underline flex items-center justify-center gap-1 mx-auto"
            >
              <Sparkles className="w-4 h-4" />
              Switch back to quick Email OTP login
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
