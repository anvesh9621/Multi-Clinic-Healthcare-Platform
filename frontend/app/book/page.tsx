"use client";

import { useBooking } from "./layout";
import { ArrowRight, CalendarHeart } from "lucide-react";
import ClinicSelector from "./components/ClinicSelector";
import DoctorSelector from "./components/DoctorSelector";
import SlotSelector from "./components/SlotSelector";
import PaymentStep from "./components/PaymentStep";

export default function BookingWizardPage() {
  const { state, goToStep } = useBooking();

  if (state.step === 2) return <ClinicSelector />;
  if (state.step === 3) return <DoctorSelector />;
  if (state.step === 4) return <SlotSelector />;
  if (state.step === 5) return <PaymentStep />;

  // Default Step 1: Landing
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="w-20 h-20 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center mb-6">
        <CalendarHeart className="w-10 h-10" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Book an Appointment</h1>
      <p className="text-gray-500 mb-8 max-w-md">
        Schedule your next visit in just a few clicks. Select a clinic, choose your doctor, and pick a time that works for you.
      </p>
      
      <button
        onClick={() => goToStep(2)}
        className="flex items-center gap-2 bg-violet-600 text-white px-8 py-3.5 rounded-full font-bold text-lg hover:bg-violet-700 transition-all hover:scale-105 shadow-lg shadow-violet-200"
      >
        Get Started <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}
