"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Building, CreditCard, Landmark, FileText, Loader2 } from "lucide-react";

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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Bank Account & Payouts</h1>
        <p className="text-gray-500 mt-1">Configure your bank details to receive direct payouts for patient bookings.</p>
      </div>

      {isOnboarded ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 flex items-start gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-green-900">Bank Account Connected</h2>
            <p className="text-green-700 mt-1 mb-4">
              Your clinic is verified and connected to receive direct patient payouts via Razorpay Route.
            </p>
            <div className="bg-white/60 border border-green-200 rounded-xl px-4 py-3 inline-block">
              <span className="text-sm font-semibold text-green-800 uppercase tracking-wide">Linked Account ID</span>
              <p className="font-mono text-green-900 mt-1">{accountId}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 bg-blue-50 border-b border-blue-100 flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Landmark className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-blue-900">Connect your Bank Account</h2>
              <p className="text-blue-700 mt-1">
                We use Razorpay Route to directly transfer consultation fees from patients to your clinic account.
                Please provide your business bank details below to enable online payments.
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
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Account Holder Name *</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="bank_account_name"
                      value={formData.bank_account_name}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="e.g. City Clinic Private Limited"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">Must match the exact name registered with your bank.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Account Number *</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="bank_account_number"
                      value={formData.bank_account_number}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="e.g. 50200012345678"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">IFSC Code *</label>
                  <div className="relative">
                    <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="bank_ifsc"
                      value={formData.bank_ifsc}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase"
                      placeholder="e.g. HDFC0001234"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Business PAN *</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="business_pan"
                      value={formData.business_pan}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase"
                      placeholder="e.g. ABCDE1234F"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Verifying details...</>
                  ) : (
                    "Connect Bank Account"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
