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
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { MotionDivItem } from "@/components/ui/MotionListItem";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

import type { Appointment } from "@/types/api";

export default function DoctorDashboard() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
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
    reason: "",
  });

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (user && user.role !== "DOCTOR") {
      router.push("/dashboard");
      return;
    }

    if (user) {
      fetchAppointments();
      intervalId = setInterval(() => {
        fetchAppointments();
      }, 15000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, router, retryCount]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get("/appointments/");
      const todayStr = new Date().toISOString().split("T")[0];
      const appointmentsData = response.data.results || response.data;

      const todayAppointments = appointmentsData
        .filter((app: any) => app.appointment_date === todayStr)
        .map((app: any) => ({
          id: app.id,
          patient_name: app.patient_name || `Patient #${app.patient}`,
          patient_id: app.patient,
          appointment_date: app.appointment_date,
          start_time: app.start_time,
          end_time: app.end_time,
          status: app.status,
          reason: app.reason || "General Consultation",
        }));

      todayAppointments.sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
      setAppointments(todayAppointments);
    } catch (err) {
      console.error("Failed to load appointments:", err);
      setError("Couldn't load your appointments right now.");
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
      fetchAppointments();
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
      reason: "Doctor requested reschedule.",
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
        reason: rescheduleData.reason,
      });
      success("Rescheduled", "Appointment rescheduled successfully.");
      setIsRescheduleModalOpen(false);
      fetchAppointments();
    } catch (error: any) {
      toastError("Reschedule Failed", error.response?.data?.error || "Please check doctor availability.");
    }
  };

  if (loading && appointments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const inProgress = appointments.find((a) => a.status === "IN_PROGRESS");
  const upcoming = appointments.filter((a) => ["SCHEDULED", "CONFIRMED"].includes(a.status));
  const completed = appointments.filter((a) => ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(a.status));

  const selectClass = "w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-warm-surface text-ink text-sm font-medium transition shadow-sm";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink heading-font">
            Good Morning, Dr. {user?.first_name || "Doctor"}
          </h1>
          <p className="text-muted mt-1">Here is your schedule for today, {format(new Date(), "MMMM d, yyyy")}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:block w-64">
            <Input
              type="text"
              placeholder="Quick search patient..."
              icon={<Search className="w-4 h-4 text-muted" />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => setIsDelayModalOpen(true)}
            className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-none flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-amber-700" /> Running Late?
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">Something went wrong</h2>
          <p className="text-muted mb-6">{error}</p>
          <Button onClick={() => { setLoading(true); setError(null); setRetryCount((r) => r + 1); }}>
            Try Again
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── LEFT COLUMN: TODAY'S QUEUE ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Currently Serving Box */}
            <div className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-6 text-white shadow-lg shadow-primary/20">
              <h2 className="text-primary-light font-semibold text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Now Serving
              </h2>

              {inProgress ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-3xl font-bold heading-font">{inProgress.patient_name}</h3>
                    <div className="flex items-center gap-4 mt-2 text-white/90 text-sm">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> Started at {inProgress.start_time.slice(0, 5)}</span>
                      <span className="flex items-center gap-1"><ClipboardList className="w-4 h-4" /> {inProgress.reason}</span>
                    </div>
                  </div>
                  <Link href={`/dashboard/doctor/consult/${inProgress.id}`}>
                    <Button variant="secondary" className="bg-white text-primary hover:bg-warm-surface border-none shadow-sm whitespace-nowrap">
                      Resume Consultation
                    </Button>
                  </Link>
                </div>
              ) : upcoming.length > 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-3xl font-bold heading-font">{upcoming[0].patient_name}</h3>
                    <div className="flex items-center gap-4 mt-2 text-white/90 text-sm">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> Scheduled for {upcoming[0].start_time.slice(0, 5)}</span>
                      <span className="flex items-center gap-1"><ClipboardList className="w-4 h-4" /> {upcoming[0].reason}</span>
                    </div>
                  </div>
                  <Link href={`/dashboard/doctor/consult/${upcoming[0].id}`}>
                    <Button variant="secondary" className="bg-white text-primary hover:bg-warm-surface border-none shadow-sm whitespace-nowrap">
                      Start Consultation
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="py-2">
                  <p className="text-xl font-medium heading-font">No patients currently waiting.</p>
                  <p className="text-white/80 text-sm mt-1">Take a breather, doc!</p>
                </div>
              )}
            </div>

            {/* Up Next Queue */}
            <Card className="overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-warm-surface/50">
                <h2 className="font-bold text-ink text-lg heading-font">Up Next</h2>
                <span className="bg-primary/10 text-primary py-1 px-3 rounded-full text-xs font-bold flex gap-1 items-center">
                  <AnimatedNumber value={upcoming.length} /> Waiting
                </span>
              </div>

              <div className="divide-y divide-border">
                <AnimatePresence mode="popLayout">
                  {upcoming.slice(inProgress ? 0 : 1).map((app) => (
                    <MotionDivItem key={app.id} className="p-6 hover:bg-warm-surface/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 text-primary font-bold font-mono">
                          {app.start_time.slice(0, 5)}
                        </div>
                        <div>
                          <h3 className="font-bold text-ink text-lg">{app.patient_name}</h3>
                          <p className="text-sm text-muted mt-0.5">{app.reason}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openReschedule(app)}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        >
                          Reschedule
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancel(app.id)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        >
                          Cancel
                        </Button>
                        <Link href={`/dashboard/doctor/consult/${app.id}`}>
                          <Button size="sm" className="whitespace-nowrap">
                            Start Consult
                          </Button>
                        </Link>
                      </div>
                    </MotionDivItem>
                  ))}
                </AnimatePresence>

                {upcoming.length === 0 || (upcoming.length === 1 && !inProgress) ? (
                  <div className="p-8 text-center text-muted">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                    <p className="font-bold text-ink">Queue is clear!</p>
                    <p className="text-sm mt-1 text-muted">No more patients waiting right now.</p>
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          {/* ── RIGHT COLUMN: QUICK STATS & COMPLETED ── */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="p-2 grid grid-cols-2 gap-2">
              <Link href="/dashboard/doctor/templates" className="flex flex-col items-center justify-center p-4 rounded-xl hover:bg-warm-surface/50 transition-colors text-center gap-2 group">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-ink">Rx Templates</span>
              </Link>
              <Link href="/dashboard/doctor/history" className="flex flex-col items-center justify-center p-4 rounded-xl hover:bg-warm-surface/50 transition-colors text-center gap-2 group">
                <div className="w-10 h-10 bg-accent/10 text-accent rounded-full flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors">
                  <User className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-ink">Patient DB</span>
              </Link>
            </Card>

            {/* Completed Today */}
            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-bold text-ink heading-font flex gap-1 items-center">
                  Completed Today (<AnimatedNumber value={completed.length} />)
                </h3>
              </div>
              <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {completed.map((app) => (
                  <div key={app.id} className="px-5 py-3 flex items-center justify-between hover:bg-warm-surface/50 transition-colors">
                    <div>
                      <p className="font-semibold text-sm text-ink">{app.patient_name}</p>
                      <p className="text-xs text-muted mt-0.5">{app.start_time.slice(0, 5)} • {app.status}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted" />
                  </div>
                ))}
                {completed.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted">
                    No completed consultations yet.
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* DELAY MODAL */}
      <Modal isOpen={isDelayModalOpen} onClose={() => setIsDelayModalOpen(false)} title="Running Late?" className="max-w-sm">
        <p className="text-muted text-sm mb-4">
          We&apos;ll notify all your waiting patients today via SMS/Email about the delay.
        </p>
        <div className="mb-6">
          <label className="block text-sm font-semibold text-ink mb-2">Delay duration</label>
          <select
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(Number(e.target.value))}
            className={selectClass}
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
          <Button variant="secondary" onClick={() => setIsDelayModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={notifyDelay} className="bg-amber-600 hover:bg-amber-700 text-white border-none">
            Notify Patients
          </Button>
        </div>
      </Modal>

      {/* RESCHEDULE MODAL */}
      <Modal isOpen={isRescheduleModalOpen} onClose={() => setIsRescheduleModalOpen(false)} title="Reschedule Appointment" className="max-w-md">
        {selectedAppointment && (
          <form onSubmit={handleRescheduleSubmit} className="space-y-4">
            <div className="bg-primary/10 p-3 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-paper rounded-full flex items-center justify-center text-primary font-bold shadow-sm">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{selectedAppointment.patient_name}</p>
                <p className="text-xs text-primary font-medium">Current: {selectedAppointment.start_time.slice(0, 5)}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-ink mb-1">New Date</label>
              <Input
                type="date"
                value={rescheduleData.date}
                onChange={(e) => setRescheduleData({ ...rescheduleData, date: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-ink mb-1">Start Time</label>
                <Input
                  type="time"
                  value={rescheduleData.startTime}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, startTime: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-1">End Time</label>
                <Input
                  type="time"
                  value={rescheduleData.endTime}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, endTime: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-ink mb-1">Reason (Optional)</label>
              <Input
                type="text"
                value={rescheduleData.reason}
                onChange={(e) => setRescheduleData({ ...rescheduleData, reason: e.target.value })}
                placeholder="e.g. Doctor emergency"
              />
            </div>

            <div className="pt-4 flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={() => setIsRescheduleModalOpen(false)}>
                Close
              </Button>
              <Button type="submit">
                Confirm Reschedule
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
