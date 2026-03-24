"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { 
  ArrowLeft,
  Search, 
  User, 
  History,
  Activity,
  ChevronRight,
  ClipboardList
} from "lucide-react";

interface Patient {
  id: number;
  email: string;
  phone: string;
  first_name?: string;
  last_name?: string;
  created_at: string;
}

export default function DoctorPatientDBPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user && user.role !== "DOCTOR") {
      router.push("/dashboard");
      return;
    }
  }, [user, router]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPatients(searchQuery);
    }, 300);
    
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchPatients = async (query: string = "") => {
    setLoading(true);
    try {
      const url = query ? `/patients/?search=${encodeURIComponent(query)}` : "/patients/";
      const response = await apiClient.get(url);
      setPatients(response.data.results || response.data);
    } catch (error) {
      console.error("Error fetching patients:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/doctor" className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
              <User className="w-8 h-8 text-blue-600 bg-blue-50 p-1.5 rounded-lg hidden sm:block" />
              Patient Database
            </h1>
            <p className="text-gray-500 mt-1 text-sm sm:text-base">Search and view past consultation history for your clinic's patients.</p>
          </div>
        </div>
        
        <div className="relative w-full md:w-auto mt-4 md:mt-0">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by name, email, or phone..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
      </div>

      {/* ── LIST ── */}
      <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden min-h-[500px]">
        {loading && patients.length === 0 ? (
          <div className="flex items-center justify-center h-64">
             <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center text-gray-500">
             <Search className="w-12 h-12 text-gray-300 mb-4" />
             <p className="text-lg font-medium text-gray-900">No patients found</p>
             <p className="text-sm mt-1">Try adjusting your search terms.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {patients.map((patient) => {
              const displayName = patient.first_name 
                 ? `${patient.first_name} ${patient.last_name || ""}` 
                 : `Patient #${patient.id}`;
                 
              return (
                <div key={patient.id} className="p-6 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-indigo-50 rounded-2xl flex items-center justify-center flex-shrink-0 text-blue-700 font-bold text-lg shadow-sm">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{displayName}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span>{patient.email}</span>
                        {patient.phone && (
                           <>
                             <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                             <span>{patient.phone}</span>
                           </>
                        )}
                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <span>Registered {format(new Date(patient.created_at), "MMM yyyy")}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                    <Link href={`/dashboard/history?patientId=${patient.id}`} className="flex-1 md:flex-none">
                      <button className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
                        <History className="w-4 h-4" /> View History
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
