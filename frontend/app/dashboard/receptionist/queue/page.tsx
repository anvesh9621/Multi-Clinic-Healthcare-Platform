"use client";

import { useState, useEffect } from "react";
import { LayoutDashboard, CheckSquare, Clock, UserCheck } from "lucide-react";
import api from "@/services/api";

type Appointment = {
  id: number;
  patient_name: string;
  doctor_name: string;
  appointment_date: string;
  start_time: string;
  status: string;
  queue_token: string;
};

export default function ReceptionistQueue() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get("/appointments/");
      // The API might return results depending on pagination
      const data = res.data.results || res.data;
      const today = new Date().toISOString().split('T')[0];
      const todaysAppointments = data.filter((a: Appointment) => a.appointment_date === today);
      setAppointments(todaysAppointments);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await api.patch(`/appointments/${id}/status/`, { status });
      fetchData();
    } catch (e) {
      console.error(e);
      alert("Failed to update status");
    }
  };

  if (loading) return <div className="p-8 font-medium text-gray-500">Loading daily queue...</div>;

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
         <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <LayoutDashboard className="w-6 h-6 text-indigo-600" /> Walk-in Queue Manager
          </h1>
          <p className="text-sm text-gray-500 mt-1">Mark patients as arrived to instantly display their tokens on the waiting room TV.</p>
        </div>
        <a href="/queue-display" target="_blank" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm transition-colors text-sm">
          Open TV Display ↗
        </a>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {appointments.length === 0 ? (
          <div className="p-16 text-center text-gray-500 font-medium">No appointments scheduled for today.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Token</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Doctor</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Queue Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {appointments.sort((a,b) => a.start_time.localeCompare(b.start_time)).map(apt => (
                <tr key={apt.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-xl text-indigo-600 font-mono tracking-widest">{apt.queue_token}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">{apt.start_time.slice(0, 5)}</td>
                  <td className="px-6 py-4 font-medium text-gray-700">{apt.patient_name}</td>
                  <td className="px-6 py-4 text-gray-600 font-medium">{apt.doctor_name}</td>
                  <td className="px-6 py-4">
                     <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase ${
                        apt.status === 'WAITING' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                        apt.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        apt.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {apt.status.replace("_", " ")}
                      </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {apt.status === 'SCHEDULED' || apt.status === 'CONFIRMED' ? (
                      <button onClick={() => updateStatus(apt.id, 'WAITING')} className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> Mark Arrived
                      </button>
                    ) : null}
                    {apt.status === 'WAITING' && (
                       <button onClick={() => updateStatus(apt.id, 'IN_PROGRESS')} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20 px-4 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Send to Doctor
                      </button>
                    )}
                    {apt.status === 'IN_PROGRESS' && (
                       <button onClick={() => updateStatus(apt.id, 'COMPLETED')} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1">
                        <CheckSquare className="w-3 h-3" /> Mark Done
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
