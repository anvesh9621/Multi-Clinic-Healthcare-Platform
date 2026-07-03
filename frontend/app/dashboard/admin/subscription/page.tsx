"use client";

import { useEffect, useState, useContext } from "react";
import { useRouter } from "next/navigation";
import { useSubscription } from "@/context/SubscriptionContext";
import { AuthContext } from "@/context/AuthContext";
import api from "@/services/api";
import {
  Check, CreditCard, Download, FileText, Loader2,
  AlertTriangle, X, Zap, Building2, Crown, ChevronRight,
  RefreshCw, CheckCircle2
} from "lucide-react";

interface Invoice {
  id: number;
  invoice_number: string;
  total_amount: string;
  period_start: string;
  period_end: string;
  issued_at: string;
  has_pdf: boolean;
}

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 0,
    icon: Building2,
    color: "gray",
    features: ["Up to 2 Doctors", "Basic Appointments", "Patient Records", "Community Support"],
  },
  {
    id: "professional",
    name: "Professional",
    price: 999,
    icon: Zap,
    color: "blue",
    features: ["Unlimited Appointments", "Up to 5 Doctors", "Basic Analytics", "Email Support"],
    popular: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 2999,
    icon: Crown,
    color: "indigo",
    features: ["Unlimited Doctors", "Custom Roles", "Advanced Reports", "24/7 Priority Support", "White-labeled App"],
    popular: true,
  },
];

export default function SubscriptionPage() {
  const { subscription, loading, fetchSubscription } = useSubscription();
  const { user } = useContext(AuthContext);
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"professional" | "enterprise" | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    if (!loading && user && user.role !== "CLINIC_ADMIN") {
      setAccessDenied(true);
      setTimeout(() => router.push("/dashboard"), 2500);
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === "CLINIC_ADMIN") {
      fetchInvoices();
    }
  }, [user]);

  const fetchInvoices = async () => {
    try {
      const { data } = await api.get<Invoice[]>("/subscriptions/invoices/");
      setInvoices(data);
    } catch (err) {
      console.error("Failed to fetch invoices", err);
    }
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const verifySubscription = async (payload: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }) => {
    setVerifying(true);
    try {
      await api.post("/subscriptions/verify/", payload);
      setPaymentSuccess(true);
      await fetchSubscription();
      await fetchInvoices();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Payment verification failed. Please contact support.");
    } finally {
      setVerifying(false);
    }
  };

  const handleSubscribe = async (plan: "professional" | "enterprise") => {
    setShowModal(true);
    setSelectedPlan(plan);
    setPaymentSuccess(false);
    setErrorMsg(null);
    setLoadingAction(plan);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setErrorMsg("Failed to load Razorpay SDK. Please check your connection.");
        setLoadingAction(null);
        return;
      }

      const { data } = await api.post("/subscriptions/create/", { plan });

      const planDetails = PLANS.find((p) => p.id === plan);
      const options = {
        key: data.razorpay_key,
        subscription_id: data.subscription_id, // NOT order_id — this is e-mandate mode
        name: "MediClinic",
        description: `${planDetails?.name} Plan — ₹${planDetails?.price}/month`,
        handler: function (response: any) {
          // E-mandate set up — verify on backend
          verifySubscription({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_subscription_id: response.razorpay_subscription_id,
            razorpay_signature: response.razorpay_signature,
          });
        },
        prefill: {
          name: user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "",
          email: user?.email || "",
          contact: user?.phone_number || "",
        },
        theme: { color: "#6366f1" },
        modal: {
          ondismiss: function () {
            setLoadingAction(null);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        setErrorMsg(response.error.description || "Payment failed. Please try again.");
        setLoadingAction(null);
      });
      rzp.open();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Failed to initiate subscription.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel? You'll lose access at the end of the billing cycle.")) return;
    try {
      setLoadingAction("cancel");
      await api.post("/subscriptions/cancel/");
      await fetchSubscription();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Failed to cancel subscription.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownloadInvoice = async (id: number, number: string) => {
    try {
      const response = await api.get(`/subscriptions/invoices/${id}/download/`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${number}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Failed to download invoice. PDF may not be generated yet.");
    }
  };

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <p className="font-bold text-gray-800">Access Restricted</p>
        <p className="text-sm text-gray-500">Redirecting...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const currentPlan = subscription?.plan || "starter";
  const currentStatus = subscription?.status || "inactive";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Subscription & Billing</h1>
        <p className="text-gray-500 mt-1 text-sm">Manage your clinic's SaaS plan and GST invoices.</p>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Current Plan Banner */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              Current Plan
            </h2>
            <div className="mt-4 flex items-end gap-3">
              <span className="text-4xl font-black text-gray-900 capitalize tracking-tight">{currentPlan}</span>
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                currentStatus === "active" ? "bg-emerald-100 text-emerald-700" :
                currentStatus === "trialing" ? "bg-blue-100 text-blue-700" :
                currentStatus === "past_due" ? "bg-amber-100 text-amber-700" :
                "bg-gray-100 text-gray-700"
              }`}>
                {currentStatus.replace("_", " ")}
              </span>
            </div>
            {subscription?.current_period_end && (
              <p className="mt-2 text-sm text-gray-500 font-medium">
                Auto-renews on: {new Date(subscription.current_period_end).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {(currentPlan === "professional" || currentPlan === "enterprise") && currentStatus !== "cancelled" && (
              <button
                onClick={handleCancel}
                disabled={loadingAction !== null}
                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:text-red-600 hover:border-red-200 hover:bg-red-50 font-medium text-sm rounded-xl transition-all disabled:opacity-50"
              >
                {loadingAction === "cancel" ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Cancel Plan"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Plan Cards */}
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-4">Choose a Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan.toLowerCase() === plan.id;
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 flex flex-col transition-all ${
                  plan.id === "enterprise"
                    ? "bg-gray-900 border-gray-800 shadow-lg"
                    : isCurrentPlan
                    ? "bg-indigo-50 border-indigo-200"
                    : "bg-white border-gray-100 shadow-sm hover:border-indigo-100 hover:shadow-md"
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl uppercase tracking-wider">
                    Most Popular
                  </div>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                  plan.id === "enterprise" ? "bg-white/10" : "bg-indigo-50"
                }`}>
                  <Icon className={`w-5 h-5 ${plan.id === "enterprise" ? "text-white" : "text-indigo-600"}`} />
                </div>
                <h3 className={`text-xl font-bold ${plan.id === "enterprise" ? "text-white" : "text-gray-900"}`}>
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mt-2 mb-5">
                  <span className={`text-3xl font-black ${plan.id === "enterprise" ? "text-white" : "text-gray-900"}`}>
                    {plan.price === 0 ? "Free" : `₹${plan.price.toLocaleString("en-IN")}`}
                  </span>
                  {plan.price > 0 && (
                    <span className={`font-medium text-sm ${plan.id === "enterprise" ? "text-gray-400" : "text-gray-500"}`}>/month</span>
                  )}
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((ft) => (
                    <li key={ft} className={`flex items-center gap-2.5 text-sm font-medium ${
                      plan.id === "enterprise" ? "text-gray-300" : "text-gray-600"
                    }`}>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                        plan.id === "enterprise" ? "bg-white/10" : "bg-indigo-50"
                      }`}>
                        <Check className={`w-2.5 h-2.5 ${plan.id === "enterprise" ? "text-white" : "text-indigo-600"}`} />
                      </div>
                      {ft}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <div className={`w-full py-2.5 rounded-xl text-center text-sm font-bold flex items-center justify-center gap-2 ${
                    plan.id === "enterprise" ? "bg-white/10 text-white" : "bg-indigo-100 text-indigo-700"
                  }`}>
                    <CheckCircle2 className="w-4 h-4" /> Current Plan
                  </div>
                ) : plan.id === "starter" ? (
                  <div className="w-full py-2.5 rounded-xl text-center text-sm font-medium text-gray-400 border border-dashed border-gray-200">
                    Free plan
                  </div>
                ) : (
                  <button
                    id={`subscribe-${plan.id}`}
                    onClick={() => handleSubscribe(plan.id as "professional" | "enterprise")}
                    disabled={loadingAction !== null}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${
                      plan.id === "enterprise"
                        ? "bg-white text-gray-900 hover:bg-gray-100"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/25"
                    }`}
                  >
                    {loadingAction === plan.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>Upgrade <ChevronRight className="w-4 h-4" /></>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            Billing History & GST Invoices
          </h2>
          <button onClick={fetchInvoices} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="text-xs uppercase bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Invoice #</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Billing Period</th>
                <th className="px-6 py-4 font-mono">Amount (INR)</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400 font-medium">
                    No invoices yet. They'll appear here after your first charge.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{inv.invoice_number}</td>
                    <td className="px-6 py-4">{new Date(inv.issued_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-xs">
                      {new Date(inv.period_start).toLocaleDateString()} – {new Date(inv.period_end).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-gray-900">
                      ₹{parseFloat(inv.total_amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {inv.has_pdf ? (
                        <button
                          onClick={() => handleDownloadInvoice(inv.id, inv.invoice_number)}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download PDF
                        </button>
                      ) : (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md font-medium border border-amber-100">
                          Generating...
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscription Checkout Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">
                {paymentSuccess ? "Subscription Activated!" : verifying ? "Verifying Payment..." : "Subscribe"}
              </h3>
              {!verifying && !paymentSuccess && (
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="p-6 text-center">
              {paymentSuccess ? (
                <>
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <p className="font-bold text-gray-900 text-lg mb-1">You're all set!</p>
                  <p className="text-gray-500 text-sm mb-6">
                    Your <strong className="capitalize">{selectedPlan}</strong> plan is now active.
                    Auto-renewal is set up via UPI Autopay / Card e-mandate.
                  </p>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
                  >
                    Done
                  </button>
                </>
              ) : verifying ? (
                <>
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                  <p className="font-semibold text-gray-800">Verifying your payment...</p>
                  <p className="text-sm text-gray-500 mt-1">Please wait, do not close this window.</p>
                </>
              ) : loadingAction ? (
                <>
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                  <p className="font-semibold text-gray-800">Preparing secure checkout...</p>
                  <p className="text-sm text-gray-500 mt-1">Razorpay checkout will open shortly.</p>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
