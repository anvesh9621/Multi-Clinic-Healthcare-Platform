import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { RazorpayCheckoutButton } from '@/components/billing/RazorpayCheckoutButton';
import * as billingService from '@/services/billing';

vi.mock('@/services/billing', () => ({
  createRazorpayOrder: vi.fn(),
  verifyRazorpayPayment: vi.fn(),
}));

describe('RazorpayCheckoutButton Standard Web Checkout', () => {
  let mockRazorpayInstance: any;
  let mockOpen: any;
  let mockOn: any;
  let capturedOptions: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOpen = vi.fn();
    mockOn = vi.fn();

    mockRazorpayInstance = {
      open: mockOpen,
      on: mockOn,
    };

    (window as any).Razorpay = vi.fn(function (this: any, options: any) {
      capturedOptions = options;
      return mockRazorpayInstance;
    });
  });

  it('renders button with formatted amount', () => {
    render(<RazorpayCheckoutButton amountInPaise={50000} />);
    expect(screen.getByRole('button', { name: /pay ₹500\.00/i })).toBeInTheDocument();
  });

  it('validates minimum amount >= 100 paise', async () => {
    const mockOnError = vi.fn();
    render(<RazorpayCheckoutButton amountInPaise={50} onError={mockOnError} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/amount must be at least ₹1\.00/i)).toBeInTheDocument();
    });
    expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('100 paise'));
    expect(billingService.createRazorpayOrder).not.toHaveBeenCalled();
  });

  it('creates order, opens Razorpay modal, and verifies payment signature on success', async () => {
    const mockOnSuccess = vi.fn();

    vi.mocked(billingService.createRazorpayOrder).mockResolvedValueOnce({
      success: true,
      order_id: 'order_test_777',
      amount: 50000,
      currency: 'INR',
      key_id: 'rzp_test_TQ9TQdaGO2avyV',
    });

    vi.mocked(billingService.verifyRazorpayPayment).mockResolvedValueOnce({
      success: true,
      message: 'Payment verified successfully',
      order_id: 'order_test_777',
      payment_id: 'pay_test_888',
    });

    render(
      <RazorpayCheckoutButton
        amountInPaise={50000}
        prefill={{ name: 'Alice', email: 'alice@example.com', contact: '9876543210' }}
        onSuccess={mockOnSuccess}
      />
    );

    const button = screen.getByRole('button', { name: /pay ₹500\.00/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(billingService.createRazorpayOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50000,
          currency: 'INR',
        })
      );
    });

    expect((window as any).Razorpay).toHaveBeenCalled();
    expect(capturedOptions.order_id).toBe('order_test_777');
    expect(capturedOptions.amount).toBe(50000);
    expect(capturedOptions.prefill.name).toBe('Alice');
    expect(mockOpen).toHaveBeenCalledTimes(1);

    // Simulate Razorpay handler callback (successful payment by customer)
    await React.act(async () => {
      await capturedOptions.handler({
        razorpay_order_id: 'order_test_777',
        razorpay_payment_id: 'pay_test_888',
        razorpay_signature: 'valid_signature_hash',
      });
    });

    await waitFor(() => {
      expect(billingService.verifyRazorpayPayment).toHaveBeenCalledWith({
        razorpay_order_id: 'order_test_777',
        razorpay_payment_id: 'pay_test_888',
        razorpay_signature: 'valid_signature_hash',
        invoice_id: undefined,
      });
    });

    expect(mockOnSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        payment_id: 'pay_test_888',
      })
    );
  });

  it('handles order creation backend error gracefully', async () => {
    const mockOnError = vi.fn();

    vi.mocked(billingService.createRazorpayOrder).mockRejectedValueOnce({
      response: { data: { error: 'Razorpay API rate limit exceeded' } },
    });

    render(<RazorpayCheckoutButton amountInPaise={100000} onError={mockOnError} />);

    const button = screen.getByRole('button', { name: /pay ₹1,000\.00/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/razorpay api rate limit exceeded/i)).toBeInTheDocument();
    });
    expect(mockOnError).toHaveBeenCalledWith('Razorpay API rate limit exceeded');
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
