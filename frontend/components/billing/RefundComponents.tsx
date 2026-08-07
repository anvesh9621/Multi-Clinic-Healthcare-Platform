"use client";

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import {
  RefreshCw, CheckCircle2, Clock, AlertCircle, XCircle, ArrowLeftRight,
  ShieldCheck, Loader2, FileText, User, DollarSign
} from 'lucide-react';
import {
  RefundRequest, initiateRefund, getPendingRefundApprovals,
  approveRefundRequest, rejectRefundRequest
} from '@/services/billing';

interface RequestRefundModalProps {
  invoice: {
    id: number;
    total_amount: string;
    patient_name?: string;
    status: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RequestRefundModal({ invoice, isOpen, onClose, onSuccess }: RequestRefundModalProps) {
  const [amount, setAmount] = useState(parseFloat(invoice.total_amount).toFixed(2));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultRequest, setResultRequest] = useState<RefundRequest | null>(null);

  useEffect(() => {
    setAmount(parseFloat(invoice.total_amount).toFixed(2));
    setReason('');
    setError(null);
    setResultRequest(null);
  }, [invoice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await initiateRefund(invoice.id, amount, reason);
      setResultRequest(res);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to initiate refund request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Request Refund — INV-${invoice.id.toString().padStart(4, '0')}`}>
      {resultRequest ? (
        <div className="space-y-6 py-2">
          {resultRequest.status === 'processing' || resultRequest.status === 'completed' ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <span className="inline-block px-3 py-1 bg-emerald-600 text-white font-bold text-xs rounded-full uppercase tracking-wider">
                Refund Processed
              </span>
              <h3 className="text-lg font-bold text-gray-900">Refund of ₹{resultRequest.amount} Initiated</h3>
              <p className="text-sm text-gray-600">
                The refund was auto-approved and submitted directly to Razorpay for processing.
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600">
                <Clock className="w-7 h-7" />
              </div>
              <span className="inline-block px-3 py-1 bg-amber-600 text-white font-bold text-xs rounded-full uppercase tracking-wider">
                Pending Clinic Admin Approval
              </span>
              <h3 className="text-lg font-bold text-gray-900">Request of ₹{resultRequest.amount} Submitted</h3>
              <p className="text-sm text-gray-600">
                Since this refund amount exceeds the instant threshold, it has been routed to your Clinic Admin for review and approval.
              </p>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Request ID:</span>
              <span className="font-bold text-gray-900">#{resultRequest.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Invoice:</span>
              <span className="font-bold text-gray-900">INV-{invoice.id.toString().padStart(4, '0')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Reason:</span>
              <span className="font-semibold text-gray-900">{resultRequest.reason || 'None specified'}</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 flex items-center gap-3 text-xs text-blue-800">
            <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-bold">Original Paid Amount: ₹{parseFloat(invoice.total_amount).toFixed(2)}</p>
              <p className="text-blue-600 mt-0.5">Refunds under ₹500 or created by Clinic Admin are auto-approved instantly.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Refund Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">₹</span>
              <input
                type="number"
                step="0.01"
                min="1.00"
                max={parseFloat(invoice.total_amount)}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-gray-200 pl-8 pr-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Defaulted to full remaining balance. Edit for a partial refund.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Reason for Refund
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Appointment cancelled by patient, service issue..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !amount || !reason}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Initiating...
                </span>
              ) : (
                'Submit Refund Request'
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function PendingRefundApprovalsList() {
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const data = await getPendingRefundApprovals();
      setRequests(data);
    } catch (e) {
      console.error('Failed to load pending refund approvals', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id: number) => {
    setActionLoading(id);
    setMsg(null);
    try {
      await approveRefundRequest(id);
      setMsg({ type: 'success', text: `Refund request #${id} approved and sent to Razorpay!` });
      fetchPending();
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.error || 'Failed to approve refund request.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionLoading(id);
    setMsg(null);
    try {
      await rejectRefundRequest(id, rejectionReason);
      setMsg({ type: 'success', text: `Refund request #${id} rejected.` });
      setRejectingId(null);
      setRejectionReason('');
      fetchPending();
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.error || 'Failed to reject refund request.' });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              Pending Refund Approvals
              {requests.length > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                  {requests.length} pending
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500">Review refund requests submitted by receptionists exceeding auto-threshold</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchPending} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {msg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
            msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />}
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Loading pending approvals...
        </div>
      ) : requests.length === 0 ? (
        <div className="py-10 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
          <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-800">All clear — No pending approvals</p>
          <p className="text-xs text-gray-500 mt-0.5">Refund requests requiring Clinic Admin authorization will appear here.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice &amp; Patient</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((req) => (
              <TableRow key={req.id}>
                <TableCell>
                  <p className="font-bold text-gray-900 text-sm">INV-{req.invoice.toString().padStart(4, '0')}</p>
                  <span className="text-[11px] text-gray-400 font-mono">
                    {new Date(req.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </TableCell>
                <TableCell>
                  <p className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                    <User className="w-3 h-3 text-gray-400" /> {req.requested_by_email || `User #${req.requested_by}`}
                  </p>
                </TableCell>
                <TableCell>
                  <span className="font-bold text-sm text-gray-900 font-mono">₹{parseFloat(req.amount).toFixed(2)}</span>
                </TableCell>
                <TableCell>
                  <p className="text-xs text-gray-600 max-w-xs truncate" title={req.reason}>
                    {req.reason}
                  </p>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    disabled={actionLoading === req.id}
                    onClick={() => handleApprove(req.id)}
                  >
                    {actionLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approve'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-red-600 hover:bg-red-50 text-xs"
                    disabled={actionLoading === req.id}
                    onClick={() => { setRejectingId(req.id); setRejectionReason(''); }}
                  >
                    Reject
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Reject Modal Prompt */}
      {rejectingId && (
        <Modal
          isOpen={true}
          onClose={() => setRejectingId(null)}
          title={`Reject Refund Request #${rejectingId}`}
          className="max-w-md"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 font-medium">
              Please enter an optional reason for rejecting this refund request. The requester will be notified.
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Refund policy time limit expired..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setRejectingId(null)}>
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={actionLoading === rejectingId}
                onClick={() => handleReject(rejectingId)}
              >
                {actionLoading === rejectingId ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}

export { PendingRefundApprovalsList as PendingRefundsList };

