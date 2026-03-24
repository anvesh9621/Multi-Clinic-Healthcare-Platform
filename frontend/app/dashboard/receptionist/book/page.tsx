"use client";

import { useEffect, useState, useContext, Suspense } from "react";
import { getAvailableSlots, receptionistBookAppointment } from "@/services/booking";
import { getDoctors } from "@/services/doctors";
import apiClient from "@/services/api";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthContext } from "@/context/AuthContext";

function BookingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useContext(AuthContext);

  const initialPatientId = searchParams.get("patientId") || "";

  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [patientId, setPatientId] = useState(initialPatientId);
  const [doctorClinicId, setDoctorClinicId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (user && user.role !== "RECEPTIONIST" && user.role !== "CLINIC_ADMIN") {
      router.push("/dashboard");
      return;
    }

    const fetchData = async () => {
      try {
        const [docsData, patsData] = await Promise.all([
            getDoctors(),
            apiClient.get("/patients/")
        ]);
        setDoctors(docsData);
        setPatients(patsData.data.results || patsData.data);
      } catch (err) {
          console.error("Failed to load doctors or patients", err);
      }
    };

    fetchData();
  }, [user, router]);

  const fetchSlots = async () => {
    if (!date || !doctorClinicId) return;

    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot("");

    try {
      const data = await getAvailableSlots(doctorClinicId, date);
      setSlots(data);
    } catch (error) {
      console.error("Failed to fetch slots", error);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBooking = async () => {
    if (!selectedSlot || !doctorClinicId || !patientId) {
        return alert("Please select a patient, doctor, date, and time slot.");
    }

    const startTime = selectedSlot;
    const endDate = new Date(`1970-01-01T${selectedSlot}:00`);
    // Assuming 30 minute standard slot. The backend services handles strict slot alignment validation.
    endDate.setMinutes(endDate.getMinutes() + 30);
    const endTime = endDate.toTimeString().slice(0, 8);

    try {
      await receptionistBookAppointment({
        patient_id: Number(patientId),
        doctor_clinic_id: doctorClinicId,
        appointment_date: date,
        start_time: startTime,
        end_time: endTime,
        reason: "Booked by Reception",
      });

      alert("Appointment booked successfully by Reception!");
      router.push("/dashboard/appointments"); // Receptionists can view clinic appointments here
    } catch (error: any) {
        console.error("Booking failed:", error);
        alert(error.response?.data?.detail || "Failed to book appointment.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white border border-gray-100 rounded-2xl shadow-sm mt-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Book Appointment for Patient</h1>
        <p className="text-gray-500 mt-1">Schedule a new visit for a registered patient.</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">Patient *</label>
          <select
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm appearance-none"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            <option value="">-- Select Patient --</option>
            {patients.map((pat) => (
              <option key={pat.id} value={pat.id}>
                {pat.email} ({pat.phone}) - PT-{pat.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">Doctor *</label>
          <select
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm appearance-none"
            onChange={(e) => setDoctorClinicId(Number(e.target.value))}
          >
            <option value="">-- Select Doctor --</option>
            {doctors.map((doc) => (
              <option key={doc.id} value={doc.id}>
                Dr. {doc.doctor_email}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">Date *</label>
          <input
            type="date"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <button
          onClick={fetchSlots}
          disabled={!date || !doctorClinicId || loadingSlots}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-6 rounded-xl shadow-sm transition-colors disabled:opacity-50"
        >
          {loadingSlots ? "Loading slots..." : "Check Availability"}
        </button>

        {slots.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <label className="block text-sm font-bold text-gray-900 mb-2">Select Time Slot *</label>
            <select
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm appearance-none"
              onChange={(e) => setSelectedSlot(e.target.value)}
            >
              <option value="">-- Select Time --</option>
              {slots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>
        )}

        {slots.length === 0 && selectedSlot === "" && !loadingSlots && date && doctorClinicId && (
            <div className="text-red-500 text-sm font-medium bg-red-50 p-4 rounded-xl border border-red-100 mt-2">No slots available for this date.</div>
        )}

        {slots.length > 0 && (
            <button
            onClick={handleBooking}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 mt-6 rounded-xl shadow-sm transition-colors"
            >
            Confirm Booking
            </button>
        )}
      </div>
    </div>
  );
}

// Wrap inside Suspense boundary because useSearchParams() bails out of static rendering
export default function ReceptionistBookPage() {
    return (
        <Suspense fallback={<div>Loading booking system...</div>}>
            <BookingForm />
        </Suspense>
    )
}
