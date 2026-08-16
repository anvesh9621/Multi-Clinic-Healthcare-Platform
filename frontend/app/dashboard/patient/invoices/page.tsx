"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { Receipt, Loader2, CreditCard, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RazorpayCheckoutButton } from "@/components/billing/RazorpayCheckoutButton";

type Invoice = {
  id: number;
  total_amount: string;
  status: string;
  payment_method: string;
  paid_at: string | null;
  created_at: string;
  razorpay_payment_link_short_url: string;
  payment_link_expires_at: string | null;
  patient_name: string;
  appointment_id: number | null;
};

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  paid:              { label: "Paid",           className: "bg-emerald-100 text-emerald-700" },
  "paid-cash":       { label: "Paid · Cash",    className: "bg-emerald-100 text-emerald-700" },
  "paid-upi":        { label: "Paid · UPI",     className: "bg-emerald-100 text-emerald-700" },
  "paid-card":       { label: "Paid · Card",    className: "bg-emerald-100 text-emerald-700" },
  pending:           { label: "Awaiting payment",className: "bg-amber-100 text-amber-700" },
  pending_at_clinic: { label: "Pay at clinic",  className: "bg-blue-100 text-blue-700" },
  cancelled:         { label: "Cancelled",      className: "bg-gray-100 text-gray-600" },
  refunded:          { label: "Refunded",       className: "bg-purple-100 text-purple-700" },
};

function InvoiceStatusBadge({ status, method }: { status: string; method: string }) {
  const key = status === "paid" && method ? `paid-${method}` : status;
  const cfg = STATUS_MAP[key] ?? STATUS_MAP[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export default function PatientInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();

  const fetchInvoices = () => {
    api.get("/billing/invoices/")
      .then((res) => setInvoices(Array.isArray(res.data) ? res.data : res.data?.results || []))
      .catch((err) => {
        console.error("Failed to load invoices", err);
        setError("Failed to load invoices.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handlePaymentSuccess = (invoiceId: number, paymentId: string) => {
    setSuccessMessage(`Payment for Invoice #${invoiceId} confirmed! Payment ID: ${paymentId}`);
    fetchInvoices();
    setTimeout(() => setSuccessMessage(null), 6000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink flex items-center gap-3 heading-font">
          <Receipt className="w-6 h-6 text-primary" /> My Invoices & Payments
        </h1>
        <p className="text-sm text-muted mt-1">Your consultation billing and payment history</p>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex gap-2 items-center text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          {successMessage}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex gap-2 items-center text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {invoices.length === 0 ? (
        <Card className="p-16 text-center border-border">
          <CreditCard className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="font-semibold text-ink">No invoices yet</p>
          <p className="text-sm text-muted mt-1">Your payment history will appear here after consultations.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const isPayable = ["pending", "pending_at_clinic", "draft"].includes(inv.status);
            const amountInPaise = Math.round(parseFloat(inv.total_amount || "0") * 100);

            return (
              <Card key={inv.id} hoverable className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-border">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-ink text-sm">
                        INV-{inv.id.toString().padStart(4, "0")}
                      </span>
                      <InvoiceStatusBadge status={inv.status} method={inv.payment_method} />
                    </div>
                    <p className="text-xs text-muted">
                      Created on {new Date(inv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    {inv.paid_at && (
                      <p className="text-xs text-emerald-700 font-medium">
                        Paid on {new Date(inv.paid_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right flex flex-col sm:items-end gap-2 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                  <p className="font-bold text-xl text-ink font-mono">
                    ₹{parseFloat(inv.total_amount).toFixed(2)}
                  </p>
                  {isPayable && amountInPaise >= 100 && (
                    <RazorpayCheckoutButton
                      amountInPaise={amountInPaise}
                      currency="INR"
                      invoiceId={inv.id}
                      description={`Invoice #${inv.id} Payment`}
                      buttonText="Pay with Razorpay"
                      size="sm"
                      onSuccess={(res) => handlePaymentSuccess(inv.id, res.payment_id)}
                      onError={(err) => setError(err)}
                    />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
