"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { useRouter } from "next/navigation";
import { Shield, AlertTriangle, CheckCircle2, Loader2, Key, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

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
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink heading-font">Platform Settings</h1>
        <p className="text-muted mt-1">Configure the global Razorpay payment gateway for subscription billing.</p>
      </div>

      <Card className="overflow-hidden p-0">
        {/* Header Banner */}
        <div className="p-6 sm:p-8 bg-ink border-b border-border text-paper flex items-start gap-4">
          <div className="w-12 h-12 bg-paper/10 rounded-full flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-paper" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-paper heading-font">Razorpay Payment Gateway</h2>
            <p className="text-paper/80 mt-1 text-sm leading-relaxed">
              These keys authenticate all platform-level transactions — clinic subscription charges and 
              Razorpay Route patient payments. Keep your secret key secure.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {error && (
            <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-semibold">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Key ID */}
              <div>
                <label className="block text-sm font-bold text-ink mb-2">Razorpay Key ID</label>
                <Input
                  type="text"
                  name="razorpay_key_id"
                  icon={<Key className="w-4 h-4 text-muted" />}
                  value={formData.razorpay_key_id}
                  onChange={handleChange}
                  className="font-mono text-sm"
                  placeholder="rzp_live_xxxxxxxxxxxxx"
                />
                <p className="text-xs text-muted mt-1.5 font-medium">
                  This is your <strong>publishable</strong> key, safe to expose to the frontend.
                </p>
              </div>

              {/* Key Secret */}
              <div>
                <label className="block text-sm font-bold text-ink mb-2">Razorpay Key Secret</label>
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    name="razorpay_key_secret"
                    icon={<Key className="w-4 h-4 text-muted" />}
                    value={formData.razorpay_key_secret}
                    onChange={handleChange}
                    className="font-mono text-sm pr-10"
                    placeholder="Enter new secret to update"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted mt-1.5 font-medium">Leave blank to keep the current secret. Stored encrypted.</p>
              </div>
            </div>

            {/* Info callout */}
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-sm text-ink leading-relaxed font-medium">
              <strong className="text-primary">How it works:</strong> The Key ID is sent to the frontend to initialize Razorpay Checkout.
              The Key Secret is used server-side to create subscriptions and verify webhook signatures.
              Razorpay collects clinic subscription payments directly into your Razorpay account linked to these credentials.
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button
                type="submit"
                disabled={submitting}
                className="px-8 py-3"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Shield className="w-4 h-4 mr-2" /> Save Configuration</>
                )}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
