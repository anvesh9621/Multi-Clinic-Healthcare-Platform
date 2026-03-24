"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Patient {
  id: number;
  email: string;
  phone: string;
  date_of_birth: string | null;
  address: string | null;
  emergency_contact: string | null;
  created_at: string;
}

interface Appointment {
  id: number;
  doctor_name: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  reason: string;
}

export default function PatientHistoryPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const params = useParams();
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && (user.role === "RECEPTIONIST" || user.role === "CLINIC_ADMIN")) {
      fetchHistory();
    } else if (user) {
      router.push("/dashboard");
    }
  }, [user, router, params.id]);

  const fetchHistory = async () => {
    try {
      const response = await apiClient.get(`/patients/${params.id}/history/`);
      setPatient(response.data.patient);
      setAppointments(response.data.appointments);
    } catch (err: any) {
      console.error("Error fetching patient history:", err);
      setError(err.response?.data?.error || "Failed to load patient history.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading patient history...</div>;

  if (error) return <div className="p-6 text-red-600 font-semibold">{error}</div>;

  if (!patient) return <div className="p-6">Patient not found.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Patient Details</h1>
          <p className="text-gray-500 mt-1">Review patient profile and appointment history.</p>
        </div>
        <Link href="/dashboard/receptionist/patients">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
            ← Back to Patients List
          </button>
        </Link>
      </div>

      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-8">
        <h2 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-4 mb-6">Profile Information</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
          <div>
            <p className="text-sm font-bold text-gray-500">Email Address</p>
            <p className="mt-1 text-base font-medium text-gray-900">{patient.email}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500">Phone Number</p>
            <p className="mt-1 text-base font-medium text-gray-900">{patient.phone}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500">Date of Birth</p>
            <p className="mt-1 text-base font-medium text-gray-900">{patient.date_of_birth || "Not provided"}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500">Address</p>
            <p className="mt-1 text-base font-medium text-gray-900">{patient.address || "Not provided"}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500">Emergency Contact</p>
            <p className="mt-1 text-base font-medium text-gray-900">{patient.emergency_contact || "Not provided"}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500">Registration Date</p>
            <p className="mt-1 text-base font-medium text-gray-900">{new Date(patient.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-gray-100">
          <Link href={`/dashboard/receptionist/book?patientId=${patient.id}`}>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-sm transition-colors">
              Book New Appointment
            </button>
          </Link>
        </div>
      </div>

      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-8">
        <h2 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-4 mb-6">Appointment History</h2>
        
        {appointments.length === 0 ? (
          <div className="text-center py-12 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-100">
            <p className="text-gray-500 font-medium">This patient has no recorded appointments.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Doctor</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {appointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-bold text-gray-900">{new Date(apt.appointment_date).toLocaleDateString()}</div>
                      <div className="text-gray-500 mt-0.5 font-medium">{apt.start_time} - {apt.end_time}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">Dr. {apt.doctor_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">{apt.reason || "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${apt.status === "COMPLETED" ? "bg-green-100 text-green-800" : 
                          apt.status === "CANCELLED" ? "bg-red-100 text-red-800" : 
                          "bg-yellow-100 text-yellow-800"}`}>
                        {apt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
