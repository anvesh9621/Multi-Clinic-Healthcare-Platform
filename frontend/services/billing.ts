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
  const items = Array.isArray(res.data) ? res.data : (res.data?.results || []);
  return items as RefundRequest[];
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

// ── Razorpay Standard Web Checkout API ────────────────────────────────────────

export interface CreateOrderPayload {
  amount: number; // in paise (e.g. 50000 for ₹500.00)
  currency?: string;
  receipt?: string;
  notes?: Record<string, any>;
  invoice_id?: number | string;
}

export interface CreateOrderResponse {
  success: boolean;
  order_id: string;
  amount: number;
  currency: string;
  key_id?: string;
  receipt?: string;
  notes?: Record<string, any>;
  error?: string;
}

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  invoice_id?: number | string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message: string;
  order_id: string;
  payment_id: string;
  invoice_id?: number | null;
  error?: string;
}

export const createRazorpayOrder = async (payload: CreateOrderPayload): Promise<CreateOrderResponse> => {
  const res = await api.post('/billing/create-order/', payload);
  return res.data;
};

export const verifyRazorpayPayment = async (payload: VerifyPaymentPayload): Promise<VerifyPaymentResponse> => {
  const res = await api.post('/billing/verify-payment/', payload);
  return res.data;
};
