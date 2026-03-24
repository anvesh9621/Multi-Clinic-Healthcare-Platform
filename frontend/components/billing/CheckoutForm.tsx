"use client";

import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

export function CheckoutForm({ clientSecret, onSuccess }: { clientSecret: string, onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard/billing?status=success`,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message ?? 'An unknown error occurred with your payment.');
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess();
    }
    
    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <PaymentElement />
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium">
            {errorMessage}
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-md transition-all shadow-blue-600/20"
      >
        {isProcessing ? "Processing Securely..." : "Pay Now"}
      </button>
    </form>
  );
}
