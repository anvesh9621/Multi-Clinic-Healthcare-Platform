"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Receipt, FileText, Trash2, X, Banknote, QrCode, CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";
import api from "@/services/api";

type InvoiceItem = { description: string; amount: string };

type Invoice = {
  id: number;
  patient: number;
  patient_name: string;
  patient_email: string;
  appointment_date: string | null;
  appointment_doctor: string | null;
  total_amount: string;
  status: string;
  payment_method: string;
  paid_at: string | null;
  issued_date: string;
  created_at: string;
  payment_link_url: string;
  razorpay_payment_link_short_url: string;
  payment_link_expires_at: string | null;
  minutes_remaining: number | null;
};

function StatusBadge({ status, method }: { status: string; method: string }) {
  if (status === "paid" && method === "cash") return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-emerald-100 text-emerald-800">Paid · Cash</span>;
  if (status === "paid" && method === "upi") return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-emerald-100 text-emerald-800">Paid · UPI</span>;
  if (status === "paid" && method === "card") return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-emerald-100 text-emerald-800">Paid · Card</span>;
  if (status === "paid") return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-emerald-100 text-emerald-800">Paid</span>;
  if (status === "pending") return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-amber-100 text-amber-800">Pending</span>;
  if (status === "pending_at_clinic") return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-blue-100 text-blue-800">Pay at Clinic</span>;
  if (status === "cancelled") return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-gray-100 text-gray-600">Cancelled</span>;
  if (status === "refunded") return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-purple-100 text-purple-800">Refunded</span>;
  return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-gray-100 text-gray-600">{status}</span>;
}

function PaymentModal({ invoice, onClose, onUpdate }: { invoice: Invoice; onClose: () => void; onUpdate: (inv: Invoice) => void }) {
  const [mode, setMode] = useState<"choice" | "qr" | "confirming-cash">("choice");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrData, setQrData] = useState<{ url: string; expires_at: string; minutes_remaining: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [qrExpired, setQrExpired] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isActionable = ["pending", "pending_at_clinic", "draft"].includes(invoice.status);
  const isPaid = invoice.status === "paid";

  // Countdown timer
  useEffect(() => {
    if (!qrData) return;
    const expiresAt = new Date(qrData.expires_at).getTime();
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, expiresAt - Date.now());
      setTimeLeft(Math.floor(remaining / 1000));
      if (remaining <= 0) {
        setQrExpired(true);
        clearInterval(timerRef.current!);
        stopPolling();
      }
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [qrData]);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
  };

  // Poll for payment status
  const startPolling = (invId: number) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/billing/invoices/`);
        const updated = (data as Invoice[]).find((i: Invoice) => i.id === invId);
        if (updated && updated.status === "paid") {
          stopPolling();
          onUpdate(updated);
        }
      } catch { /* ignore poll errors */ }
    }, 5000);
  };

  useEffect(() => () => { stopPolling(); }, []);

  const handleCashConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post(`/billing/invoices/${invoice.id}/mark-cash-paid/`);
      onUpdate({ ...invoice, ...data });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to record cash payment");
      setMode("choice");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQR = async () => {
    setLoading(true);
    setError(null);
    setQrExpired(false);
    try {
      const { data } = await api.post(`/billing/invoices/${invoice.id}/generate-payment-link/`);
      setQrData({
        url: data.short_url || data.payment_link_url,
        expires_at: data.expires_at,
        minutes_remaining: data.minutes_remaining,
      });
      setTimeLeft((data.minutes_remaining || 24 * 60) * 60);
      setMode("qr");
      startPolling(invoice.id);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to generate QR code");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Invoice INV-{invoice.id.toString().padStart(4, "0")}</h2>
            <p className="text-sm text-gray-500">{invoice.patient_name} · ₹{parseFloat(invoice.total_amount).toFixed(2)}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex gap-2 items-start text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {isPaid && (
            <div className="text-center py-6">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="font-bold text-gray-900 text-lg">
                ₹{parseFloat(invoice.total_amount).toFixed(2)} Paid
              </p>
              <p className="text-sm text-gray-500 mt-1 capitalize">
                via {invoice.payment_method}
                {invoice.paid_at ? ` · ${new Date(invoice.paid_at).toLocaleDateString()}` : ""}
              </p>
            </div>
          )}

          {isActionable && mode === "choice" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 font-medium mb-5">How is the patient paying?</p>

              <button
                onClick={() => setMode("confirming-cash")}
                disabled={loading}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-transparent bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100 transition-all group"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <Banknote className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900 text-sm">Mark paid — cash</p>
                  <p className="text-xs text-gray-500 mt-0.5">Record physical cash received</p>
                </div>
              </button>

              <button
                onClick={handleGenerateQR}
                disabled={loading}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-transparent bg-blue-50 hover:border-blue-300 hover:bg-blue-100 transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                  {loading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <QrCode className="w-6 h-6 text-white" />}
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900 text-sm">Generate QR code</p>
                  <p className="text-xs text-gray-500 mt-0.5">Patient pays via UPI — auto-detected</p>
                </div>
              </button>
            </div>
          )}

          {mode === "confirming-cash" && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <p className="font-bold">Confirm cash payment received</p>
                <p className="mt-1">₹{parseFloat(invoice.total_amount).toFixed(2)} from {invoice.patient_name}?</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setMode("choice")}
                  className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCashConfirm}
                  disabled={loading}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "✓ Cash payment of ₹" + parseFloat(invoice.total_amount).toFixed(2) + " recorded"}
                </button>
              </div>
            </div>
          )}

          {mode === "qr" && qrData && (
            <div className="text-center space-y-4">
              {qrExpired ? (
                <div>
                  <p className="text-red-600 font-semibold mb-3">QR code expired</p>
                  <button onClick={handleGenerateQR} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700">
                    Generate new QR
                  </button>
                </div>
              ) : (
                <>
                  {/* QR Code displayed as a prominent link */}
                  <div className="bg-gray-50 rounded-2xl p-6 border-2 border-dashed border-gray-200">
                    <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                    <p className="text-xs text-gray-500 mb-2">Ask patient to scan this link or open:</p>
                    <a href={qrData.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold text-sm break-all hover:underline">
                      {qrData.url}
                    </a>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>Expires in <span className="font-bold text-amber-600 font-mono">{formatTime(timeLeft)}</span></span>
                  </div>

                  <div className="bg-blue-50 rounded-xl p-3">
                    <p className="text-xs text-blue-700 font-medium flex items-center justify-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Waiting for payment...
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReceptionistBilling() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Form state
  const [selectedPatient, setSelectedPatient] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([{ description: "Consultation Fee", amount: "" }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invRes, patRes] = await Promise.all([
        api.get("/billing/invoices/"),
        api.get("/patients/")
      ]);
      setInvoices(invRes.data);
      setPatients(patRes.data);
    } catch (e) {
      console.error("Failed to load billing data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => setItems([...items, { description: "", amount: "" }]);
  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        patient: selectedPatient,
        items: items.map(i => ({ description: i.description, amount: parseFloat(i.amount) }))
      };
      await api.post("/billing/invoices/", payload);
      setIsCreateModalOpen(false);
      setSelectedPatient("");
      setItems([{ description: "Consultation Fee", amount: "" }]);
      fetchData();
    } catch (error) {
      console.error(error);
      alert("Failed to create invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvoiceUpdate = (updated: Invoice) => {
    setInvoices(prev => prev.map(inv => inv.id === updated.id ? updated : inv));
    setSelectedInvoice(updated);
  };

  const totalDraft = items.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);

  if (loading) return <div className="p-8 text-gray-500 font-medium flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading invoices...</div>;

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Receipt className="w-6 h-6 text-blue-600" /> Clinic Billing
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage patient invoices and collect payments</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Invoice
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {invoices.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-900 font-semibold">No invoices generated yet</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Invoice</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">INV-{inv.id.toString().padStart(4, "0")}</td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">{inv.patient_name || `Patient #${inv.patient}`}</p>
                    {inv.patient_email && <p className="text-xs text-gray-400 mt-0.5">{inv.patient_email}</p>}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{new Date(inv.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="px-6 py-4 font-bold text-gray-900 font-mono">₹{parseFloat(inv.total_amount).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={inv.status} method={inv.payment_method} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    {inv.status !== "paid" && inv.status !== "cancelled" && inv.status !== "refunded" ? (
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        Collect Payment →
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payment Modal */}
      {selectedInvoice && (
        <PaymentModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onUpdate={handleInvoiceUpdate}
        />
      )}

      {/* Create Invoice Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Create New Invoice</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <form id="invoice-form" onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
                  <select
                    required
                    value={selectedPatient}
                    onChange={(e) => setSelectedPatient(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors bg-white font-medium"
                  >
                    <option value="" disabled>Search or select a patient...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>Patient #{p.id} {p.user?.email ? `(${p.user.email})` : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                    <label className="block text-sm font-bold text-gray-900">Line Items</label>
                    <button type="button" onClick={handleAddItem} className="text-xs text-blue-600 font-bold hover:text-blue-800 tracking-wide uppercase">+ Add Item</button>
                  </div>
                  <div className="space-y-3">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex gap-3 items-center group">
                        <input required type="text" placeholder="Service description" value={item.description} onChange={(e) => handleItemChange(idx, "description", e.target.value)} className="flex-1 flex-grow-[2] rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₹</span>
                          <input required type="number" min="0" step="0.01" placeholder="0.00" value={item.amount} onChange={(e) => handleItemChange(idx, "amount", e.target.value)} className="w-full rounded-xl border border-gray-200 pl-7 pr-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                        </div>
                        <button type="button" onClick={() => handleRemoveItem(idx)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-dashed border-gray-200 flex justify-between items-center text-sm font-bold">
                    <span className="text-gray-500">Draft Total:</span>
                    <span className="text-gray-900">₹{totalDraft.toFixed(2)}</span>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
              <button form="invoice-form" type="submit" disabled={isSubmitting || !selectedPatient || items.length === 0} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50">
                {isSubmitting ? "Generating..." : "Generate Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
