"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { Receipt, Loader2, CreditCard, ArrowRight, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
  const [payingId, setPayingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    api.get("/billing/invoices/")
      .then(res => setInvoices(res.data))
      .catch(err => {
        console.error("Failed to load invoices", err);
        setError("Failed to load invoices.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handlePayOnline = async (invoice: Invoice) => {
    setPayingId(invoice.id);
    setError(null);
    try {
      const { data } = await api.post(`/billing/invoices/${invoice.id}/pay/`);
      if (invoice.appointment_id) {
        sessionStorage.setItem("pending_appointment_id", String(invoice.appointment_id));
      }
      window.location.href = data.payment_link_url || data.short_url;
    } catch (err: any) {
      setError(err.response?.data?.error || "Could not generate payment link. Please try again.");
    } finally {
      setPayingId(null);
    }
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
          <Receipt className="w-6 h-6 text-primary" /> My Invoices
        </h1>
        <p className="text-sm text-muted mt-1">Your consultation billing history</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex gap-2 items-center text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {invoices.length === 0 ? (
        <Card className="p-16 text-center">
          <CreditCard className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="font-semibold text-ink">No invoices yet</p>
          <p className="text-sm text-muted mt-1">Your payment history will appear here after consultations.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => {
            const isPayable = ["pending", "pending_at_clinic"].includes(inv.status);
            return (
              <Card key={inv.id} hoverable className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-ink text-sm">INV-{inv.id.toString().padStart(4, "0")}</span>
                    <InvoiceStatusBadge status={inv.status} method={inv.payment_method} />
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {new Date(inv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  {inv.paid_at && (
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Paid on {new Date(inv.paid_at).toLocaleDateString("en-IN")}
                    </p>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="font-black text-lg text-ink font-mono">₹{parseFloat(inv.total_amount).toFixed(2)}</p>
                  {isPayable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePayOnline(inv)}
                      disabled={payingId === inv.id}
                      className="mt-1.5 text-primary hover:text-primary-dark"
                    >
                      {payingId === inv.id ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-1" />Processing...</>
                      ) : (
                        <>Pay online now <ArrowRight className="w-4 h-4 ml-1" /></>
                      )}
                    </Button>
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
