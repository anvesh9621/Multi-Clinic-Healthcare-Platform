"use client";

import { useState } from 'react';
import api from '@/services/api';
import {
  Receipt, CreditCard, CheckCircle2, Clock, ChevronRight,
  X, FileText, Calendar, Stethoscope, ArrowLeft, Shield,
  TrendingUp, DollarSign, ExternalLink, AlertTriangle,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type InvoiceItem = { id: number; description: string; amount: string };
type Invoice = {
  id: number;
  patient_name: string;
  patient_email: string;
  appointment_date: string | null;
  appointment_doctor: string | null;
  total_amount: string;
  amount_paid: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  issued_date: string;
  due_date: string | null;
  items: InvoiceItem[];
};

// ── Status config ─────────────────────────────────────────────────────────────
const statusConfig = {
  PAID:    { label: 'Paid',    bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2, dot: 'bg-emerald-500' },
  PENDING: { label: 'Pending', bg: 'bg-amber-100',   text: 'text-amber-700',   icon: Clock,         dot: 'bg-amber-500'   },
  FAILED:  { label: 'Failed',  bg: 'bg-red-100',     text: 'text-red-700',     icon: X,             dot: 'bg-red-500'     },
};

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [selectedInvoice, setSelected] = useState<Invoice | null>(null);
  const [payError, setPayError]        = useState('');
  const [paying, setPaying]            = useState<number | null>(null);

  const { data: invoices = [], isLoading: loading } = useQuery<Invoice[]>({
    queryKey: ['billing', 'invoices'],
    queryFn: async () => {
      const res = await api.get('/billing/invoices/');
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 60_000, // treat data as fresh for 60s
  });

  /**
   * POST /billing/invoices/{id}/pay/  →  { payment_link_url }
   * The backend generates (or reuses) a Razorpay payment link for this invoice.
   * We redirect the patient to that link to complete payment.
   */
  const handlePay = async (invoice: Invoice) => {
    setPaying(invoice.id);
    setPayError('');
    try {
      const res = await api.post(`/billing/invoices/${invoice.id}/pay/`);
      const url: string = res.data.payment_link_url || res.data.short_url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        // Invalidate so re-visiting the page picks up the updated status
        queryClient.invalidateQueries({ queryKey: ['billing', 'invoices'] });
      } else {
        setPayError('No payment link returned. Please try again.');
      }
    } catch (err: any) {
      setPayError(err?.response?.data?.error || 'Failed to generate payment link. Please try again.');
    } finally {
      setPaying(null);
    }
  };

  // KPI stats
  const totalBilled      = invoices.reduce((s, i) => s + parseFloat(i.total_amount), 0);
  const totalPaid        = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + parseFloat(i.total_amount), 0);
  const totalOutstanding = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + parseFloat(i.total_amount), 0);
  const paidCount        = invoices.filter(i => i.status === 'PAID').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Loading billing data...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Receipt className="w-6 h-6 text-blue-600" /> Billing &amp; Payments
        </h1>
        <p className="text-sm text-gray-500 mt-1">View your invoices and pay outstanding balances securely via Razorpay.</p>
      </div>

      {/* Error banner */}
      {payError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {payError}
          <button onClick={() => setPayError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { label: 'Total Billed', value: `₹${totalBilled.toFixed(2)}`,      icon: TrendingUp,  color: 'bg-blue-50 text-blue-600' },
          { label: 'Amount Paid',  value: `₹${totalPaid.toFixed(2)}`,        icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Outstanding',  value: `₹${totalOutstanding.toFixed(2)}`, icon: Clock,        color: 'bg-amber-50 text-amber-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${kpi.color}`}>
              <kpi.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{kpi.label}</p>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" /> Your Invoices
          </h2>
          <span className="text-xs text-gray-500 font-medium bg-gray-50 px-3 py-1 rounded-full">
            {paidCount}/{invoices.length} paid
          </span>
        </div>

        {invoices.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-7 h-7 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-900">No invoices yet</p>
            <p className="text-sm text-gray-500 mt-1">Your payment history will appear here after your first appointment.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {invoices.map((inv) => {
              const cfg = statusConfig[inv.status] ?? statusConfig.PENDING;
              const StatusIcon = cfg.icon;
              return (
                <div
                  key={inv.id}
                  className="px-6 py-5 flex items-center gap-5 hover:bg-gray-50/70 transition-colors cursor-pointer group"
                  onClick={() => setSelected(inv)}
                >
                  {/* Icon */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <StatusIcon className={`w-5 h-5 ${cfg.text}`} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-gray-900 text-sm">INV-{inv.id.toString().padStart(4, '0')}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(inv.issued_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {inv.appointment_doctor && (
                        <span className="flex items-center gap-1">
                          <Stethoscope className="w-3 h-3" />
                          Dr. {inv.appointment_doctor}
                        </span>
                      )}
                      <span className="text-gray-400">{inv.items.length} item{inv.items.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Amount + Pay */}
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-gray-900">₹{parseFloat(inv.total_amount).toFixed(2)}</p>
                    {inv.status !== 'PAID' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePay(inv); }}
                        disabled={paying === inv.id}
                        className="mt-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold shadow-sm shadow-blue-600/20 transition-all flex items-center gap-1.5"
                      >
                        {paying === inv.id ? (
                          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <ExternalLink className="w-3 h-3" />
                        )}
                        Pay Now
                      </button>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoice Detail Slide-over */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-end"
             onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Invoice Detail</p>
                <h3 className="text-lg font-bold text-gray-900 mt-0.5">
                  INV-{selectedInvoice.id.toString().padStart(4, '0')}
                </h3>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status */}
              {(() => {
                const cfg = statusConfig[selectedInvoice.status] ?? statusConfig.PENDING;
                return (
                  <div className={`flex items-center gap-3 p-4 rounded-xl ${cfg.bg}`}>
                    <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className={`text-sm font-bold ${cfg.text}`}>
                      {selectedInvoice.status === 'PAID'
                        ? `Paid — ₹${parseFloat(selectedInvoice.amount_paid).toFixed(2)} received`
                        : `Outstanding — ₹${parseFloat(selectedInvoice.total_amount).toFixed(2)} due`}
                    </span>
                  </div>
                );
              })()}

              {/* Meta */}
              <div className="space-y-3">
                {[
                  { label: 'Issue Date', value: new Date(selectedInvoice.issued_date).toLocaleDateString('en-IN', { dateStyle: 'long' }) },
                  selectedInvoice.due_date && { label: 'Due Date', value: new Date(selectedInvoice.due_date).toLocaleDateString('en-IN', { dateStyle: 'long' }) },
                  selectedInvoice.appointment_date && { label: 'Appointment', value: new Date(selectedInvoice.appointment_date).toLocaleDateString('en-IN', { dateStyle: 'long' }) },
                  selectedInvoice.appointment_doctor && { label: 'Doctor', value: `Dr. ${selectedInvoice.appointment_doctor}` },
                ].filter(Boolean).map((item: any) => (
                  <div key={item.label} className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">{item.label}</span>
                    <span className="font-semibold text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Line Items */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-gray-400" /> Line Items
                </h4>
                <div className="bg-gray-50 rounded-xl overflow-hidden divide-y divide-gray-100">
                  {selectedInvoice.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center px-4 py-3 text-sm">
                      <span className="text-gray-700 font-medium">{item.description}</span>
                      <span className="font-bold text-gray-900">₹{parseFloat(item.amount).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center px-4 py-3 bg-white">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="text-lg font-bold text-blue-600">₹{parseFloat(selectedInvoice.total_amount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Security note */}
              <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                Payments are processed securely via Razorpay
              </div>
            </div>

            {/* Footer CTA */}
            {selectedInvoice.status !== 'PAID' && (
              <div className="p-6 border-t border-gray-100">
                <button
                  onClick={() => { setSelected(null); handlePay(selectedInvoice); }}
                  disabled={paying === selectedInvoice.id}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Pay ₹{parseFloat(selectedInvoice.total_amount).toFixed(2)} via Razorpay
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
