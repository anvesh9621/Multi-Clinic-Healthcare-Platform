"use client";

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { CheckoutForm } from '@/components/billing/CheckoutForm';
import api from '@/services/api';

// Use standard stripe demo key for test mode
const stripePromise = loadStripe('pk_test_TYooMQauvdEDq54NiTphI7jx');

export default function BillingPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingInvoice, setPayingInvoice] = useState<any | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/billing/invoices/');
      setInvoices(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (invoice: any) => {
    setPayingInvoice(invoice);
    try {
      const res = await api.post(`/billing/invoices/${invoice.id}/create-payment-intent/`);
      setClientSecret(res.data.clientSecret);
    } catch (e) {
      console.error(e);
      alert("Failed to initialize payment");
      setPayingInvoice(null);
    }
  };

  if (loading) return <div className="p-8 text-gray-500 font-medium">Loading billing data safely...</div>;

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Billing & Payments</h1>
      
      {payingInvoice && clientSecret ? (
        <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <button 
            onClick={() => { setPayingInvoice(null); setClientSecret(null); }}
            className="mb-8 text-sm text-blue-600 font-semibold hover:text-blue-800 transition-colors"
          >
            &larr; Back to all invoices
          </button>
          
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">Complete Payment</h2>
            <p className="text-gray-500 mt-2 text-sm">Amount due: <span className="text-gray-900 font-bold ml-1">${payingInvoice.total_amount}</span></p>
          </div>
          
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm 
              clientSecret={clientSecret} 
              onSuccess={() => {
                alert("Payment successful! Your invoice has been marked as PAID.");
                setPayingInvoice(null);
                setClientSecret(null);
                fetchInvoices();
              }} 
            />
          </Elements>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {invoices.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                 <span className="text-2xl">💳</span>
              </div>
              <p className="text-gray-900 font-semibold">No invoices found</p>
              <p className="text-sm text-gray-500 mt-1">You are all caught up on your payments.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Invoice ID</th>
                  <th className="px-6 py-4">Date Issued</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 font-bold text-gray-900">INV-{inv.id.toString().padStart(4, '0')}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{new Date(inv.issued_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">${inv.total_amount}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase ${
                        inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {inv.status !== 'PAID' && (
                        <button 
                          onClick={() => handlePay(inv)}
                          className="text-white bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-xl font-bold shadow-sm shadow-blue-600/20 transition-all text-xs"
                        >
                          Pay Now
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
