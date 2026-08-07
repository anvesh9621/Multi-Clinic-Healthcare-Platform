import api from './api';

export type RefundRequest = {
  id: number;
  invoice: number;
  requested_by: number;
  requested_by_email: string;
  approved_by: number | null;
  approved_by_email: string | null;
  amount: string;
  reason: string;
  status: 'pending_approval' | 'processing' | 'completed' | 'failed' | 'rejected';
  razorpay_refund_id: string;
  created_at: string;
  processed_at: string | null;
};

export const initiateRefund = async (invoiceId: number, amount: string, reason: string) => {
  const res = await api.post('/billing/refunds/initiate/', {
    invoice_id: invoiceId,
    amount,
    reason,
  });
  return res.data as RefundRequest;
};

export const getPendingRefundApprovals = async () => {
  const res = await api.get('/billing/refunds/pending/');
  return (Array.isArray(res.data) ? res.data : []) as RefundRequest[];
};

export const approveRefundRequest = async (refundRequestId: number) => {
  const res = await api.post(`/billing/refunds/${refundRequestId}/approve/`);
  return res.data as RefundRequest;
};

export const rejectRefundRequest = async (refundRequestId: number, rejectionReason?: string) => {
  const res = await api.post(`/billing/refunds/${refundRequestId}/reject/`, {
    rejection_reason: rejectionReason || '',
  });
  return res.data as RefundRequest;
};
