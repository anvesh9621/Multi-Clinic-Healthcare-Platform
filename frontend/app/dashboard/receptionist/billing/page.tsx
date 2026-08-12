"use client";

import { useState, useEffect, useRef, useContext } from "react";
import { Plus, Receipt, FileText, Trash2, X, Banknote, QrCode, CheckCircle, Clock, AlertCircle, Loader2, RotateCcw } from "lucide-react";
import api from "@/services/api";
import { AuthContext } from "@/context/AuthContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { RequestRefundModal, PendingRefundsList } from "@/components/billing/RefundComponents";

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

function PaymentModal({
  invoice,
  onClose,
  onUpdate,
  onRequestRefund
}: {
  invoice: Invoice;
  onClose: () => void;
  onUpdate: (inv: Invoice) => void;
  onRequestRefund: (inv: Invoice) => void;
}) {
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
        const items = Array.isArray(data) ? data : (data?.results || []);
        const updated = (items as Invoice[]).find((i: Invoice) => i.id === invId);
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
    <Modal
      isOpen
      onClose={onClose}
      title={`Invoice INV-${invoice.id.toString().padStart(4, "0")}`}
      className="max-w-md"
    >
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex gap-2 items-start text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {isPaid && (
            <div className="text-center py-6">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="font-bold text-ink text-lg">
                ₹{parseFloat(invoice.total_amount).toFixed(2)} Paid
              </p>
              <p className="text-sm text-gray-500 mt-1 capitalize">
                via {invoice.payment_method}
                {invoice.paid_at ? ` · ${new Date(invoice.paid_at).toLocaleDateString()}` : ""}
              </p>
              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onRequestRefund(invoice);
                  }}
                  className="text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-bold"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Request Refund
                </Button>
              </div>
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
                  <p className="font-bold text-ink text-sm">Mark paid — cash</p>
                  <p className="text-xs text-gray-500 mt-0.5">Record physical cash received</p>
                </div>
              </button>

              <button
                onClick={handleGenerateQR}
                disabled={loading}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-transparent bg-blue-50 hover:border-blue-300 hover:bg-blue-100 transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                  {loading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <QrCode className="w-6 h-6 text-white" />}
                </div>
                <div className="text-left">
                  <p className="font-bold text-ink text-sm">Generate QR code</p>
                  <p className="text-xs text-muted mt-0.5">Patient pays via UPI — auto-detected</p>
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
                  <Button size="sm" onClick={handleGenerateQR}>
                    Generate new QR
                  </Button>
                </div>
              ) : (
                <>
                  {/* QR Code displayed as a prominent link */}
                  <div className="bg-gray-50 rounded-2xl p-6 border-2 border-dashed border-gray-200">
                    <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                    <p className="text-xs text-gray-500 mb-2">Ask patient to scan this link or open:</p>
                    <a href={qrData.url} target="_blank" rel="noopener noreferrer" className="text-primary font-bold text-sm break-all hover:underline">
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
    </Modal>
  );
}

import { Patient } from "@/types/api";

export default function ReceptionistBilling() {
  const { user } = useContext(AuthContext);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [refundModalInvoice, setRefundModalInvoice] = useState<Invoice | null>(null);

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
      setInvoices(Array.isArray(invRes.data) ? invRes.data : (invRes.data?.results || []));
      setPatients(Array.isArray(patRes.data) ? patRes.data : (patRes.data?.results || []));
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
          <h1 className="text-3xl font-bold text-ink heading-font flex items-center gap-3">
            <Receipt className="w-6 h-6 text-primary" /> Clinic Billing
          </h1>
          <p className="text-sm text-muted mt-1">Manage patient invoices, collect payments, and manage refunds</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Invoice
        </Button>
      </div>

      {/* Pending Refund Approvals (Visible to Clinic Admins & Staff) */}
      {(user?.role === "CLINIC_ADMIN" || user?.role === "RECEPTIONIST" || user?.role === "SUPER_ADMIN") && (
        <div className="mb-8">
          <PendingRefundsList />
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-16 text-center">
                <div className="w-16 h-16 bg-warm-surface rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-muted" />
                </div>
                <p className="text-ink font-semibold">No invoices generated yet</p>
              </TableCell>
            </TableRow>
          ) : (
            invoices.map(inv => (
              <TableRow key={inv.id}>
                <TableCell className="font-bold">INV-{inv.id.toString().padStart(4, "0")}</TableCell>
                <TableCell>
                  <p className="font-semibold text-ink">{inv.patient_name || `Patient #${inv.patient}`}</p>
                  {inv.patient_email && <p className="text-xs text-muted mt-0.5">{inv.patient_email}</p>}
                </TableCell>
                <TableCell className="text-muted">{new Date(inv.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</TableCell>
                <TableCell className="font-bold font-mono">₹{parseFloat(inv.total_amount).toFixed(2)}</TableCell>
                <TableCell><StatusBadge status={inv.status} method={inv.payment_method} /></TableCell>
                <TableCell className="text-right">
                  {inv.status === "paid" ? (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(inv)} className="text-muted">
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRefundModalInvoice(inv)}
                        className="text-amber-600 hover:text-amber-700 font-medium"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Refund
                      </Button>
                    </div>
                  ) : inv.status !== "cancelled" && inv.status !== "refunded" ? (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(inv)} className="text-primary font-bold">
                      Collect Payment →
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(inv)} className="text-muted">
                      View
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Payment Modal */}
      {selectedInvoice && (
        <PaymentModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onUpdate={handleInvoiceUpdate}
          onRequestRefund={(inv) => setRefundModalInvoice(inv)}
        />
      )}

      {/* Refund Modal */}
      {refundModalInvoice && (
        <RequestRefundModal
          invoice={refundModalInvoice}
          isOpen={true}
          onClose={() => setRefundModalInvoice(null)}
          onSuccess={fetchData}
        />
      )}

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Invoice">
        <form id="invoice-form" onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-ink mb-2">Select Patient</label>
            <select
              required
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="w-full rounded-xl border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors bg-white font-medium text-ink"
            >
              <option value="" disabled>Search or select a patient...</option>
              {patients.map((p: any) => (
                <option key={p.id} value={p.id}>Patient #{p.id} {p.user?.email ? `(${p.user.email})` : p.email ? `(${p.email})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
              <label className="block text-sm font-bold text-ink">Line Items</label>
              <button type="button" onClick={handleAddItem} className="text-xs text-primary font-bold hover:text-primary-dark tracking-wide uppercase">+ Add Item</button>
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-center group">
                  <input required type="text" placeholder="Service description" value={item.description} onChange={(e) => handleItemChange(idx, "description", e.target.value)} className="flex-1 flex-grow-[2] rounded-xl border border-border px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm font-bold">₹</span>
                    <input required type="number" min="0" step="0.01" placeholder="0.00" value={item.amount} onChange={(e) => handleItemChange(idx, "amount", e.target.value)} className="w-full rounded-xl border border-border pl-7 pr-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                  <button type="button" onClick={() => handleRemoveItem(idx)} className="text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-dashed border-border flex justify-between items-center text-sm font-bold">
              <span className="text-muted">Draft Total:</span>
              <span className="text-ink">₹{totalDraft.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !selectedPatient || items.length === 0}>
              {isSubmitting ? "Generating..." : "Generate Invoice"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

