"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Activity,
  ChevronRight,
  ClipboardList,
  Search,
  Bell,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  X
} from "lucide-react";
import { useToast } from "@/context/ToastContext";

interface Appointment {
  id: number;
  patient_name: string;
  patient_id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  reason: string;
}

export default function DoctorDashboard() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const { success, error: toastError } = useToast();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState(30);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  
  const [rescheduleData, setRescheduleData] = useState({
    date: "",
    startTime: "",
    endTime: "",
    reason: ""
  });

  useEffect(() => {
    if (user && user.role === "DOCTOR") {
      fetchTodayAppointments();
    } else if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const fetchTodayAppointments = async () => {
    try {
      // In a real app we'd pass today's date to the API filter
      // For now we'll fetch all and filter client-side or assume the API returns relevant ones
      const response = await apiClient.get("/appointments/");
      
      const todayStr = new Date().toISOString().split("T")[0];
      
      const appointmentsData = response.data.results || response.data;
      
      const todayAppointments = appointmentsData.filter(
        (app: any) => app.appointment_date === todayStr
      ).map((app: any) => ({
        id: app.id,
        patient_name: app.patient_name || `Patient #${app.patient}`, // using the serializer field if available
        patient_id: app.patient,
        appointment_date: app.appointment_date,
        start_time: app.start_time,
        end_time: app.end_time,
        status: app.status,
        reason: app.reason || "General Consultation",
      }));
      
      // Sort by time
      todayAppointments.sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
      
      setAppointments(todayAppointments);
    } catch (error) {
      console.error("Failed to load appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const notifyDelay = async () => {
    try {
      const res = await apiClient.post("/appointments/running-late/", { delay_minutes: delayMinutes });
      success("Notifications Sent", res.data.message);
      setIsDelayModalOpen(false);
    } catch (error: any) {
      toastError("Failed to notify", error.response?.data?.error || "An error occurred.");
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      await apiClient.patch(`/appointments/${id}/status/`, { status: "CANCELLED" });
      success("Appointment Cancelled");
      fetchTodayAppointments();
    } catch (error: any) {
      toastError("Error", "Could not cancel appointment.");
    }
  };

  const openReschedule = (app: Appointment) => {
    setSelectedAppointment(app);
    setRescheduleData({
      date: app.appointment_date,
      startTime: app.start_time.slice(0, 5),
      endTime: app.end_time.slice(0, 5),
      reason: "Doctor requested reschedule."
    });
    setIsRescheduleModalOpen(true);
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;
    try {
      await apiClient.post(`/appointments/${selectedAppointment.id}/reschedule/`, {
        appointment_date: rescheduleData.date,
        start_time: rescheduleData.startTime,
        end_time: rescheduleData.endTime,
        reason: rescheduleData.reason
      });
      success("Rescheduled", "Appointment rescheduled successfully.");
      setIsRescheduleModalOpen(false);
      fetchTodayAppointments();
    } catch (error: any) {
      toastError("Reschedule Failed", error.response?.data?.error || "Please check doctor availability.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const inProgress = appointments.find(a => a.status === "IN_PROGRESS");
  const upcoming = appointments.filter(a => ["SCHEDULED", "CONFIRMED"].includes(a.status));
  const completed = appointments.filter(a => ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(a.status));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Good Morning, Dr. {user?.first_name || "Doctor"}
          </h1>
          <p className="text-gray-500 mt-1">Here is your schedule for today, {format(new Date(), "MMMM d, yyyy")}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Quick search patient..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button onClick={() => setIsDelayModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-sm font-medium transition-colors">
            <AlertCircle className="w-4 h-4" /> Running Late?
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ── LEFT COLUMN: TODAY'S QUEUE ── */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Currently Serving Box */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20">
            <h2 className="text-blue-100 font-semibold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Now Serving
            </h2>
            
            {inProgress ? (
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                 <div>
                   <h3 className="text-3xl font-bold">{inProgress.patient_name}</h3>
                   <div className="flex items-center gap-4 mt-2 text-blue-100 text-sm">
                     <span className="flex items-center gap-1"><Clock className="w-4 h-4"/> Started at {inProgress.start_time.slice(0,5)}</span>
                     <span className="flex items-center gap-1"><ClipboardList className="w-4 h-4"/> {inProgress.reason}</span>
                   </div>
                 </div>
                 <Link href={`/dashboard/doctor/consult/${inProgress.id}`}>
                   <button className="px-6 py-3 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl transition-colors shadow-sm whitespace-nowrap">
                     Resume Consultation
                   </button>
                 </Link>
               </div>
            ) : upcoming.length > 0 ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                 <div>
                   <h3 className="text-3xl font-bold">{upcoming[0].patient_name}</h3>
                   <div className="flex items-center gap-4 mt-2 text-blue-100 text-sm">
                     <span className="flex items-center gap-1"><Clock className="w-4 h-4"/> Scheduled for {upcoming[0].start_time.slice(0,5)}</span>
                     <span className="flex items-center gap-1"><ClipboardList className="w-4 h-4"/> {upcoming[0].reason}</span>
                   </div>
                 </div>
                 <Link href={`/dashboard/doctor/consult/${upcoming[0].id}`}>
                   <button className="px-6 py-3 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl transition-colors shadow-sm whitespace-nowrap">
                     Start Consultation
                   </button>
                 </Link>
               </div>
            ) : (
              <div className="py-2">
                <p className="text-xl font-medium">No patients currently waiting.</p>
                <p className="text-blue-200 text-sm mt-1">Take a breather, doc!</p>
              </div>
            )}
          </div>

          {/* Up Next Queue */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="font-bold text-gray-900 text-lg">Up Next</h2>
              <span className="bg-blue-100 text-blue-700 py-1 px-3 rounded-full text-xs font-bold">
                {upcoming.length} Waiting
              </span>
            </div>
            
            <div className="divide-y divide-gray-100">
              {upcoming.slice(inProgress ? 0 : 1).map((app) => (
                <div key={app.id} className="p-6 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 text-blue-600 font-bold">
                      {app.start_time.slice(0,5)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{app.patient_name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{app.reason}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => openReschedule(app)}
                      className="px-4 py-2 bg-white text-gray-700 border border-gray-200 text-sm font-semibold rounded-lg hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 sm:translate-x-4 sm:group-hover:translate-x-0 transform duration-200"
                    >
                      Reschedule
                    </button>
                    <button 
                      onClick={() => handleCancel(app.id)}
                      className="px-4 py-2 bg-white text-red-600 border border-red-100 text-sm font-semibold rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 sm:translate-x-4 sm:group-hover:translate-x-0 transform duration-200"
                    >
                      Cancel
                    </button>
                    <Link href={`/dashboard/doctor/consult/${app.id}`}>
                      <button className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 sm:translate-x-4 sm:group-hover:translate-x-0 transform duration-200 shadow-sm whitespace-nowrap">
                        Start Consult
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
              
              {upcoming.length === 0 || (upcoming.length === 1 && !inProgress) ? (
                <div className="p-8 text-center text-gray-500">
                   <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                   <p className="font-medium text-gray-900">Queue is clear!</p>
                   <p className="text-sm mt-1">No more patients waiting right now.</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: QUICK STATS & COMPLETED ── */}
        <div className="space-y-6">
          
          {/* Quick Actions */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-2 grid grid-cols-2 gap-2">
            <Link href="/dashboard/doctor/templates" className="flex flex-col items-center justify-center p-4 rounded-xl hover:bg-gray-50 transition-colors text-center gap-2 group">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                 <ClipboardList className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-gray-700">Rx Templates</span>
            </Link>
            <Link href="/dashboard/doctor/history" className="flex flex-col items-center justify-center p-4 rounded-xl hover:bg-gray-50 transition-colors text-center gap-2 group">
              <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
                 <User className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-gray-700">Patient DB</span>
            </Link>
          </div>

          {/* Completed Today */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Completed Today ({completed.length})</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
              {completed.map(app => (
                <div key={app.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{app.patient_name}</p>
                    <p className="text-xs text-gray-500">{app.start_time.slice(0,5)} • {app.status}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              ))}
              {completed.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-400">
                  No completed consultations yet.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* DELAY MODAL */}
      {isDelayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Running Late?</h3>
            <p className="text-gray-500 text-sm mb-4">
              We&apos;ll notify all your waiting patients today via SMS/Email about the delay.
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Delay duration</label>
              <select 
                value={delayMinutes} 
                onChange={(e) => setDelayMinutes(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1 hour 30 mins</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setIsDelayModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={notifyDelay}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold shadow-sm transition-colors"
              >
                Notify Patients
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {isRescheduleModalOpen && selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">Reschedule Appointment</h3>
              <button onClick={() => setIsRescheduleModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleRescheduleSubmit} className="p-6 space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 font-bold shadow-sm">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selectedAppointment.patient_name}</p>
                  <p className="text-xs text-blue-600">Current: {selectedAppointment.start_time.slice(0,5)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
                <input 
                  type="date" 
                  value={rescheduleData.date}
                  onChange={(e) => setRescheduleData({...rescheduleData, date: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input 
                    type="time" 
                    value={rescheduleData.startTime}
                    onChange={(e) => setRescheduleData({...rescheduleData, startTime: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input 
                    type="time" 
                    value={rescheduleData.endTime}
                    onChange={(e) => setRescheduleData({...rescheduleData, endTime: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (Optional)</label>
                <input 
                  type="text" 
                  value={rescheduleData.reason}
                  onChange={(e) => setRescheduleData({...rescheduleData, reason: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Doctor emergency"
                />
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button 
                  type="button"
                  onClick={() => setIsRescheduleModalOpen(false)}
                  className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                >
                  Close
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors"
                >
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
