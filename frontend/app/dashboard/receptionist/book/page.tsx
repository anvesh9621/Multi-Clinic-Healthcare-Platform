"use client";

import { useEffect, useState, useContext, Suspense } from "react";
import { getAvailableSlots, receptionistBookAppointment } from "@/services/booking";
import { getDoctors } from "@/services/doctors";
import apiClient from "@/services/api";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthContext } from "@/context/AuthContext";
import { CalendarCheck, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormLegend } from "@/components/ui/FormLegend";

import { DoctorEntry, Patient } from "@/types/api";

function BookingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useContext(AuthContext);

  const initialPatientId = searchParams.get("patientId") || "";

  const [doctors, setDoctors] = useState<DoctorEntry[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
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
      router.push("/dashboard/appointments");
    } catch (error: any) {
      console.error("Booking failed:", error);
      alert(error.response?.data?.detail || "Failed to book appointment.");
    }
  };

  const selectClass = "w-full px-4 py-3 bg-warm-surface border border-border rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition shadow-sm appearance-none";

  return (
    <div className="max-w-3xl mx-auto mt-8">
      <Card className="p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight heading-font">Book Appointment for Patient</h1>
          <p className="text-muted mt-1 mb-3">Schedule a new visit for a registered patient.</p>
          <FormLegend />
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-ink mb-2">
              Patient <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            </label>
            <select className={selectClass} value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
              <option value="">-- Select Patient --</option>
              {patients.map((pat) => (
                <option key={pat.id} value={pat.id}>
                  {pat.email} ({pat.phone}) - PT-{pat.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-ink mb-2">
              Doctor <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            </label>
            <select className={selectClass} onChange={(e) => setDoctorClinicId(Number(e.target.value))} required>
              <option value="">-- Select Doctor --</option>
              {doctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  Dr. {doc.doctor_email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-ink mb-2">
              Date <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            </label>
            <input
              type="date"
              className={selectClass}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <Button
            variant="secondary"
            onClick={fetchSlots}
            disabled={!date || !doctorClinicId || loadingSlots}
            className="w-full"
          >
            {loadingSlots ? "Loading slots..." : "Check Availability"}
          </Button>

          {slots.length > 0 && (
            <div className="pt-4 border-t border-border">
              <label className="block text-sm font-bold text-ink mb-2">Select Time Slot *</label>
              <select
                className={selectClass}
                onChange={(e) => setSelectedSlot(e.target.value)}
              >
                <option value="">-- Select Time --</option>
                {slots.map((slot) => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </div>
          )}

          {slots.length === 0 && selectedSlot === "" && !loadingSlots && date && doctorClinicId && (
            <div className="text-red-600 text-sm font-medium bg-red-50 p-4 rounded-xl border border-red-100">
              No slots available for this date.
            </div>
          )}

          {slots.length > 0 && (
            <Button onClick={handleBooking} className="w-full mt-2">
              <CalendarCheck className="w-4 h-4 mr-2" /> Confirm Booking
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function ReceptionistBookPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <BookingForm />
    </Suspense>
  );
}
