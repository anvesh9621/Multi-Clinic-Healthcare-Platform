"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import { getSchedules, createSchedule, deleteSchedule, getLeaves, createLeave, deleteLeave } from "@/services/schedules";
import apiClient from "@/services/api";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, Plus, Trash2, CalendarOff } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/context/ToastContext";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function DoctorSchedulePage() {
  const { user } = useContext(AuthContext);
  const { success, error: toastError } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [doctorClinicId, setDoctorClinicId] = useState<number | null>(null);

  // Schedules state
  const [schedules, setSchedules] = useState<any[]>([]);
  // Form state for new schedule
  const [dayOfWeek, setDayOfWeek] = useState("0");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [slotDuration, setSlotDuration] = useState("30");

  // Leaves state
  const [leaves, setLeaves] = useState<any[]>([]);
  // Form state for new leave
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  useEffect(() => {
    if (user && user.role !== "DOCTOR") {
      router.push("/dashboard");
      return;
    }
    fetchData();
  }, [user, router]);

  const fetchData = async () => {
    try {
      // 1. Get doctor profile to find doctor_clinic_id
      const profileResp = await apiClient.get("/doctors/profile/");
      const dcId = profileResp.data.data.doctor_clinic_id;
      setDoctorClinicId(dcId);

      // 2. Fetch schedules and leaves
      const [schedResp, leavesResp] = await Promise.all([
        getSchedules(),
        getLeaves()
      ]);

      // Filter to only show for this doctor (if API returns more, though get_queryset should limit it)
      if (schedResp.results || Array.isArray(schedResp)) {
        const scheds = (schedResp.results || schedResp).filter((s: any) => s.doctor_clinic_id === dcId);
        setSchedules(scheds);
      }
      if (leavesResp.results || Array.isArray(leavesResp)) {
         setLeaves(leavesResp.results || leavesResp);
      }
    } catch (error) {
      console.error("Failed to load schedule data", error);
      toastError("Failed to load schedule data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorClinicId) return;

    try {
      const resp = await createSchedule({
        doctor_clinic_id: doctorClinicId,
        day_of_week: parseInt(dayOfWeek),
        start_time: startTime,
        end_time: endTime,
        slot_duration: parseInt(slotDuration),
      });
      setSchedules([...schedules, resp]);
      success("Schedule added successfully");
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.non_field_errors?.[0] || "Failed to add schedule";
      toastError(msg);
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    if (!confirm("Remove this schedule?")) return;
    try {
      await deleteSchedule(id);
      setSchedules(schedules.filter(s => s.id !== id));
      success("Schedule removed");
    } catch (error) {
      console.error(error);
      toastError("Failed to remove schedule");
    }
  };

  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorClinicId) return;
    
    if (new Date(leaveStartDate) > new Date(leaveEndDate)) {
        toastError("End date must be after start date");
        return;
    }

    try {
      const resp = await createLeave({
        doctor_clinic_id: doctorClinicId,
        start_date: leaveStartDate,
        end_date: leaveEndDate,
        reason: leaveReason,
      });
      setLeaves([resp, ...leaves]);
      success("Time off added successfully");
      setLeaveStartDate("");
      setLeaveEndDate("");
      setLeaveReason("");
    } catch (error: any) {
      console.error(error);
      toastError("Failed to add time off");
    }
  };

  const handleDeleteLeave = async (id: number) => {
    if (!confirm("Cancel this time off request?")) return;
    try {
      await deleteLeave(id);
      setLeaves(leaves.filter(l => l.id !== id));
      success("Time off cancelled");
    } catch (error) {
      console.error(error);
      toastError("Failed to cancel time off");
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-blue-600" /> My Schedule & Availability
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Weekly Schedule */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" /> Weekly Hours
            </h2>
            <p className="text-sm text-gray-500 mt-1">Define your recurring weekly working hours.</p>
          </div>
          
          <div className="p-5 border-b border-gray-100">
            <form onSubmit={handleAddSchedule} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Day</label>
                <select 
                  value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)}
                  className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-32 p-2"
                >
                  {DAYS_OF_WEEK.map((day, idx) => (
                      <option key={idx} value={idx}>{day}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Start</label>
                <input 
                  type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required
                  className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">End</label>
                <input 
                  type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required
                  className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Slot (min)</label>
                <input 
                  type="number" value={slotDuration} onChange={e => setSlotDuration(e.target.value)} required min="5" step="5"
                  className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-20 p-2"
                />
              </div>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm px-4 py-2 flex items-center gap-1 transition-colors">
                <Plus className="w-4 h-4" /> Add
              </button>
            </form>
          </div>
          
          <div className="flex-1 p-5 overflow-y-auto">
            {schedules.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No working hours defined. You will not be bookable.</p>
            ) : (
                <div className="space-y-3">
                    {/* Group by day to make it look nicer */}
                    {DAYS_OF_WEEK.map((dayName, dayIndex) => {
                        const daySchedules = schedules.filter(s => s.day_of_week === dayIndex);
                        if (daySchedules.length === 0) return null;
                        
                        return (
                            <div key={dayIndex} className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-start justify-between group">
                                <div>
                                    <h3 className="font-bold text-gray-800">{dayName}</h3>
                                    <div className="mt-1 space-y-1">
                                        {daySchedules.map(s => (
                                            <div key={s.id} className="text-sm text-gray-600 flex items-center gap-2">
                                                <span className="font-medium">{s.start_time.slice(0,5)} - {s.end_time.slice(0,5)}</span>
                                                <span className="text-xs bg-gray-200 px-2 rounded-full">{s.slot_duration}m slots</span>
                                                <button onClick={() => handleDeleteSchedule(s.id)} className="text-red-500 hover:text-red-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
          </div>
        </div>

        {/* Time Off / Leaves */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 bg-rose-50/30">
            <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <CalendarOff className="w-5 h-5 text-rose-600" /> Time Off / Leaves
            </h2>
            <p className="text-sm text-gray-500 mt-1">Block out dates when you are unavailable.</p>
          </div>
          
          <div className="p-5 border-b border-gray-100">
             <form onSubmit={handleAddLeave} className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                    <input 
                      type="date" value={leaveStartDate} onChange={e => setLeaveStartDate(e.target.value)} required min={new Date().toISOString().split("T")[0]}
                      className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-rose-500 focus:border-rose-500 block w-full p-2"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
                    <input 
                      type="date" value={leaveEndDate} onChange={e => setLeaveEndDate(e.target.value)} required min={leaveStartDate || new Date().toISOString().split("T")[0]}
                      className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-rose-500 focus:border-rose-500 block w-full p-2"
                    />
                  </div>
                </div>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Reason (Optional)</label>
                    <input 
                      type="text" value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="e.g. Vacation, Conference"
                      className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-rose-500 focus:border-rose-500 block w-full p-2"
                    />
                  </div>
                  <button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg text-sm px-4 py-2 flex items-center gap-1 transition-colors h-[38px]">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
             </form>
          </div>

          <div className="flex-1 p-5 overflow-y-auto">
             {leaves.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No upcoming time off requested.</p>
             ) : (
                <div className="space-y-3">
                   {leaves.map(leave => (
                       <div key={leave.id} className="bg-rose-50/50 rounded-xl p-4 border border-rose-100 flex items-center justify-between">
                           <div>
                               <div className="font-bold text-gray-800 text-sm">
                                   {format(new Date(leave.start_date), "MMM d, yyyy")} 
                                   {" "}-{" "} 
                                   {format(new Date(leave.end_date), "MMM d, yyyy")}
                               </div>
                               {leave.reason && <p className="text-xs text-gray-500 mt-0.5">{leave.reason}</p>}
                           </div>
                           <button onClick={() => handleDeleteLeave(leave.id)} className="text-red-500 hover:text-red-700 bg-white p-2 border border-red-100 rounded-lg shadow-sm transition-colors" title="Cancel Time Off">
                              <Trash2 className="w-4 h-4" />
                           </button>
                       </div>
                   ))}
                </div>
             )}
          </div>
        </div>

      </div>
    </div>
  );
}
