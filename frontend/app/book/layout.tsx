"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import StepIndicator from "./components/StepIndicator";

export interface BookingState {
  step: number;
  clinicId: number | null;
  clinicName: string | null;
  doctorId: number | null;
  doctorClinicId: number | null;
  doctorName: string | null;
  specialty: string | null;
  date: string | null;
  timeSlot: string | null;
  consultationFee: number | null;
}

interface BookingContextType {
  state: BookingState;
  updateState: (updates: Partial<BookingState>) => void;
  resetState: () => void;
  goToStep: (step: number) => void;
}

const initialState: BookingState = {
  step: 1,
  clinicId: null,
  clinicName: null,
  doctorId: null,
  doctorClinicId: null,
  doctorName: null,
  specialty: null,
  date: null,
  timeSlot: null,
  consultationFee: null,
};

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function useBooking() {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error("useBooking must be used within a BookingProvider");
  }
  return context;
}

export default function BookLayout({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookingState>(initialState);

  const updateState = (updates: Partial<BookingState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const resetState = () => {
    setState(initialState);
  };

  const goToStep = (step: number) => {
    setState((prev) => {
      const updates: Partial<BookingState> = { step };
      if (step < 5) {
        updates.timeSlot = null;
      }
      if (step < 4) {
        updates.date = null;
        updates.consultationFee = null;
      }
      if (step < 3) {
        updates.doctorId = null;
        updates.doctorClinicId = null;
        updates.doctorName = null;
        updates.specialty = null;
      }
      if (step < 2) {
        updates.clinicId = null;
        updates.clinicName = null;
      }
      return { ...prev, ...updates };
    });
  };

  return (
    <AuthProvider>
      <BookingContext.Provider value={{ state, updateState, resetState, goToStep }}>
        <div className="min-h-screen bg-gray-50 pt-10 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            {state.step > 1 && <StepIndicator />}
            <div className="bg-white shadow-xl rounded-2xl overflow-hidden mt-6">
              {children}
            </div>
          </div>
        </div>
      </BookingContext.Provider>
    </AuthProvider>
  );
}
