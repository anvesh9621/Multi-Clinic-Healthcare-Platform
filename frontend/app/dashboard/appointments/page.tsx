"use client";

import { useEffect, useState, useContext } from "react";
import { getAppointments, updateAppointmentStatus } from "@/services/appointments";
import { AuthContext } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { 
  CalendarCheck, 
  Clock, 
  MoreVertical, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText,
  Activity
} from "lucide-react";
import { PageLoader } from "@/components/ui/Skeleton";

import { useQuery } from "@tanstack/react-query";

interface Appointment {
  id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  doctor_name: string;
  clinic_name: string;
  status: string;
  patient_name?: string;
}

export default function AppointmentsPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();

  const { data: appointmentsData, isLoading: loading, refetch: fetchAppointments } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const data = await getAppointments();
      return (Array.isArray(data) ? data : data.results || []) as Appointment[];
    },
    refetchInterval: 15000,
  });

  const appointments = appointmentsData || [];

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await updateAppointmentStatus(id, status);
      fetchAppointments();
    } catch {
      alert("Failed to update status");
    }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
      SCHEDULED: { bg: "bg-blue-50", text: "text-blue-700", icon: Clock },
      CONFIRMED: { bg: "bg-green-50", text: "text-green-700", icon: CheckCircle2 },
      COMPLETED: { bg: "bg-gray-50", text: "text-gray-700", icon: FileText },
      CANCELLED: { bg: "bg-red-50", text: "text-red-700", icon: XCircle },
      NO_SHOW:   { bg: "bg-amber-50", text: "text-amber-700", icon: AlertCircle },
      IN_PROGRESS: { bg: "bg-purple-50", text: "text-purple-700", icon: Activity },
    };
    return configs[status] || { bg: "bg-slate-50", text: "text-slate-700", icon: Clock };
  };

  if (loading) return <PageLoader message="Loading appointments..." />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="w-5 h-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Appointments</h1>
          </div>
          <p className="text-gray-500 text-sm">Manage your upcoming and past appointments.</p>
        </div>
      </div>

      {/* List */}
      {appointments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CalendarCheck className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No appointments found</h3>
          <p className="text-gray-500 text-sm">You do not have any appointments scheduled yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50/80 text-gray-500 font-medium uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Doctor</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {appointments.map((appt) => {
                  const StatusIcon = getStatusConfig(appt.status).icon;
                  const statusColors = getStatusConfig(appt.status);

                  return (
                    <tr key={appt.id} className="hover:bg-gray-50/50 transition-colors group">
                      {/* Date & Time */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 mb-0.5">
                          {appt.appointment_date}
                        </div>
                        <div className="text-gray-500 text-xs flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {appt.start_time.substring(0, 5)} - {appt.end_time.substring(0, 5)}
                        </div>
                      </td>

                      {/* Doctor */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">Dr. {appt.doctor_name || "Unknown"}</div>
                            <div className="text-gray-500 text-xs">{appt.clinic_name || "MediClinic"}</div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusColors.bg} ${statusColors.text}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {appt.status.replace("_", " ")}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          
                          {/* PATIENT CANCEL */}
                          {user?.role === "PATIENT" && appt.status === "SCHEDULED" && (
                            <button
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors border border-red-200"
                              onClick={() => handleStatusChange(appt.id, "CANCELLED")}
                            >
                              Cancel
                            </button>
                          )}

                          {/* DOCTOR CONFIRM */}
                          {user?.role === "DOCTOR" && appt.status === "SCHEDULED" && (
                            <button
                              className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold rounded-lg transition-colors border border-green-200"
                              onClick={() => handleStatusChange(appt.id, "CONFIRMED")}
                            >
                              Confirm
                            </button>
                          )}

                          {/* DOCTOR COMPLETE */}
                          {user?.role === "DOCTOR" && appt.status === "CONFIRMED" && (
                            <button
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors border border-blue-200"
                              onClick={() => handleStatusChange(appt.id, "COMPLETED")}
                            >
                              Complete
                            </button>
                          )}

                          {/* DOCTOR CONSULT */}
                          {user?.role === "DOCTOR" && (appt.status === "CONFIRMED" || appt.status === "IN_PROGRESS" || appt.status === "COMPLETED") && (
                            <button
                              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-lg transition-colors border border-purple-200"
                              onClick={() => router.push(`/dashboard/doctor/consult/${appt.id}`)}
                            >
                              Consult
                            </button>
                          )}

                          {/* PATIENT VIEW RECORDS */}
                          {user?.role === "PATIENT" && appt.status === "COMPLETED" && (
                            <button
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors border border-indigo-200"
                              onClick={() => router.push(`/dashboard/history/${appt.id}`)}
                            >
                              View Record
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
