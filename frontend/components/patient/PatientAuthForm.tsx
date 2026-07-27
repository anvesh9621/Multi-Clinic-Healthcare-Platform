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
  User,
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
  const { setUser } = useContext(AuthContext);

  // Auth Mode: 'otp' | 'password'
  const [authMode, setAuthMode] = useState<"otp" | "password">("otp");
  
  // OTP Step: 1 (Email entry) | 2 (Code entry)
  const [otpStep, setOtpStep] = useState<1 | 2>(1);
  const [purpose, setPurpose] = useState<"LOGIN" | "REGISTER">(initialPurpose);

  // Form Fields
  const [email, setEmail] = useState("");
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

  // Countdown timer effect
  useEffect(() => {
    if (cooldownTimer <= 0) return;
    const interval = setInterval(() => {
      setCooldownTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownTimer]);

  // Google Sign-In SDK Initialization
  useEffect(() => {
    const googleClientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      "test-client-id.apps.googleusercontent.com";

    // Load Google Identity Services script
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
  }, [setUser, router, redirectTarget]);

  // Request OTP (Step 1)
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");
    setInfoMessage("");

    try {
      // First attempt with requested purpose
      const res = await requestPatientOTP(email, purpose);
      if (res.success) {
        setOtpStep(2);
        setCooldownTimer(60);
        setInfoMessage(`Verification code sent to ${email}`);
      } else {
        setError(res.error || "Failed to send verification code.");
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || "";
      
      // If user doesn't exist on LOGIN, switch to REGISTER
      if (purpose === "LOGIN" && errMsg.includes("No account found")) {
        setPurpose("REGISTER");
        try {
          const regRes = await requestPatientOTP(email, "REGISTER");
          if (regRes.success) {
            setOtpStep(2);
            setCooldownTimer(60);
            setInfoMessage(`New account! Verification code sent to ${email}`);
            setLoading(false);
            return;
          }
        } catch (regErr: any) {
          setError(regErr?.response?.data?.error || "Failed to send verification code.");
          setLoading(false);
          return;
        }
      }
      
      // If account exists on REGISTER, switch to LOGIN
      if (purpose === "REGISTER" && errMsg.includes("already exists")) {
        setPurpose("LOGIN");
        try {
          const logRes = await requestPatientOTP(email, "LOGIN");
          if (logRes.success) {
            setOtpStep(2);
            setCooldownTimer(60);
            setInfoMessage(`Welcome back! Verification code sent to ${email}`);
            setLoading(false);
            return;
          }
        } catch (logErr: any) {
          setError(logErr?.response?.data?.error || "Failed to send verification code.");
          setLoading(false);
          return;
        }
      }

      setError(errMsg || "Failed to request verification code. Please try again.");
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
      const res = await requestPatientOTP(email, purpose);
      if (res.success) {
        setCooldownTimer(60);
        setInfoMessage(`A fresh 6-digit code has been sent to ${email}`);
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
        email,
        code,
        purpose,
        first_name: firstName,
        last_name: lastName,
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
      await login(email, password);
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

  return (
    <Card className="w-full max-w-[440px] p-8 sm:p-10 shadow-2xl shadow-gray-200/50 border border-border/80">
      {/* Header Title */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-2">
          {authMode === "password"
            ? "Patient Password Login"
            : otpStep === 1
            ? "Patient Portal"
            : purpose === "REGISTER"
            ? "Complete Registration"
            : "Enter Verification Code"}
        </h1>
        <p className="text-sm text-muted">
          {authMode === "password"
            ? "Sign in with your registered email and password"
            : otpStep === 1
            ? "Quick & secure sign-in with Email OTP or Google"
            : `We sent a 6-digit code to ${email}`}
        </p>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
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
          {/* Step 1: Request OTP */}
          {otpStep === 1 && (
            <form onSubmit={handleRequestOTP} className="space-y-4">
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

              {/* Divider */}
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

              {/* Google Sign-In Container */}
              <div id="google-signin-container" className="w-full min-h-[44px] flex justify-center" />
            </form>
          )}

          {/* Step 2: Verify OTP */}
          {otpStep === 2 && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              {purpose === "REGISTER" && (
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      First Name
                    </label>
                    <Input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      icon={<User className="w-4 h-4" />}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      Last Name
                    </label>
                    <Input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                    />
                  </div>
                </div>
              )}

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

          {/* Password Fallback Link */}
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
