"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Patient {
  id: number;
  email: string;
  phone: string;
  date_of_birth: string | null;
  created_at: string;
}

export default function ReceptionistPatientsPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user && (user.role === "RECEPTIONIST" || user.role === "CLINIC_ADMIN")) {
      const delayDebounceFn = setTimeout(() => {
        fetchPatients(searchQuery);
      }, 300); // Wait for the user to stop typing
      
      return () => clearTimeout(delayDebounceFn);
    } else if (user) {
      router.push("/dashboard");
    }
  }, [user, router, searchQuery, retryCount]);

  const fetchPatients = async (query: string = "") => {
    try {
      const url = query ? `/patients/?search=${encodeURIComponent(query)}` : "/patients/";
      const response = await apiClient.get(url);
      setPatients(response.data.results || response.data);
    } catch (err) {
      console.error("Error fetching patients:", err);
      setError("Couldn't load patients right now.");
    } finally {
      setLoading(false);
    }
  };

  if (loading && patients.length === 0) return <div>Loading patients...</div>;

  if (error) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 p-6 flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-red-100 shadow-sm text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <button 
          onClick={() => { setLoading(true); setError(null); setRetryCount(r => r + 1); }}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Manage Patients</h1>
          <p className="text-gray-500 mt-1">View, search, and manage registered clinic patients.</p>
        </div>
        <Link href="/dashboard/receptionist/patients/new">
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-sm transition-colors w-full md:w-auto">
            + Register New Patient
          </button>
        </Link>
      </div>

      {/* SEARCH */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search patients by email or phone number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-96 px-5 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
        />
      </div>

      {/* TABLE */}
      <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden min-h-[400px]">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date of Birth
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {patients.map((patient) => (
              <tr key={patient.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  PT-{patient.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="font-bold text-gray-900">{patient.email}</div>
                  <div className="text-gray-500 mt-0.5">{patient.phone}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                  {patient.date_of_birth || "Not provided"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-4">
                  <Link href={`/dashboard/receptionist/book?patientId=${patient.id}`} className="text-blue-600 hover:text-blue-700 hover:underline">
                    Book Appointment
                  </Link>
                  <Link href={`/dashboard/receptionist/patients/${patient.id}`} className="text-gray-600 hover:text-gray-900 hover:underline">
                    View History
                  </Link>
                </td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500 font-medium bg-gray-50/50">
                  No patients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
