"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Lock, Eye, EyeOff, CheckCircle, AlertCircle, Stethoscope,
  User, Mail, Phone, Award, Globe, DollarSign, Loader2, BookOpen
} from "lucide-react";
import { checkInviteToken, acceptInvite } from "@/services/invitations";

interface InvitationData {
  email: string;
  specialization: string;
  clinic_name: string;
}

const LANGUAGES = [
  "English", "Hindi", "Marathi", "Bengali", "Tamil", "Telugu",
  "Gujarati", "Kannada", "Malayalam", "Punjabi", "Urdu", "Arabic",
];

function RegistrationForm({ token }: { token: string }) {
  const router = useRouter();

  const [loadingToken, setLoadingToken] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<InvitationData | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [experience, setExperience] = useState<number>(0);
  const [qualifications, setQualifications] = useState("");
  const [bio, setBio] = useState("");
  const [fee, setFee] = useState<number>(500);
  const [languages, setLanguages] = useState<string[]>([]);
  const [langInput, setLangInput] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const res = await checkInviteToken(token);
        if (res.isValid) {
          setInviteData(res.invitation);
        } else {
          setTokenError("This invitation is invalid or has expired.");
        }
      } catch (err: any) {
        setTokenError(err.response?.data?.error || "Invalid invitation token.");
      } finally {
        setLoadingToken(false);
      }
    };
    verifyToken();
  }, [token]);

  const addLang = (lang: string) => {
    if (!lang || languages.includes(lang)) return;
    setLanguages([...languages, lang]);
    setLangInput("");
  };

  const removeLang = (lang: string) =>
    setLanguages(languages.filter((l) => l !== lang));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setSubmitError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        token,
        password,
        first_name: firstName,
        last_name: lastName,
        phone,
        specialization: inviteData?.specialization,
        experience_years: experience,
        qualifications,
        languages_spoken: languages,
        bio,
        consultation_fee: fee,
      };

      const res = await acceptInvite(payload);
      setSuccess(res.email || "Account activated!");
    } catch (err: any) {
      const data = err.response?.data?.errors;
      if (data) {
        setSubmitError(
          Object.entries(data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join(" | ")
        );
      } else {
        setSubmitError(err.response?.data?.error || "Failed to create account. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Render loading state
  if (loadingToken) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium animate-pulse">Verifying invitation link...</p>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-100 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl shadow-gray-200/50">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h2>
          <p className="text-gray-500 mb-6">{tokenError}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl transition-colors font-medium"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  // Render Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-100 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl shadow-gray-200/50">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Profile Completed!</h2>
          <p className="text-gray-500 mb-6">
            Your doctor account <span className="text-blue-600 font-medium">{success}</span> is now fully set up and ready to use.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-md active:scale-[0.98]"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center py-12 px-4 sm:px-6 relative font-sans text-gray-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full bg-blue-100/40 blur-3xl mix-blend-multiply" />
        <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] rounded-full bg-sky-100/40 blur-3xl mix-blend-multiply" />
      </div>

      <div className="w-full max-w-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-md">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Join {inviteData?.clinic_name}</h1>
          <p className="text-gray-500 mt-2">Complete your doctor profile and set a password</p>
        </div>

        {/* Form Card */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-gray-200/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            {submitError && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="pt-0.5">{submitError}</p>
              </div>
            )}

            {/* Read-only Data */}
            <div className="grid sm:grid-cols-2 gap-4 pb-6 border-b border-gray-100">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
                <div className="flex items-center px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-600">
                  <Mail className="w-4 h-4 mr-2 text-gray-400" />
                  {inviteData?.email}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Assigned Specialization</label>
                <div className="flex items-center px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-600">
                  <Award className="w-4 h-4 mr-2 text-gray-400" />
                  {inviteData?.specialization}
                </div>
              </div>
            </div>

            {/* Personal Info */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Personal Information</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">First Name *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Ravi"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Last Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Sharma"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition text-sm"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Info */}
            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Professional Profile</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Experience (Years)</label>
                  <input
                    type="number"
                    min="0"
                    value={experience}
                    onChange={(e) => setExperience(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Consultation Fee (₹)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      value={fee}
                      onChange={(e) => setFee(parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition text-sm"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Qualifications & Degrees</label>
                  <div className="relative">
                    <BookOpen className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={qualifications}
                      onChange={(e) => setQualifications(e.target.value)}
                      placeholder="e.g. MBBS, MD, DNB"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition text-sm"
                    />
                  </div>
                </div>

                {/* Languages */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Languages Spoken</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {languages.map((lang) => (
                      <span key={lang} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 text-blue-700 font-medium text-xs rounded-full">
                        {lang}
                        <button type="button" onClick={() => removeLang(lang)} className="hover:text-red-500 transition-colors">
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={langInput}
                      onChange={(e) => setLangInput(e.target.value)}
                      className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition"
                    >
                      <option value="">Select languages...</option>
                      {LANGUAGES.filter((l) => !languages.includes(l)).map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => addLang(langInput)}
                      className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl transition-colors font-medium text-sm"
                    >
                      Add
                    </button>
                  </div>
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Professional Bio</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell patients a bit about your expertise and background..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition text-sm resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Account Security</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat password"
                      className={`w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition text-sm ${
                        confirm && confirm !== password
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                          : "border-gray-200 focus:border-blue-500 focus:ring-blue-500/20"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-4 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-base font-semibold rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Saving Profile...</>
              ) : (
                "Complete Profile & Create Account"
              )}
            </button>
          </form>
        </div>
        
        <p className="text-center text-gray-500 text-xs mt-6">
          By activating your account, you agree to the MediClinic Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

import { use } from "react";

export default function InviteRegistrationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>}>
      <RegistrationForm token={token} />
    </Suspense>
  );
}
