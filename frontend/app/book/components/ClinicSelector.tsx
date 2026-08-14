"use client";

import { useEffect, useState } from "react";
import { Building2, Search, Users, Activity, MapPin, ChevronRight } from "lucide-react";
import api from "@/services/api";
import { useBooking } from "../layout";

import { useQuery } from "@tanstack/react-query";

export interface Clinic {
  id: number;
  name: string;
  address: string;
  doctor_count: number;
  specialties: string[];
}

export default function ClinicSelector({ initialClinics }: { initialClinics?: Clinic[] }) {
  const { updateState, goToStep } = useBooking();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: clinicsData, isLoading: queryLoading } = useQuery({
    queryKey: ["public_clinics"],
    queryFn: async () => {
      const res = await api.get("/public/clinics/");
      return res.data as Clinic[];
    },
    initialData: initialClinics && initialClinics.length > 0 ? initialClinics : undefined,
    staleTime: 300_000,
  });

  const clinics = clinicsData || initialClinics || [];
  const loading = queryLoading && clinics.length === 0;


  const handleSelect = (clinic: Clinic) => {
    updateState({ clinicId: clinic.id, clinicName: clinic.name });
    goToStep(3);
  };

  const filtered = clinics.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Select a Clinic</h2>
        <p className="text-gray-500 mt-1">Where would you like to visit?</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input 
          type="text"
          placeholder="Search by clinic name or city..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none transition"
        />
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1,2].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No clinics found matching your search.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(clinic => (
            <div 
              key={clinic.id} 
              onClick={() => handleSelect(clinic)}
              className="group bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-violet-200 rounded-xl p-5 cursor-pointer transition-all flex flex-col sm:flex-row gap-4 sm:items-center"
            >
              <div className="w-14 h-14 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-violet-700 transition-colors">{clinic.name}</h3>
                <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-1">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{clinic.address}</span>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                    <Users className="w-3.5 h-3.5" />
                    {clinic.doctor_count} Doctor{clinic.doctor_count !== 1 ? 's' : ''}
                  </span>
                  {clinic.specialties.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-md">
                      <Activity className="w-3.5 h-3.5" />
                      {clinic.specialties.join(", ")}
                    </span>
                  )}
                </div>
              </div>
              <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-gray-50 group-hover:bg-violet-100 group-hover:text-violet-600 transition-colors">
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-violet-600" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
