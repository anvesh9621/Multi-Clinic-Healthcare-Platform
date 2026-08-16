"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { RazorpayCheckoutButton } from "@/components/billing/RazorpayCheckoutButton";
import {
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  Lock,
  Sparkles,
  Info,
  Building2,
  Calendar,
} from "lucide-react";
import { VerifyPaymentResponse } from "@/services/billing";

export default function CheckoutPage() {
  const [amountRupees, setAmountRupees] = useState<number>(500);
  const [customerName, setCustomerName] = useState<string>("John Doe");
  const [customerEmail, setCustomerEmail] = useState<string>("patient@example.com");
  const [customerPhone, setCustomerPhone] = useState<string>("9876543210");
  const [notesDescription, setNotesDescription] = useState<string>("Consultation & Medical Care Fee");

  const [paymentSuccessData, setPaymentSuccessData] = useState<VerifyPaymentResponse | null>(null);

  const amountInPaise = Math.round(amountRupees * 100);

  const presetAmounts = [100, 500, 1500, 2500, 5000];

  return (
    <div className="min-h-screen bg-warm-surface/40 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div className="max-w-xl w-full space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Razorpay Standard Web Checkout
          </div>
          <h1 className="text-3xl font-bold text-ink heading-font tracking-tight">
            Secure Payment Gateway
          </h1>
          <p className="text-sm text-muted">
            Complete your healthcare consultation or clinic invoice payment securely.
          </p>
        </div>

        {/* Success Confirmation Card */}
        {paymentSuccessData && (
          <Card className="p-6 border-emerald-300 bg-emerald-50/80 shadow-md">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="text-lg font-bold text-emerald-900 heading-font">
                  Payment Verified Successfully!
                </h3>
                <p className="text-xs text-emerald-800">
                  Your Razorpay payment signature was verified by the server HMAC-SHA256 protocol.
                </p>
                <div className="bg-paper p-3 rounded-lg border border-emerald-200 text-xs font-mono space-y-1 text-ink">
                  <div>
                    <span className="text-muted">Payment ID: </span>
                    <strong className="text-emerald-700">{paymentSuccessData.payment_id}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Order ID: </span>
                    <strong className="text-primary">{paymentSuccessData.order_id}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Amount: </span>
                    <strong>₹{amountRupees.toLocaleString("en-IN")}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentSuccessData(null)}
                  className="text-xs font-bold text-emerald-800 underline hover:text-emerald-950 pt-1"
                >
                  Make another payment &rarr;
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Checkout Configuration Card */}
        <Card className="p-6 sm:p-8 space-y-6 shadow-xl border-border">
          {/* Preset Amount Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
              Select Amount (INR)
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmountRupees(preset)}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border transition ${
                    amountRupees === preset
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-paper text-ink border-border hover:border-primary/50"
                  }`}
                >
                  ₹{preset}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-bold">
                ₹
              </span>
              <Input
                type="number"
                min={1}
                step={1}
                value={amountRupees || ""}
                onChange={(e) => setAmountRupees(Number(e.target.value))}
                placeholder="Enter custom amount"
                className="pl-8 font-semibold text-base"
              />
            </div>
          </div>

          {/* Customer / Patient Details */}
          <div className="space-y-4 pt-2 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary" /> Patient / Payer Details
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Full Name
                </label>
                <Input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Phone Number
                </label>
                <Input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="9876543210"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Email Address
              </label>
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="patient@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Description / Notes
              </label>
              <Input
                type="text"
                value={notesDescription}
                onChange={(e) => setNotesDescription(e.target.value)}
                placeholder="Appointment consultation fee"
              />
            </div>
          </div>

          {/* Order Summary & Checkout Button */}
          <div className="pt-4 border-t border-border space-y-4">
            <div className="flex justify-between items-center bg-warm-surface/60 p-4 rounded-xl border border-border">
              <div>
                <p className="text-xs font-semibold text-muted">Total Payable</p>
                <p className="text-2xl font-bold text-ink heading-font">
                  ₹{amountRupees.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                  <Lock className="w-3 h-3" /> 256-bit SSL
                </span>
              </div>
            </div>

            <RazorpayCheckoutButton
              amountInPaise={amountInPaise}
              currency="INR"
              prefill={{
                name: customerName,
                email: customerEmail,
                contact: customerPhone,
              }}
              notes={{
                description: notesDescription,
                customer_name: customerName,
              }}
              description={notesDescription}
              buttonText={`Pay ₹${amountRupees.toLocaleString("en-IN")} with Razorpay`}
              className="w-full h-12 text-base"
              onSuccess={(res) => setPaymentSuccessData(res)}
            />
          </div>

          {/* Test Mode Note */}
          <div className="flex items-start gap-2 text-xs text-muted bg-blue-50/60 border border-blue-200/70 p-3 rounded-xl">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-blue-950 font-semibold">Razorpay Test Mode Active</p>
              <p className="text-blue-800">
                You can test with any Razorpay test cards, Netbanking simulation, or UPI apps in the popup modal.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
