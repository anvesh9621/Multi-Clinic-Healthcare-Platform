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
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";

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
        subscription_id: data.subscription_id,
        name: "MediClinic",
        description: `${planDetails?.name} Plan — ₹${planDetails?.price}/month`,
        handler: function (response: any) {
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
        theme: { color: "#0F7B6C" },
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
        <p className="font-bold text-ink heading-font">Access Restricted</p>
        <p className="text-sm text-muted">Redirecting...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentPlan = subscription?.plan || "starter";
  const currentStatus = subscription?.status || "inactive";

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-ink tracking-tight heading-font">Subscription & Billing</h1>
        <p className="text-muted mt-1 text-sm">Manage your clinic's SaaS plan and GST invoices.</p>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Current Plan Banner */}
      <Card className="p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-lg font-bold text-ink flex items-center gap-2 heading-font">
              <CreditCard className="w-5 h-5 text-primary" />
              Current Plan
            </h2>
            <div className="mt-4 flex items-end gap-3">
              <span className="text-4xl font-black text-ink capitalize tracking-tight heading-font">{currentPlan}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                currentStatus === "active" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                currentStatus === "trialing" ? "bg-blue-100 text-blue-800 border border-blue-200" :
                currentStatus === "past_due" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                "bg-gray-100 text-gray-800 border border-gray-200"
              }`}>
                {currentStatus.replace("_", " ")}
              </span>
            </div>
            {subscription?.current_period_end && (
              <p className="mt-2 text-sm text-muted font-medium">
                Auto-renews on: {new Date(subscription.current_period_end).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {(currentPlan === "professional" || currentPlan === "enterprise") && currentStatus !== "cancelled" && (
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={loadingAction !== null}
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                {loadingAction === "cancel" ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Cancel Plan"}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Plan Cards */}
      <div>
        <h2 className="text-xl font-bold text-ink mb-4 heading-font">Choose a Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan.toLowerCase() === plan.id;
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 flex flex-col transition-all ${
                  plan.id === "enterprise"
                    ? "bg-ink text-paper border-ink shadow-lg"
                    : isCurrentPlan
                    ? "bg-primary/5 border-primary/30"
                    : "bg-paper border-border shadow-sm hover:border-primary/30 hover:shadow-md"
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl uppercase tracking-wider">
                    Most Popular
                  </div>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                  plan.id === "enterprise" ? "bg-paper/10" : "bg-primary/10"
                }`}>
                  <Icon className={`w-5 h-5 ${plan.id === "enterprise" ? "text-paper" : "text-primary"}`} />
                </div>
                <h3 className={`text-xl font-bold heading-font ${plan.id === "enterprise" ? "text-paper" : "text-ink"}`}>
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mt-2 mb-5">
                  <span className={`text-3xl font-black font-mono ${plan.id === "enterprise" ? "text-paper" : "text-ink"}`}>
                    {plan.price === 0 ? "Free" : `₹${plan.price.toLocaleString("en-IN")}`}
                  </span>
                  {plan.price > 0 && (
                    <span className={`font-medium text-sm ${plan.id === "enterprise" ? "text-paper/70" : "text-muted"}`}>/month</span>
                  )}
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((ft) => (
                    <li key={ft} className={`flex items-center gap-2.5 text-sm font-medium ${
                      plan.id === "enterprise" ? "text-paper/80" : "text-ink/80"
                    }`}>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                        plan.id === "enterprise" ? "bg-paper/10 text-paper" : "bg-primary/10 text-primary"
                      }`}>
                        <Check className="w-2.5 h-2.5" />
                      </div>
                      {ft}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <div className={`w-full py-2.5 rounded-xl text-center text-sm font-bold flex items-center justify-center gap-2 ${
                    plan.id === "enterprise" ? "bg-paper/10 text-paper" : "bg-primary/10 text-primary"
                  }`}>
                    <CheckCircle2 className="w-4 h-4" /> Current Plan
                  </div>
                ) : plan.id === "starter" ? (
                  <div className="w-full py-2.5 rounded-xl text-center text-sm font-medium text-muted border border-dashed border-border">
                    Free plan
                  </div>
                ) : (
                  <Button
                    id={`subscribe-${plan.id}`}
                    onClick={() => handleSubscribe(plan.id as "professional" | "enterprise")}
                    disabled={loadingAction !== null}
                    variant={plan.id === "enterprise" ? "secondary" : "default"}
                    className="w-full py-3"
                  >
                    {loadingAction === plan.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>Upgrade <ChevronRight className="w-4 h-4 ml-1" /></>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoices */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink heading-font flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted" />
            Billing History & GST Invoices
          </h2>
          <Button variant="ghost" size="icon" onClick={fetchInvoices} className="text-muted">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Billing Period</TableHead>
              <TableHead>Amount (INR)</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-6 py-10 text-center text-muted font-medium">
                  No invoices yet. They'll appear here after your first charge.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-bold text-ink font-mono">{inv.invoice_number}</TableCell>
                  <TableCell className="text-ink">{new Date(inv.issued_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs text-muted">
                    {new Date(inv.period_start).toLocaleDateString()} – {new Date(inv.period_end).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-mono font-bold text-ink">
                    ₹{parseFloat(inv.total_amount).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {inv.has_pdf ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadInvoice(inv.id, inv.invoice_number)}
                        className="text-primary hover:text-primary-dark"
                      >
                        <Download className="w-4 h-4 mr-1.5" />
                        Download PDF
                      </Button>
                    ) : (
                      <span className="text-xs text-amber-800 bg-amber-100 border border-amber-200 px-2 py-1 rounded-full font-semibold">
                        Generating...
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Subscription Checkout Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={paymentSuccess ? "Subscription Activated!" : verifying ? "Verifying Payment..." : "Subscribe"} className="max-w-sm">
        <div className="text-center py-4">
          {paymentSuccess ? (
            <>
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="font-bold text-ink text-lg mb-1 heading-font">You're all set!</p>
              <p className="text-muted text-sm mb-6">
                Your <strong className="capitalize text-ink">{selectedPlan}</strong> plan is now active.
                Auto-renewal is set up via UPI Autopay / Card e-mandate.
              </p>
              <Button onClick={() => setShowModal(false)} className="w-full">
                Done
              </Button>
            </>
          ) : verifying ? (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <p className="font-bold text-ink">Verifying your payment...</p>
              <p className="text-sm text-muted mt-1">Please wait, do not close this window.</p>
            </>
          ) : loadingAction ? (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <p className="font-bold text-ink">Preparing secure checkout...</p>
              <p className="text-sm text-muted mt-1">Razorpay checkout will open shortly.</p>
            </>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
