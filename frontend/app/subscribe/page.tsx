"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import { subscriptionService } from "@/services/subscriptions";
import {
  Check, X, Zap, Building2, Rocket, ArrowLeft, Loader2,
  ShieldCheck, CreditCard, Lock,
} from "lucide-react";

const PLANS = [
  {
    id: "professional" as const,
    name: "Professional",
    price: 999,
    icon: Zap,
    color: "blue",
    description: "For growing clinics that need powerful tools",
    features: [
      "Up to 10 Doctor accounts",
      "Unlimited appointments",
      "Full patient records & EHR",
      "SMS + Email notifications",
      "Billing & auto-invoicing",
      "Advanced analytics dashboard",
      "Receptionist & staff roles",
      "Inventory management",
      "Priority support",
    ],
    missing: ["Multi-clinic management", "White-label branding"],
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: 2999,
    icon: Building2,
    color: "purple",
    description: "For hospital networks & multi-branch clinics",
    features: [
      "Unlimited Doctor accounts",
      "Unlimited appointments",
      "Multi-clinic management",
      "Super Admin dashboard",
      "Custom integrations & API",
      "White-label branding",
      "Dedicated account manager",
      "SLA-backed 24/7 support",
    ],
    missing: [],
  },
];

const loadRazorpayScript = (): Promise<boolean> =>
  new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

function SubscribePageInner() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelected = searchParams.get("plan")?.toLowerCase() as "professional" | "enterprise" | null;

  const [selectedPlan, setSelectedPlan] = useState<"professional" | "enterprise">(
    preSelected === "enterprise" ? "enterprise" : "professional"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && user.role !== "CLINIC_ADMIN") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const handleSubscribe = async () => {
    if (!user) {
      router.push(`/login?redirect=/subscribe?plan=${selectedPlan}`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setError("Failed to load Razorpay SDK. Please check your connection and try again.");
        return;
      }

      const res = await subscriptionService.createSubscription(selectedPlan);
      const { razorpay_key, subscription_id } = res.data;

      const plan = PLANS.find((p) => p.id === selectedPlan)!;
      const options = {
        key: razorpay_key,
        subscription_id,
        name: "MediClinic",
        description: `${plan.name} Plan — ₹${plan.price}/month`,
        handler: async (response: any) => {
          try {
            await subscriptionService.verifySubscription({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
            });
            router.push("/dashboard/admin/subscription?status=success");
          } catch {
            setError("Payment verification failed. Please contact support.");
          }
        },
        prefill: {
          name: user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "",
          email: user.email || "",
        },
        theme: { color: "#0F7B6C" },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        setError(response.error?.description || "Payment failed. Please try again.");
        setLoading(false);
      });
      rzp.open();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const plan = PLANS.find((p) => p.id === selectedPlan)!;
  const PlanIcon = plan.icon;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>
        <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
          <Lock className="w-3.5 h-3.5 text-emerald-500" />
          Secured by Razorpay
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium text-sm mb-5 border border-blue-100">
            <Rocket className="w-3.5 h-3.5" /> Choose your subscription plan
          </div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-3">
            Choose Your Plan
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Secure recurring billing powered by Razorpay e-mandate. Cancel anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {PLANS.map((p) => {
            const Icon = p.icon;
            const isSelected = selectedPlan === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPlan(p.id)}
                className={`text-left p-7 rounded-2xl border-2 transition-all ${
                  isSelected
                    ? "border-blue-600 bg-blue-50/50 shadow-lg shadow-blue-100"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between mb-5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected ? "border-blue-600 bg-blue-600" : "border-gray-300"
                  }`}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                </div>

                <div className="mb-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{p.name}</span>
                </div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold text-gray-900">₹{p.price.toLocaleString("en-IN")}</span>
                  <span className="text-gray-500 mb-1">/month</span>
                </div>
                <p className="text-xs text-emerald-600 font-semibold mb-4">Recurring via UPI Autopay / Card e-mandate</p>
                <p className="text-sm text-gray-600 mb-5">{p.description}</p>

                <ul className="space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                  {p.missing.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-400">
                      <X className="w-4 h-4 text-gray-300 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* Summary + CTA */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Selected plan</p>
              <div className="flex items-center gap-3">
                <PlanIcon className="w-5 h-5 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">{plan.name}</span>
                <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                  ₹{plan.price.toLocaleString("en-IN")}/month
                </span>
              </div>
              <p className="text-gray-500 text-sm mt-1">
                Auto-renewed via Razorpay e-mandate • Cancel anytime
              </p>
            </div>

            <div className="w-full sm:w-auto">
              {error && (
                <p className="text-sm text-red-500 font-medium mb-3 text-center">{error}</p>
              )}
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full sm:w-auto min-w-[220px] py-4 px-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold text-base shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Opening Razorpay...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    {user ? "Subscribe Now" : "Login to Subscribe"}
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-50 flex flex-wrap items-center gap-6 text-xs text-gray-400 font-medium">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> 256-bit SSL encryption</span>
            <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-blue-400" /> Powered by Razorpay</span>
            <span>Cancel anytime, no penalties</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SubscribePageInner />
    </Suspense>
  );
}
