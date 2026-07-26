"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import api from "@/services/api";

function PaymentStatusContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"polling" | "confirmed" | "timeout">("polling");
  const [message, setMessage] = useState("Verifying your payment...");

  useEffect(() => {
    const appointmentIdParam = searchParams.get("appointment_id");
    const appointmentId = appointmentIdParam || sessionStorage.getItem("pending_appointment_id");

    if (!appointmentId) {
      router.replace("/dashboard");
      return;
    }

    sessionStorage.removeItem("pending_appointment_id");

    let pollCount = 0;
    const MAX_POLLS = 40;

    const interval = setInterval(async () => {
      pollCount++;
      try {
        const { data } = await api.get(`/appointments/${appointmentId}/`);
        if (data.status === "CONFIRMED") {
          clearInterval(interval);
          setStatus("confirmed");
          setTimeout(() => {
            router.push("/dashboard/patient/appointments?booked=true");
          }, 2000);
        }
      } catch (err) {
        console.error("Polling error", err);
      }

      if (pollCount >= MAX_POLLS) {
        clearInterval(interval);
        setStatus("timeout");
        setMessage("Payment received. Appointment confirming — you'll receive a notification shortly.");
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-surface/30 px-4">
      <div className="bg-paper rounded-2xl shadow-xl p-10 max-w-sm w-full text-center border border-border">
        {status === "polling" && (
          <>
            <Loader2 className="w-14 h-14 text-primary animate-spin mx-auto mb-5" />
            <h1 className="text-xl font-bold text-ink mb-2 heading-font">Confirming your appointment</h1>
            <p className="text-muted text-sm">{message}</p>
          </>
        )}

        {status === "confirmed" && (
          <>
            <CheckCircle className="w-14 h-14 text-emerald-600 mx-auto mb-5" />
            <h1 className="text-xl font-bold text-ink mb-2 heading-font">Appointment Confirmed!</h1>
            <p className="text-muted text-sm">Redirecting to your appointments...</p>
          </>
        )}

        {status === "timeout" && (
          <>
            <AlertCircle className="w-14 h-14 text-amber-500 mx-auto mb-5" />
            <h1 className="text-xl font-bold text-ink mb-2 heading-font">Payment Received</h1>
            <p className="text-muted text-sm mb-6">{message}</p>
            <button
              onClick={() => router.push("/dashboard/patient/appointments")}
              className="w-full py-3 bg-primary text-paper font-bold rounded-xl hover:bg-primary-dark transition-colors"
            >
              Go to Appointments
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentStatusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-warm-surface/30">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PaymentStatusContent />
    </Suspense>
  );
}
