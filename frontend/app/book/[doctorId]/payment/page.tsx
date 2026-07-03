"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/services/api";
import { Stethoscope, CalendarDays, Clock, CreditCard, Building2, Loader2, AlertTriangle } from "lucide-react";

import { use } from "react";

interface DoctorClinicInfo {
  id: number;
  doctor_name: string;
  specialty: string;
  consultation_fee: number;
  clinic_name: string;
}

export default function PaymentStepPage({ params, searchParams }: { params: Promise<{ doctorId: string }>, searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const router = useRouter();
  
  // Unwrap Next.js 15 async params and searchParams
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);

  const date = (resolvedSearchParams.date as string) || "";
  const startTime = (resolvedSearchParams.start_time as string) || "";
  const endTime = (resolvedSearchParams.end_time as string) || "";
  const reason = (resolvedSearchParams.reason as string) || "";
  const doctorClinicId = resolvedParams.doctorId;

  const [docInfo, setDocInfo] = useState<DoctorClinicInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [submitting, setSubmitting] = useState<"pay_now" | "pay_clinic" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch doctor-clinic info to show fee and name
    api.get(`/appointments/doctor-clinics/${doctorClinicId}/`)
      .then(res => setDocInfo(res.data))
      .catch(() => {
        // If endpoint doesn't exist yet, use placeholder so page still works
        setDocInfo({
          id: parseInt(doctorClinicId),
          doctor_name: "Your Doctor",
          specialty: "",
          consultation_fee: 0,
          clinic_name: "Clinic",
        });
      })
      .finally(() => setLoadingInfo(false));
  }, [doctorClinicId]);

  const handleBook = async (payNow: boolean) => {
    setError(null);
    setSubmitting(payNow ? "pay_now" : "pay_clinic");

    try {
      const { data } = await api.post("/appointments/", {
        doctor_clinic_id: parseInt(doctorClinicId),
        appointment_date: date,
        start_time: startTime,
        end_time: endTime,
        reason,
        pay_now: payNow,
      });

      if (data.pay_now_unavailable) {
        // Backend fell back to pay-at-clinic gracefully
        router.push("/dashboard/patient/appointments?booked=true&pay=clinic");
        return;
      }

      if (data.payment_required && data.payment_link_url) {
        // Store appointment ID for the callback page polling
        sessionStorage.setItem("pending_appointment_id", String(data.appointment_id));
        // Show brief "opening payment page..." state, then redirect
        window.location.href = data.payment_link_url;
        return;
      }

      // pay_at_clinic path
      router.push("/dashboard/patient/appointments?booked=true&pay=clinic");
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error || "Booking failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(null);
    }
  };

  if (loadingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const fee = docInfo?.consultation_fee ?? 0;
  const formattedDate = date ? new Date(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-6">

        {/* Appointment Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Dr. {docInfo?.doctor_name}</h2>
              {docInfo?.specialty && <p className="text-sm text-gray-500">{docInfo.specialty}</p>}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  {docInfo?.clinic_name}
                </div>
                {date && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CalendarDays className="w-4 h-4 text-gray-400" />
                    {formattedDate}
                  </div>
                )}
                {startTime && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {startTime}
                  </div>
                )}
              </div>
            </div>
          </div>
          {fee > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Consultation fee</span>
              <span className="text-xl font-black text-gray-900 font-mono">₹{fee.toFixed(2)}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Pay Now card */}
        <div className="bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20 p-6 text-white">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Pay ₹{fee > 0 ? fee.toFixed(2) : "..."} now</h3>
              <p className="text-blue-200 text-sm mt-0.5">Appointment confirmed instantly</p>
              <p className="text-blue-200 text-sm">Secure payment via Razorpay · UPI / Card / Net Banking</p>
            </div>
          </div>
          <button
            onClick={() => handleBook(true)}
            disabled={submitting !== null}
            className="w-full py-3.5 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting === "pay_now" ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Opening payment page...</>
            ) : (
              `Pay ₹${fee > 0 ? fee.toFixed(2) : "..."} →`
            )}
          </button>
        </div>

        {/* Pay at clinic card */}
        <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900">Pay at the clinic</h3>
              <p className="text-gray-500 text-sm mt-0.5">Cash or UPI on arrival</p>
              <p className="text-gray-500 text-sm">Slot reserved · Pay when you arrive</p>
            </div>
          </div>
          <button
            onClick={() => handleBook(false)}
            disabled={submitting !== null}
            className="w-full py-3.5 bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-xl hover:bg-gray-100 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting === "pay_clinic" ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Reserving slot...</>
            ) : (
              "Reserve slot →"
            )}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400">
          Your slot is reserved for 30 minutes when paying online. Payments are processed securely via Razorpay.
        </p>
      </div>
    </div>
  );
}
