"use client";

import { useEffect, useState } from "react";
import { User, Star, Award, Search, ChevronRight } from "lucide-react";
import api from "@/services/api";
import { useBooking } from "../layout";

import { useQuery } from "@tanstack/react-query";

interface Doctor {
  doctor_clinic_id: number;
  doctor_id: number;
  name: string;
  specialty: string;
  consultation_fee: number;
  experience_years: number;
  photo_url: string | null;
  average_rating: number;
  review_count: number;
}

export default function DoctorSelector() {
  const { state, updateState, goToStep } = useBooking();
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("All");

  const { data: doctorsData, isLoading: loading } = useQuery({
    queryKey: ["public_doctors", state.clinicId],
    queryFn: async () => {
      const res = await api.get(`/public/clinics/${state.clinicId}/doctors/`);
      return res.data.doctors as Doctor[];
    },
    enabled: !!state.clinicId,
  });

  const doctors = doctorsData || [];

  const specialties = ["All", ...Array.from(new Set(doctors.map(d => d.specialty)))];
  
  const filtered = selectedSpecialty === "All" 
    ? doctors 
    : doctors.filter(d => d.specialty === selectedSpecialty);

  const handleSelect = (doctor: Doctor) => {
    updateState({
      doctorId: doctor.doctor_id,
      doctorClinicId: doctor.doctor_clinic_id,
      doctorName: doctor.name,
      specialty: doctor.specialty,
    });
    goToStep(4);
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Choose a Doctor</h2>
          <p className="text-gray-500 mt-1">At {state.clinicName}</p>
        </div>
      </div>

      {doctors.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
          {specialties.map(spec => (
            <button
              key={spec}
              onClick={() => setSelectedSpecialty(spec)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                selectedSpecialty === spec
                  ? "bg-violet-600 text-white shadow-md shadow-violet-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {spec}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No doctors found for this specialty.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(doc => (
            <div 
              key={doc.doctor_clinic_id}
              onClick={() => handleSelect(doc)}
              className="group bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-violet-200 rounded-xl p-4 cursor-pointer transition-all flex items-start gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {doc.photo_url ? (
                  <img src={doc.photo_url} alt={doc.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-violet-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900 truncate group-hover:text-violet-700 transition-colors">
                  {doc.name}
                </h3>
                <p className="text-violet-600 text-sm font-medium truncate">{doc.specialty}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                    <Star className="w-3 h-3 fill-current" /> {doc.average_rating} ({doc.review_count})
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" /> {doc.experience_years} yrs
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
