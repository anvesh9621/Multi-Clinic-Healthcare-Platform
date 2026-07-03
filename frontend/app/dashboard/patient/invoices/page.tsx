"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { Receipt, Loader2, CreditCard, ArrowRight, AlertCircle } from "lucide-react";

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

function StatusBadge({ status, method }: { status: string; method: string }) {
  if (status === "paid" && method === "cash") return <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-700">Paid · Cash</span>;
  if (status === "paid" && method === "upi") return <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-700">Paid · UPI</span>;
  if (status === "paid" && method === "card") return <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-700">Paid · Card</span>;
  if (status === "paid") return <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-700">Paid</span>;
  if (status === "pending") return <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-700">Awaiting payment</span>;
  if (status === "pending_at_clinic") return <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-blue-100 text-blue-700">Pay at clinic</span>;
  if (status === "cancelled") return <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-gray-100 text-gray-600">Cancelled</span>;
  if (status === "refunded") return <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-purple-100 text-purple-700">Refunded</span>;
  return <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-gray-100 text-gray-600">{status}</span>;
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
      // Store appointment ID for polling on callback page
      if (invoice.appointment_id) {
        sessionStorage.setItem("pending_appointment_id", String(invoice.appointment_id));
      }
      // Redirect to Razorpay payment link
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Receipt className="w-6 h-6 text-blue-600" /> My Invoices
        </h1>
        <p className="text-sm text-gray-500 mt-1">Your consultation billing history</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex gap-2 items-center text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">No invoices yet</p>
          <p className="text-sm text-gray-400 mt-1">Your payment history will appear here after consultations.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => {
            const isPayable = ["pending", "pending_at_clinic"].includes(inv.status);
            return (
              <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:border-gray-200 hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">INV-{inv.id.toString().padStart(4, "0")}</span>
                    <StatusBadge status={inv.status} method={inv.payment_method} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{new Date(inv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  {inv.paid_at && <p className="text-xs text-emerald-600 mt-0.5">Paid on {new Date(inv.paid_at).toLocaleDateString("en-IN")}</p>}
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="font-black text-lg text-gray-900 font-mono">₹{parseFloat(inv.total_amount).toFixed(2)}</p>
                  {isPayable && (
                    <button
                      onClick={() => handlePayOnline(inv)}
                      disabled={payingId === inv.id}
                      className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
                    >
                      {payingId === inv.id ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                      ) : (
                        <>Pay online now <ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
