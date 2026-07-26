"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Building, CreditCard, Landmark, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export default function BankAccountPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [accountId, setAccountId] = useState("");

  const [formData, setFormData] = useState({
    bank_account_name: "",
    bank_account_number: "",
    bank_ifsc: "",
    business_pan: ""
  });

  useEffect(() => {
    if (user && user.role !== "CLINIC_ADMIN") {
      router.push("/dashboard");
      return;
    }

    const checkStatus = async () => {
      try {
        const { data } = await apiClient.get("/billing/onboard-bank/");
        setIsOnboarded(data.is_onboarded);
        if (data.account_id) setAccountId(data.account_id);
      } catch (err) {
        console.error("Error fetching bank status:", err);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
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
      const { data } = await apiClient.post("/billing/onboard-bank/", formData);
      setSuccess("Bank account successfully linked for B2C payouts.");
      setIsOnboarded(true);
      setAccountId(data.account_id || "Linked");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to onboard bank account. Please check your details.");
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
        <h1 className="text-3xl font-bold tracking-tight text-ink heading-font">Bank Account & Payouts</h1>
        <p className="text-muted mt-1">Configure your bank details to receive direct payouts for patient bookings.</p>
      </div>

      {isOnboarded ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 flex items-start gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-emerald-950 heading-font">Bank Account Connected</h2>
            <p className="text-emerald-800 mt-1 mb-4 text-sm font-medium">
              Your clinic is verified and connected to receive direct patient payouts via Razorpay Route.
            </p>
            <div className="bg-paper/80 border border-emerald-200 rounded-xl px-4 py-3 inline-block shadow-sm">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Linked Account ID</span>
              <p className="font-mono font-bold text-emerald-950 mt-1">{accountId}</p>
            </div>
          </div>
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="p-6 sm:p-8 bg-primary/10 border-b border-primary/20 flex items-start gap-4">
            <div className="w-12 h-12 bg-paper rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
              <Landmark className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink heading-font">Connect your Bank Account</h2>
              <p className="text-muted mt-1 text-sm leading-relaxed">
                We use Razorpay Route to directly transfer consultation fees from patients to your clinic account.
                Please provide your business bank details below to enable online payments.
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
                <div>
                  <label className="block text-sm font-bold text-ink mb-2">Account Holder Name *</label>
                  <Input
                    type="text"
                    name="bank_account_name"
                    icon={<Building className="w-4 h-4 text-muted" />}
                    value={formData.bank_account_name}
                    onChange={handleChange}
                    required
                    placeholder="e.g. City Clinic Private Limited"
                  />
                  <p className="text-xs text-muted mt-1.5">Must match the exact name registered with your bank.</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-ink mb-2">Account Number *</label>
                  <Input
                    type="text"
                    name="bank_account_number"
                    icon={<CreditCard className="w-4 h-4 text-muted" />}
                    value={formData.bank_account_number}
                    onChange={handleChange}
                    required
                    placeholder="e.g. 50200012345678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-ink mb-2">IFSC Code *</label>
                  <Input
                    type="text"
                    name="bank_ifsc"
                    icon={<Landmark className="w-4 h-4 text-muted" />}
                    value={formData.bank_ifsc}
                    onChange={handleChange}
                    required
                    className="uppercase font-mono"
                    placeholder="e.g. HDFC0001234"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-ink mb-2">Business PAN *</label>
                  <Input
                    type="text"
                    name="business_pan"
                    icon={<FileText className="w-4 h-4 text-muted" />}
                    value={formData.business_pan}
                    onChange={handleChange}
                    required
                    className="uppercase font-mono"
                    placeholder="e.g. ABCDE1234F"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto py-3"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying details...</>
                  ) : (
                    <>Connect Bank Account</>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
}
