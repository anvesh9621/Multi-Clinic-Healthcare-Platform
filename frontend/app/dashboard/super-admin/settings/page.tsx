"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { useRouter } from "next/navigation";
import { Shield, AlertTriangle, CheckCircle2, Loader2, Key, Eye, EyeOff } from "lucide-react";

export default function PlatformSettingsPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const [formData, setFormData] = useState({
    razorpay_key_id: "",
    razorpay_key_secret: "",
  });

  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/dashboard");
      return;
    }

    const fetchSettings = async () => {
      try {
        const { data } = await apiClient.get("/billing/platform-settings/");
        setFormData({
          razorpay_key_id: data.razorpay_key_id || "",
          razorpay_key_secret: data.razorpay_key_secret || "",
        });
      } catch (err) {
        console.error("Error fetching settings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await apiClient.post("/billing/platform-settings/", formData);
      setSuccess("Platform settings updated successfully.");

      // Re-fetch to show masked secret
      const { data } = await apiClient.get("/billing/platform-settings/");
      setFormData({
        razorpay_key_id: data.razorpay_key_id || "",
        razorpay_key_secret: data.razorpay_key_secret || "",
      });
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update platform settings.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Platform Settings</h1>
        <p className="text-gray-500 mt-1">Configure the global Razorpay payment gateway for subscription billing.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 sm:p-8 bg-slate-900 border-b border-slate-800 flex items-start gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Razorpay Payment Gateway</h2>
            <p className="text-slate-300 mt-1 text-sm">
              These keys authenticate all platform-level transactions — clinic subscription charges and 
              Razorpay Route patient payments. Keep your secret key secure.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Key ID */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Razorpay Key ID</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    name="razorpay_key_id"
                    value={formData.razorpay_key_id}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-mono text-sm"
                    placeholder="rzp_live_xxxxxxxxxxxxx"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  This is your <strong>publishable</strong> key, safe to expose to the frontend.
                </p>
              </div>

              {/* Key Secret */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Razorpay Key Secret</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showSecret ? "text" : "password"}
                    name="razorpay_key_secret"
                    value={formData.razorpay_key_secret}
                    onChange={handleChange}
                    className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-mono text-sm"
                    placeholder="Enter new secret to update"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">Leave blank to keep the current secret. Stored encrypted.</p>
              </div>
            </div>

            {/* Info callout */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
              <strong>How it works:</strong> The Key ID is sent to the frontend to initialize Razorpay Checkout.
              The Key Secret is used server-side to create subscriptions and verify webhook signatures.
              Razorpay collects clinic subscription payments directly into your Razorpay account linked to these credentials.
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
                ) : (
                  <>Save Configuration</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
