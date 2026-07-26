"use client";

import { useState, useEffect, useContext } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  User,
  Mail,
  Phone,
  Building2,
  Clock,
  ArrowRight,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import apiClient from "@/services/api";
import { login, getCurrentUser } from "@/services/auth";
import { AuthContext } from "@/context/AuthContext";
import { ReceptionistInvitation } from "@/types/api";

export default function ReceptionistAcceptInvitePage() {
  const params = useParams();
  const token = params?.token as string;
  const router = useRouter();
  const { setUser } = useContext(AuthContext);

  const [loadingToken, setLoadingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<string>("PENDING");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<ReceptionistInvitation | null>(null);

  // Form Fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError("Missing invitation token.");
      setLoadingToken(false);
      return;
    }

    const verifyToken = async () => {
      try {
        setLoadingToken(true);
        const res = await apiClient.get(
          `/clinics/receptionists/invitations/status/${token}/`
        );
        if (res.data.isValid) {
          setTokenValid(true);
          setInviteData(res.data.invitation);
          setTokenStatus("PENDING");
        } else {
          setTokenValid(false);
          setTokenStatus(res.data.status || "INVALID");
          setTokenError(res.data.error || "This invitation is no longer valid.");
        }
      } catch (err: any) {
        setTokenValid(false);
        const backendErr =
          err.response?.data?.error ||
          "Invalid or expired invitation token.";
        setTokenStatus(err.response?.data?.status || "NOT_FOUND");
        setTokenError(backendErr);
        if (err.response?.data?.invitation) {
          setInviteData(err.response.data.invitation);
        }
      } finally {
        setLoadingToken(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Accept Invitation
      await apiClient.post("/clinics/receptionists/invitations/accept/", {
        token,
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
      });

      setSuccess(true);

      // 2. Auto-login with the newly set credentials
      if (inviteData?.email) {
        try {
          await login(inviteData.email, password);
          const userData = await getCurrentUser();
          setUser(userData.data || userData);
          setTimeout(() => {
            router.push("/dashboard/receptionist");
          }, 1500);
        } catch {
          // Fallback to manual login redirect
          setTimeout(() => {
            router.push("/login");
          }, 2000);
        }
      }
    } catch (err: any) {
      console.error(err);
      const backendErr =
        err.response?.data?.errors?.password?.[0] ||
        err.response?.data?.errors?.token?.[0] ||
        err.response?.data?.error ||
        "Failed to complete setup. Please check your inputs and try again.";
      setSubmitError(backendErr);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-muted">Verifying invitation link...</p>
        </div>
      </div>
    );
  }

  // Token Error / Already Used / Expired State
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-amber-50 text-amber-600 border border-amber-200">
            {tokenStatus === "ACCEPTED" ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            ) : tokenStatus === "CANCELLED" ? (
              <XCircle className="w-7 h-7 text-red-600" />
            ) : (
              <Clock className="w-7 h-7 text-amber-600" />
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-ink heading-font">
              {tokenStatus === "ACCEPTED"
                ? "Invitation Already Accepted"
                : tokenStatus === "EXPIRED"
                ? "Invitation Expired"
                : tokenStatus === "CANCELLED"
                ? "Invitation Cancelled"
                : "Invalid Invitation"}
            </h1>
            <p className="text-sm text-muted mt-2">{tokenError}</p>
          </div>

          {inviteData && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-left space-y-1">
              <p className="font-bold text-ink">{inviteData.clinic_name}</p>
              <p className="text-muted">Invited Email: {inviteData.email}</p>
            </div>
          )}

          <div className="pt-2">
            {tokenStatus === "ACCEPTED" ? (
              <Link href="/login">
                <Button className="w-full">Go to Login</Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  Return to Home
                </Button>
              </Link>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Success State
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-ink heading-font">
              Welcome to {inviteData?.clinic_name || "MediClinic"}!
            </h1>
            <p className="text-sm text-muted mt-2">
              Your receptionist account is ready. Redirecting to your dashboard...
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-primary">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Taking you to your dashboard...
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
            <Building2 className="w-3.5 h-3.5" /> Receptionist Invitation
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink heading-font">
            Join {inviteData?.clinic_name}
          </h1>
          <p className="text-muted text-sm">
            Set up your receptionist profile and security credentials to get started
          </p>
        </div>

        {/* Main Card */}
        <Card className="p-8 space-y-6">
          {/* Info Banner */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted font-medium">Clinic</span>
              <span className="font-bold text-ink">{inviteData?.clinic_name}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted font-medium">Invited Email</span>
              <span className="font-bold text-ink">{inviteData?.email}</span>
            </div>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-2.5 text-sm font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  First Name *
                </label>
                <Input
                  type="text"
                  required
                  placeholder="Sarah"
                  icon={<User className="w-4 h-4 text-muted" />}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Last Name
                </label>
                <Input
                  type="text"
                  placeholder="Connor"
                  icon={<User className="w-4 h-4 text-muted" />}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">
                Phone Number (Optional)
              </label>
              <Input
                type="tel"
                placeholder="+1 (555) 000-0000"
                icon={<Phone className="w-4 h-4 text-muted" />}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">
                Password * (min. 8 characters)
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  icon={<Lock className="w-4 h-4 text-muted" />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">
                Confirm Password *
              </label>
              <Input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                icon={<Lock className="w-4 h-4 text-muted" />}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 text-base font-bold"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <ArrowRight className="w-5 h-5 mr-2" />
              )}
              Complete Setup & Accept
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
