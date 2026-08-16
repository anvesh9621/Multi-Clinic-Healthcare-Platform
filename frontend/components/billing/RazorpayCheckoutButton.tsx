"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CreditCard, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  VerifyPaymentResponse,
} from "@/services/billing";
import { useRazorpay } from "@/hooks/useRazorpay";

export interface RazorpayCheckoutButtonProps {
  amountInPaise: number; // e.g. 50000 for ₹500.00 (min 100 paise)
  currency?: string;
  receipt?: string;
  invoiceId?: number | string;
  notes?: Record<string, any>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  name?: string;
  description?: string;
  buttonText?: string;
  variant?: "default" | "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
  className?: string;
  disabled?: boolean;
  onSuccess?: (response: VerifyPaymentResponse) => void;
  onError?: (errorMessage: string) => void;
  onDismiss?: () => void;
}

export function RazorpayCheckoutButton({
  amountInPaise,
  currency = "INR",
  receipt,
  invoiceId,
  notes,
  prefill,
  name = "MediClinic Healthcare",
  description,
  buttonText,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  onSuccess,
  onError,
  onDismiss,
}: RazorpayCheckoutButtonProps) {
  const { isLoaded, loadError } = useRazorpay();
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const formattedAmount = (amountInPaise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: currency || "INR",
  });

  const handleCheckout = async () => {
    setStatusMessage(null);

    if (amountInPaise < 100) {
      const err = "Amount must be at least ₹1.00 (100 paise).";
      setStatusMessage({ type: "error", text: err });
      onError?.(err);
      return;
    }

    if (typeof window === "undefined" || !(window as any).Razorpay) {
      if (loadError) {
        setStatusMessage({ type: "error", text: loadError });
        onError?.(loadError);
        return;
      }
      // Wait briefly if script is still downloading
      let attempts = 0;
      while (!(window as any).Razorpay && attempts < 10) {
        await new Promise((r) => setTimeout(r, 200));
        attempts++;
      }
      if (!(window as any).Razorpay) {
        const err = "Razorpay SDK is not available. Please check your internet connection.";
        setStatusMessage({ type: "error", text: err });
        onError?.(err);
        return;
      }
    }

    setLoading(true);

    try {
      // Step 1: Create Order via Backend API
      const orderRes = await createRazorpayOrder({
        amount: amountInPaise,
        currency,
        receipt,
        notes,
        invoice_id: invoiceId,
      });

      if (!orderRes.success || !orderRes.order_id) {
        throw new Error(orderRes.error || "Failed to initiate payment order.");
      }

      const keyId =
        orderRes.key_id ||
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
        "rzp_test_TQ9TQdaGO2avyV";

      // Step 2: Open Razorpay Standard Checkout Modal
      const options = {
        key: keyId,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: name,
        description: description || `Payment of ${formattedAmount}`,
        image: "/favicon.ico",
        order_id: orderRes.order_id,
        prefill: {
          name: prefill?.name || "",
          email: prefill?.email || "",
          contact: prefill?.contact || "",
        },
        notes: orderRes.notes || notes || {},
        theme: {
          color: "#0F7B6C", // MediClinic brand primary teal
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            onDismiss?.();
          },
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            // Step 3: Verify Payment Signature via Backend API
            const verifyRes = await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              invoice_id: invoiceId,
            });

            if (verifyRes.success) {
              setStatusMessage({
                type: "success",
                text: `Payment successful! Payment ID: ${verifyRes.payment_id}`,
              });
              onSuccess?.(verifyRes);
            } else {
              throw new Error(verifyRes.error || "Payment verification failed.");
            }
          } catch (verifyErr: any) {
            const msg =
              verifyErr.response?.data?.error ||
              verifyErr.message ||
              "Payment verification failed.";
            setStatusMessage({ type: "error", text: msg });
            onError?.(msg);
          } finally {
            setLoading(false);
          }
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);

      // Handle payment failure event
      razorpayInstance.on("payment.failed", function (response: any) {
        const failureReason =
          response.error?.description ||
          response.error?.reason ||
          "Payment failed or declined by issuing bank.";
        setStatusMessage({ type: "error", text: failureReason });
        onError?.(failureReason);
        setLoading(false);
      });

      razorpayInstance.open();
    } catch (err: any) {
      const msg =
        err.response?.data?.error || err.message || "Failed to open payment gateway.";
      setStatusMessage({ type: "error", text: msg });
      onError?.(msg);
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col gap-2">
      <Button
        type="button"
        variant={variant as any}
        size={size}
        onClick={handleCheckout}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 font-semibold shadow-sm transition-all ${className}`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing Order...</span>
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            <span>{buttonText || `Pay ${formattedAmount}`}</span>
          </>
        )}
      </Button>

      {statusMessage && (
        <div
          className={`text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 font-medium ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
}
