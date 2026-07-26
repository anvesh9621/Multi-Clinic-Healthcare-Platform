"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import { getSchedules, createSchedule, deleteSchedule, getLeaves, createLeave, deleteLeave } from "@/services/schedules";
import apiClient from "@/services/api";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, Plus, Trash2, CalendarOff } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/context/ToastContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import { DoctorSchedule, DoctorLeave } from "@/types/api";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function DoctorSchedulePage() {
  const { user } = useContext(AuthContext);
  const { success, error: toastError } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [doctorClinicId, setDoctorClinicId] = useState<number | null>(null);

  // Schedules state
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  // Form state for new schedule
  const [dayOfWeek, setDayOfWeek] = useState("0");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [slotDuration, setSlotDuration] = useState("30");

  // Leaves state
  const [leaves, setLeaves] = useState<DoctorLeave[]>([]);
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
      const profileResp = await apiClient.get("/doctors/profile/");
      const dcId = profileResp.data.data.doctor_clinic_id;
      setDoctorClinicId(dcId);

      const [schedResp, leavesResp] = await Promise.all([
        getSchedules(),
        getLeaves()
      ]);

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
    <div className="flex h-screen items-center justify-center bg-warm-surface/30">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const selectClass = "bg-warm-surface border border-border text-ink text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary block p-2 font-medium";

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-ink heading-font flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-primary" /> My Schedule & Availability
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weekly Schedule */}
        <Card className="flex flex-col p-0 overflow-hidden">
          <div className="p-5 border-b border-border bg-warm-surface/50">
            <h2 className="font-bold text-ink text-lg heading-font flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> Weekly Hours
            </h2>
            <p className="text-sm text-muted mt-1">Define your recurring weekly working hours.</p>
          </div>
          
          <div className="p-5 border-b border-border">
            <form onSubmit={handleAddSchedule} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Day</label>
                <select 
                  value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)}
                  className={`${selectClass} w-32`}
                >
                  {DAYS_OF_WEEK.map((day, idx) => (
                      <option key={idx} value={idx}>{day}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Start</label>
                <Input 
                  type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required
                  className="py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">End</label>
                <Input 
                  type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required
                  className="py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Slot (min)</label>
                <Input 
                  type="number" value={slotDuration} onChange={e => setSlotDuration(e.target.value)} required min="5" step="5"
                  className="w-20 py-1.5"
                />
              </div>
              <Button type="submit" size="sm" className="self-end">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </form>
          </div>
          
          <div className="flex-1 p-5 overflow-y-auto">
            {schedules.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">No working hours defined. You will not be bookable.</p>
            ) : (
              <div className="space-y-3">
                {DAYS_OF_WEEK.map((dayName, dayIndex) => {
                  const daySchedules = schedules.filter(s => s.day_of_week === dayIndex);
                  if (daySchedules.length === 0) return null;
                  
                  return (
                    <div key={dayIndex} className="bg-warm-surface/50 rounded-xl p-4 border border-border flex items-start justify-between group">
                      <div>
                        <h3 className="font-bold text-ink">{dayName}</h3>
                        <div className="mt-1 space-y-1">
                          {daySchedules.map(s => (
                            <div key={s.id} className="text-sm text-muted flex items-center gap-2">
                              <span className="font-semibold text-ink font-mono">{s.start_time.slice(0,5)} - {s.end_time.slice(0,5)}</span>
                              <span className="text-xs bg-warm-surface border border-border px-2 rounded-full font-medium text-muted">{s.slot_duration}m slots</span>
                              <button onClick={() => handleDeleteSchedule(s.id)} className="text-rose-600 hover:text-rose-800 p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">
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
        </Card>

        {/* Time Off / Leaves */}
        <Card className="flex flex-col p-0 overflow-hidden">
          <div className="p-5 border-b border-border bg-rose-50/50">
            <h2 className="font-bold text-ink text-lg heading-font flex items-center gap-2">
              <CalendarOff className="w-5 h-5 text-rose-600" /> Time Off / Leaves
            </h2>
            <p className="text-sm text-muted mt-1">Block out dates when you are unavailable.</p>
          </div>
          
          <div className="p-5 border-b border-border">
             <form onSubmit={handleAddLeave} className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-ink mb-1">Start Date</label>
                    <Input 
                      type="date" value={leaveStartDate} onChange={e => setLeaveStartDate(e.target.value)} required min={new Date().toISOString().split("T")[0]}
                      className="py-1.5"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-ink mb-1">End Date</label>
                    <Input 
                      type="date" value={leaveEndDate} onChange={e => setLeaveEndDate(e.target.value)} required min={leaveStartDate || new Date().toISOString().split("T")[0]}
                      className="py-1.5"
                    />
                  </div>
                </div>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-ink mb-1">Reason (Optional)</label>
                    <Input 
                      type="text" value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="e.g. Vacation, Conference"
                      className="py-1.5"
                    />
                  </div>
                  <Button type="submit" size="sm" variant="secondary" className="border-rose-200 text-rose-800 hover:bg-rose-100">
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
             </form>
          </div>

          <div className="flex-1 p-5 overflow-y-auto">
             {leaves.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">No upcoming time off requested.</p>
             ) : (
                <div className="space-y-3">
                   {leaves.map(leave => (
                       <div key={leave.id} className="bg-rose-50/40 rounded-xl p-4 border border-rose-200 flex items-center justify-between">
                           <div>
                               <div className="font-bold text-ink text-sm font-mono">
                                   {format(new Date(leave.start_date), "MMM d, yyyy")} 
                                   {" "}-{" "} 
                                   {format(new Date(leave.end_date), "MMM d, yyyy")}
                               </div>
                               {leave.reason && <p className="text-xs text-muted mt-0.5">{leave.reason}</p>}
                           </div>
                           <Button variant="ghost" size="icon" onClick={() => handleDeleteLeave(leave.id)} className="text-rose-600 hover:text-rose-800 border border-rose-200 bg-paper" title="Cancel Time Off">
                              <Trash2 className="w-4 h-4" />
                           </Button>
                       </div>
                   ))}
                </div>
             )}
          </div>
        </Card>
      </div>
    </div>
  );
}
