"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  getClinics,
  getDoctorsByClinic,
  getAvailableSlots,
  bookAppointment,
  Clinic,
  DoctorClinic,
} from "@/services/booking";
import {
  HeartPulse,
  Building2,
  Calendar,
  Clock,
  CheckCircle,
  ArrowLeft,
  ChevronRight,
  MapPin,
  Users,
  IndianRupee,
  Loader2,
  Search,
  Stethoscope,
  X,
  Map as MapIcon,
  List as ListIcon,
  Video,
  MapPinned,
} from "lucide-react";
import dynamic from "next/dynamic";

// Dynamic import so Leaflet (which uses window) is never SSR'd
const ClinicMap = dynamic(() => import("@/components/ui/ClinicMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-80 bg-slate-100 rounded-2xl">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
    </div>
  ),
});
// ── Steps: 0=Clinic, 1=Specialty, 2=Doctor, 3=Date, 4=Slot, 5=Confirm ─────
const STEPS = ["Clinic", "Specialty", "Doctor", "Date", "Slot", "Confirm"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Symptom → Specialty keyword mapping ────────────────────────────────────
const SYMPTOM_MAP: Record<string, string[]> = {
  "chest pain":       ["Cardiology", "General Medicine", "Internal Medicine"],
  "heart":            ["Cardiology"],
  "palpitation":      ["Cardiology"],
  "breathless":       ["Cardiology", "Pulmonology", "General Medicine"],
  "cough":            ["Pulmonology", "General Medicine", "ENT"],
  "asthma":           ["Pulmonology"],
  "lung":             ["Pulmonology"],
  "skin":             ["Dermatology"],
  "rash":             ["Dermatology"],
  "acne":             ["Dermatology"],
  "eczema":           ["Dermatology"],
  "bone":             ["Orthopedics", "Rheumatology"],
  "joint":            ["Orthopedics", "Rheumatology"],
  "fracture":         ["Orthopedics"],
  "back pain":        ["Orthopedics", "Neurology"],
  "headache":         ["Neurology", "General Medicine"],
  "migraine":         ["Neurology"],
  "seizure":          ["Neurology"],
  "diabetes":         ["Endocrinology", "General Medicine", "Internal Medicine"],
  "thyroid":          ["Endocrinology"],
  "child":            ["Pediatrics"],
  "baby":             ["Pediatrics"],
  "fever":            ["General Medicine", "Pediatrics"],
  "stomach":          ["Gastroenterology", "General Medicine"],
  "abdomen":          ["Gastroenterology"],
  "eye":              ["Ophthalmology"],
  "vision":           ["Ophthalmology"],
  "ear":              ["ENT"],
  "nose":             ["ENT"],
  "throat":           ["ENT"],
  "women":            ["Gynecology", "Obstetrics"],
  "period":           ["Gynecology"],
  "pregnancy":        ["Obstetrics", "Gynecology"],
  "urine":            ["Urology", "Nephrology"],
  "kidney":           ["Nephrology", "Urology"],
  "mental":           ["Psychiatry", "Psychology"],
  "anxiety":          ["Psychiatry", "Psychology"],
  "depression":       ["Psychiatry", "Psychology"],
  "tooth":            ["Dentistry"],
  "dental":           ["Dentistry"],
  "gum":              ["Dentistry"],
  "nutrition":        ["General Medicine", "Endocrinology"],
  "weight":           ["Endocrinology", "General Medicine"],
  "cancer":           ["Oncology"],
  "tumor":            ["Oncology"],
  "allergy":          ["General Medicine", "Immunology"],
};

// Specialty icons / colors for visual variety
const SPECIALTY_STYLES: Record<string, { color: string; bg: string; emoji: string }> = {
  "Cardiology":       { color: "text-red-600",    bg: "bg-red-50",    emoji: "❤️" },
  "Pulmonology":      { color: "text-sky-600",    bg: "bg-sky-50",    emoji: "🫁" },
  "Dermatology":      { color: "text-pink-600",   bg: "bg-pink-50",   emoji: "🩹" },
  "Orthopedics":      { color: "text-amber-600",  bg: "bg-amber-50",  emoji: "🦴" },
  "Neurology":        { color: "text-purple-600", bg: "bg-purple-50", emoji: "🧠" },
  "Endocrinology":    { color: "text-orange-600", bg: "bg-orange-50", emoji: "⚗️" },
  "Pediatrics":       { color: "text-green-600",  bg: "bg-green-50",  emoji: "👶" },
  "Gastroenterology": { color: "text-yellow-600", bg: "bg-yellow-50", emoji: "🫃" },
  "Ophthalmology":    { color: "text-teal-600",   bg: "bg-teal-50",   emoji: "👁️" },
  "ENT":              { color: "text-indigo-600", bg: "bg-indigo-50", emoji: "👂" },
  "Gynecology":       { color: "text-fuchsia-600",bg: "bg-fuchsia-50",emoji: "🌸" },
  "Obstetrics":       { color: "text-rose-600",   bg: "bg-rose-50",   emoji: "🤰" },
  "Urology":          { color: "text-blue-600",   bg: "bg-blue-50",   emoji: "💧" },
  "Nephrology":       { color: "text-cyan-600",   bg: "bg-cyan-50",   emoji: "🫘" },
  "Psychiatry":       { color: "text-violet-600", bg: "bg-violet-50", emoji: "🧘" },
  "Psychology":       { color: "text-violet-500", bg: "bg-violet-50", emoji: "💬" },
  "Dentistry":        { color: "text-emerald-600",bg: "bg-emerald-50",emoji: "🦷" },
  "Oncology":         { color: "text-red-700",    bg: "bg-red-50",    emoji: "🔬" },
  "Rheumatology":     { color: "text-amber-700",  bg: "bg-amber-50",  emoji: "🦾" },
  "Immunology":       { color: "text-lime-600",   bg: "bg-lime-50",   emoji: "🛡️" },
  "Internal Medicine":{ color: "text-slate-600",  bg: "bg-slate-50",  emoji: "🩺" },
};

function getSpecialtyStyle(spec: string) {
  return (
    SPECIALTY_STYLES[spec] ?? {
      color: "text-blue-600",
      bg: "bg-blue-50",
      emoji: "🩺",
    }
  );
}

// Match symptom text to a set of relevant specialties
function matchSymptomToSpecialties(query: string, available: string[]): string[] {
  if (!query.trim()) return [];
  const lower = query.toLowerCase();
  const matched = new Set<string>();
  for (const [keyword, specs] of Object.entries(SYMPTOM_MAP)) {
    if (lower.includes(keyword)) {
      specs.forEach((s) => {
        if (available.includes(s)) matched.add(s);
      });
    }
  }
  return Array.from(matched);
}

function getNextDays(count: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDate(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function BookingWizard() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // View state for Step 0
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");

  // Data
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [doctors, setDoctors] = useState<DoctorClinic[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [availableDays] = useState(getNextDays(14));

  // Selections
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [symptomQuery, setSymptomQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorClinic | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [reason, setReason] = useState("");

  const [reason, setReason] = useState("");

  // ── Derived: unique specialties at selected clinic ───────────────────────
  const availableSpecialties = useMemo(() => {
    const set = new Set(doctors.map((d) => d.specialization).filter(Boolean));
    return Array.from(set).sort();
  }, [doctors]);

  // Symptom suggestions
  const symptomSuggestions = useMemo(
    () => matchSymptomToSpecialties(symptomQuery, availableSpecialties),
    [symptomQuery, availableSpecialties]
  );

  // Filtered doctors (by specialty if selected)
  const filteredDoctors = useMemo(() => {
    if (!selectedSpecialty) return doctors;
    return doctors.filter((d) => d.specialization === selectedSpecialty);
  }, [doctors, selectedSpecialty]);

  // ── Data fetching ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await getClinics();
        setClinics(data);
      } catch {
        setError("Failed to load clinics. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  useEffect(() => {
    if (!selectedClinic) return;
    const fetch = async () => {
      setLoading(true);
      setDoctors([]);
      try {
        const data = await getDoctorsByClinic(selectedClinic.id);
        setDoctors(data);
      } catch {
        setError("Failed to load doctors.");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [selectedClinic]);

  const fetchSlots = useCallback(async (doctorClinicId: number, date: string) => {
    setSlots([]);
    setSelectedSlot("");
    setLoading(true);
    try {
      const data = await getAvailableSlots(doctorClinicId, date);
      setSlots(data);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      fetchSlots(selectedDoctor.id, selectedDate);
    }
  }, [selectedDoctor, selectedDate, fetchSlots]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleClinicSelect = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setSelectedSpecialty(null);
    setSymptomQuery("");
    setSelectedDoctor(null);
    setSelectedDate("");
    setSelectedSlot("");
    setStep(1); // → Specialty
  };

  const handleSpecialtySelect = (spec: string) => {
    setSelectedSpecialty(spec);
    setSelectedDoctor(null);
    setSelectedDate("");
    setSelectedSlot("");
    setStep(2); // → Doctor
  };

  const handleSkipSpecialty = () => {
    setSelectedSpecialty(null);
    setStep(2); // → Doctor (all)
  };

  const handleDoctorSelect = (doc: DoctorClinic) => {
    setSelectedDoctor(doc);
    setSelectedDate("");
    setSelectedSlot("");
    setStep(3); // → Date
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot("");
    setStep(4); // → Slot
  };

  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot);
    setStep(5); // → Confirm
  };

  const handleConfirm = async () => {
    if (!selectedDoctor || !selectedDate || !selectedSlot) return;
    setLoading(true);
    setError("");
    try {
      const endDate = new Date(`1970-01-01T${selectedSlot}:00`);
      endDate.setMinutes(endDate.getMinutes() + 30);
      const endTime = endDate.toTimeString().slice(0, 8);

      await bookAppointment({
        doctor_clinic_id: selectedDoctor.id,
        appointment_date: selectedDate,
        start_time: selectedSlot,
        end_time: endTime,
        reason: reason || "General consultation",
      });
      setBookingSuccess(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string; non_field_errors?: string[] } } };
      const msg =
        axiosErr?.response?.data?.detail ||
        axiosErr?.response?.data?.non_field_errors?.[0] ||
        "Booking failed. Please try a different slot.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── SUCCESS STATE ────────────────────────────────────────────────────────
  if (bookingSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-10 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Appointment Booked!</h1>
          <p className="text-gray-500 mb-8">Your appointment has been confirmed successfully.</p>

          <div className="bg-gray-50 rounded-2xl p-6 text-left space-y-3 mb-8 border border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Clinic</span>
              <span className="font-semibold text-gray-900">{selectedClinic?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Specialty</span>
              <span className="font-semibold text-gray-900">{selectedDoctor?.specialization}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Doctor</span>
              <span className="font-semibold text-gray-900">
                Dr. {selectedDoctor?.first_name} {selectedDoctor?.last_name}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Date</span>
              <span className="font-semibold text-gray-900">
                {new Date(selectedDate).toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Time</span>
              <span className="font-semibold text-gray-900">{selectedSlot}</span>
            </div>

            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="text-gray-500">Status</span>
              <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs">
                SCHEDULED
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              href="/dashboard/appointments"
              className="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm text-center"
            >
              View Appointments
            </Link>
            <Link
              href="/dashboard/patient"
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm text-center"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── WIZARD ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <HeartPulse className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-gray-900 text-lg">Book Appointment</span>
            </div>
          </div>
          <Link
            href="/dashboard/patient"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Progress Steps */}
        <div className="flex items-center mb-10">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all
                    ${i < step
                      ? "bg-blue-600 text-white"
                      : i === step
                      ? "bg-blue-600 text-white ring-4 ring-blue-100"
                      : "bg-gray-200 text-gray-400"
                    }`}
                >
                  {i < step ? <CheckCircle className="w-5 h-5" /> : i + 1}
                </div>
                <span
                  className={`text-xs mt-1.5 font-medium hidden sm:block ${
                    i === step
                      ? "text-blue-600"
                      : i < step
                      ? "text-gray-600"
                      : "text-gray-400"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${i < step ? "bg-blue-600" : "bg-gray-200"}`}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium flex items-center gap-3">
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">
              ✕
            </button>
          </div>
        )}

        {loading && step !== 5 && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        )}

        {/* ── STEP 0: SELECT CLINIC ── */}
        {!loading && step === 0 && (
          <div>
            <div className="flex sm:flex-row flex-col sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Choose a Clinic</h2>
                <p className="text-gray-500">Select the clinic you'd like to visit</p>
              </div>
              <div className="bg-white p-1 rounded-xl flex items-center shadow-sm border border-gray-100 self-start">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    viewMode === "grid" ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <ListIcon className="w-4 h-4" /> <span className="hidden sm:inline">List</span>
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    viewMode === "map" ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <MapIcon className="w-4 h-4" /> <span className="hidden sm:inline">Map</span>
                </button>
              </div>
            </div>

            {clinics.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No clinics available at the moment.</div>
            ) : viewMode === "grid" ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {clinics.map((clinic) => (
                  <button
                    key={clinic.id}
                    onClick={() => handleClinicSelect(clinic)}
                    className="text-left bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 hover:bg-blue-50/20 transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                        <Building2 className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 mb-1">{clinic.name}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mb-2">
                          <MapPin className="w-3.5 h-3.5" /> {clinic.address}
                        </p>
                        <p className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                          <Users className="w-3 h-3" /> {clinic.doctor_count} doctors available
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
            
            {clinics.length > 0 && viewMode === "map" && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ClinicMap
                  clinics={clinics}
                  selectedId={selectedClinic?.id || null}
                  onSelect={handleClinicSelect}
                />
              </div>
            )}
          </div>
        )}

        {/* ── STEP 1: SPECIALTY / SYMPTOM ── */}
        {!loading && step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">What do you need help with?</h2>
            <p className="text-gray-500 mb-6">
              Search by symptom or pick a specialty at{" "}
              <strong>{selectedClinic?.name}</strong>
            </p>

            {/* Symptom search */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={symptomQuery}
                onChange={(e) => setSymptomQuery(e.target.value)}
                placeholder="e.g. chest pain, headache, skin rash…"
                className="w-full pl-11 pr-10 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder:text-gray-400"
              />
              {symptomQuery && (
                <button
                  onClick={() => setSymptomQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Symptom keyword suggestions */}
            {symptomQuery && symptomSuggestions.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Suggested for "{symptomQuery}"
                </p>
                <div className="flex flex-wrap gap-2">
                  {symptomSuggestions.map((spec) => {
                    const style = getSpecialtyStyle(spec);
                    return (
                      <button
                        key={spec}
                        onClick={() => handleSpecialtySelect(spec)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 border-blue-300 bg-blue-50 text-blue-700 font-semibold text-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all`}
                      >
                        <span>{style.emoji}</span>
                        {spec}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Symptom search with no matches */}
            {symptomQuery && symptomSuggestions.length === 0 && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                No specialty matched for <strong>"{symptomQuery}"</strong>. Browse all specialties below or{" "}
                <button onClick={handleSkipSpecialty} className="underline font-semibold">
                  see all doctors
                </button>
                .
              </div>
            )}

            {/* All specialties grid */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {symptomQuery && symptomSuggestions.length === 0 ? "All specialties" : "Browse by specialty"}
              </p>
              {availableSpecialties.length === 0 ? (
                <div className="text-center py-10 text-gray-400">No specialties found at this clinic.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {availableSpecialties.map((spec) => {
                    const style = getSpecialtyStyle(spec);
                    const count = doctors.filter((d) => d.specialization === spec).length;
                    return (
                      <button
                        key={spec}
                        onClick={() => handleSpecialtySelect(spec)}
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 border-transparent ${style.bg} hover:border-blue-300 hover:shadow-md transition-all text-left group`}
                      >
                        <span className="text-2xl flex-shrink-0">{style.emoji}</span>
                        <div className="min-w-0">
                          <p className={`font-semibold text-sm ${style.color} leading-tight`}>{spec}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {count} doctor{count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Skip option */}
            <div className="mt-6 text-center">
              <button
                onClick={handleSkipSpecialty}
                className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
              >
                Skip — show all doctors
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: SELECT DOCTOR ── */}
        {!loading && step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Choose a Doctor</h2>
            <p className="text-gray-500 mb-6">
              {selectedSpecialty ? (
                <>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium mr-1">
                    <Stethoscope className="w-3.5 h-3.5" />
                    {selectedSpecialty}
                  </span>{" "}
                  at <strong>{selectedClinic?.name}</strong>
                </>
              ) : (
                <>
                  All available doctors at <strong>{selectedClinic?.name}</strong>
                </>
              )}
            </p>

            {filteredDoctors.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                No doctors available
                {selectedSpecialty ? ` for ${selectedSpecialty}` : ""} at this clinic.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {filteredDoctors.map((doc) => {
                  const style = getSpecialtyStyle(doc.specialization);
                  return (
                    <button
                      key={doc.id}
                      onClick={() => handleDoctorSelect(doc)}
                      className="text-left bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-bold text-lg">
                          {doc.first_name?.[0] || "D"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900">
                            Dr. {doc.first_name} {doc.last_name}
                          </h3>
                          <span
                            className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1 mb-2 ${style.bg} ${style.color}`}
                          >
                            {style.emoji} {doc.specialization}
                          </span>
                          {doc.bio && (
                            <p className="text-xs text-gray-400 mb-2 line-clamp-2">{doc.bio}</p>
                          )}
                          <div className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                            <IndianRupee className="w-3.5 h-3.5" />
                            {doc.consultation_fee} consultation fee
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: SELECT DATE ── */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Select a Date</h2>
            <p className="text-gray-500 mb-6">
              Booking with <strong>Dr. {selectedDoctor?.first_name} {selectedDoctor?.last_name}</strong>
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
              {availableDays.map((d) => {
                const str = formatDate(d);
                const isSelected = str === selectedDate;
                const dayName = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
                return (
                  <button
                    key={str}
                    onClick={() => handleDateSelect(str)}
                    className={`flex flex-col items-center py-3 px-2 rounded-2xl border-2 transition-all font-medium
                      ${
                        isSelected
                          ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20"
                          : "bg-white border-gray-100 text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                      }`}
                  >
                    <span className="text-xs mb-1 opacity-75">{dayName}</span>
                    <span className="text-lg font-bold">{d.getDate()}</span>
                    <span className="text-xs opacity-75">
                      {d.toLocaleString("default", { month: "short" })}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedDate && (
              <button
                onClick={() => setStep(4)}
                className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
              >
                Check Available Slots
              </button>
            )}
          </div>
        )}

        {/* ── STEP 4: SELECT SLOT ── */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Available Time Slots</h2>
            <p className="text-gray-500 mb-6">
              {new Date(selectedDate).toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {" · "}Dr. {selectedDoctor?.first_name} {selectedDoctor?.last_name}
            </p>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium mb-1">No slots available</p>
                <p className="text-gray-400 text-sm">
                  The doctor has no schedule or all slots are booked for this day.
                </p>
                <button
                  onClick={() => setStep(3)}
                  className="mt-6 px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Pick another date
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => handleSlotSelect(slot)}
                    className={`py-3 rounded-xl border-2 font-semibold text-sm transition-all
                      ${
                        selectedSlot === slot
                          ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20"
                          : "bg-white border-gray-100 text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                      }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 5: CONFIRM ── */}
        {step === 5 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Confirm Appointment</h2>
            <p className="text-gray-500 mb-6">Review your booking details below</p>

            {/* Summary card */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mb-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Clinic</span>
                <span className="font-semibold text-gray-900">{selectedClinic?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Doctor</span>
                <span className="font-semibold text-gray-900">
                  Dr. {selectedDoctor?.first_name} {selectedDoctor?.last_name}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Specialty</span>
                <span className="font-semibold text-gray-900">{selectedDoctor?.specialization}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date</span>
                <span className="font-semibold text-gray-900">
                  {new Date(selectedDate).toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Time</span>
                <span className="font-semibold text-gray-900">{selectedSlot}</span>
              </div>
            </div>



            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reason for visit <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-gray-900 resize-none"
                placeholder="e.g. Chest pain, Skin rash, Regular check-up..."
              />
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Confirming...</span>
              ) : (
                <span className="flex items-center gap-2"><CheckCircle className="w-5 h-5" /> Confirm Appointment</span>
              )}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              By confirming, you agree to attend this appointment. Please cancel at least 2 hours before if
              unable to attend.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
