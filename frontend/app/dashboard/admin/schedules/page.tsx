"use client";

import { useEffect, useState, useContext, useCallback, useMemo } from "react";
import { AuthContext } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getDoctors } from "@/services/doctors";
import {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from "@/services/schedules";
import {
  Clock,
  Calendar,
  Plus,
  Trash2,
  Edit3,
  User,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { DoctorEntry, DoctorSchedule } from "@/types/api";

const DAYS_OF_WEEK = [
  { value: 0, label: "Monday", short: "Mon" },
  { value: 1, label: "Tuesday", short: "Tue" },
  { value: 2, label: "Wednesday", short: "Wed" },
  { value: 3, label: "Thursday", short: "Thu" },
  { value: 4, label: "Friday", short: "Fri" },
  { value: 5, label: "Saturday", short: "Sat" },
  { value: 6, label: "Sunday", short: "Sun" },
];

function formatTime12h(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export default function SchedulePage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();

  // Data state
  const [doctors, setDoctors] = useState<DoctorEntry[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);

  // Loading states
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Active view state
  const [activeDay, setActiveDay] = useState<number>(0);

  // Notification / error state
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add block state
  const [newBlocks, setNewBlocks] = useState<
    Array<{ start_time: string; end_time: string; slot_duration: number }>
  >([{ start_time: "", end_time: "", slot_duration: 30 }]);

  // Edit block state
  const [editingBlock, setEditingBlock] = useState<DoctorSchedule | null>(null);
  const [editForm, setEditForm] = useState<{
    start_time: string;
    end_time: string;
    slot_duration: number;
    day_of_week: number;
  }>({ start_time: "", end_time: "", slot_duration: 30, day_of_week: 0 });

  // Delete confirmation state
  const [deletingBlockId, setDeletingBlockId] = useState<number | null>(null);

  // Error message extractor
  const extractErrorMessage = (err: any): string => {
    if (!err?.response?.data) {
      return err?.message || "Operation failed. Please try again.";
    }
    const data = err.response.data;

    if (data.errors) {
      if (typeof data.errors === "string") return data.errors;
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        return typeof data.errors[0] === "string" ? data.errors[0] : JSON.stringify(data.errors[0]);
      }
      if (typeof data.errors === "object") {
        if (data.errors.detail) {
          return Array.isArray(data.errors.detail) ? data.errors.detail[0] : data.errors.detail;
        }
        if (data.errors.doctor_clinic_id) {
          return Array.isArray(data.errors.doctor_clinic_id)
            ? data.errors.doctor_clinic_id[0]
            : data.errors.doctor_clinic_id;
        }
        if (data.errors.end_time) {
          return Array.isArray(data.errors.end_time) ? data.errors.end_time[0] : data.errors.end_time;
        }
        if (data.errors.start_time) {
          return Array.isArray(data.errors.start_time) ? data.errors.start_time[0] : data.errors.start_time;
        }
        const firstKey = Object.keys(data.errors)[0];
        if (firstKey && data.errors[firstKey]) {
          const val = data.errors[firstKey];
          return Array.isArray(val) ? val[0] : val;
        }
      }
    }

    if (data.detail) return data.detail;
    if (data.error) return data.error;
    if (data.message) return data.message;

    return "Failed to save schedule. Please check the times and try again.";
  };

  // Auth guard
  useEffect(() => {
    if (user && user.role !== "CLINIC_ADMIN" && user.role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    }
  }, [user, router]);

  // Load doctors on mount
  useEffect(() => {
    const fetchDoctors = async () => {
      setLoadingDoctors(true);
      try {
        const data = await getDoctors();
        const docList = Array.isArray(data) ? data : data?.results || [];
        setDoctors(docList);
        if (docList.length > 0) {
          setSelectedDoctorId(String(docList[0].id));
        }
      } catch (err) {
        setError("Failed to load doctors list.");
      } finally {
        setLoadingDoctors(false);
      }
    };
    fetchDoctors();
  }, []);

  // Fetch full week schedules when selected doctor changes
  const fetchDoctorSchedules = useCallback(async (docClinicId: number) => {
    setLoadingSchedules(true);
    setError(null);
    try {
      const data = await getSchedules({ doctor_clinic_id: docClinicId });
      setSchedules(data);
    } catch (err) {
      setError(extractErrorMessage(err));
      setSchedules([]);
    } finally {
      setLoadingSchedules(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDoctorId) {
      fetchDoctorSchedules(Number(selectedDoctorId));
    } else {
      setSchedules([]);
    }
  }, [selectedDoctorId, fetchDoctorSchedules]);

  // Group schedules by day_of_week
  const schedulesByDay = useMemo(() => {
    const map: Record<number, DoctorSchedule[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    schedules.forEach((s) => {
      if (map[s.day_of_week] !== undefined) {
        map[s.day_of_week].push(s);
      }
    });
    // Sort blocks chronologically
    Object.keys(map).forEach((d) => {
      map[Number(d)].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    });
    return map;
  }, [schedules]);

  const activeDayBlocks = schedulesByDay[activeDay] || [];

  // Check client-side overlap against existing blocks
  const checkOverlap = (
    day: number,
    startStr: string,
    endStr: string,
    excludeId?: number
  ): boolean => {
    const startMin = timeToMinutes(startStr);
    const endMin = timeToMinutes(endStr);
    if (startMin >= endMin) return false;

    const existing = schedulesByDay[day] || [];
    return existing.some((b) => {
      if (excludeId && b.id === excludeId) return false;
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      return startMin < bEnd && endMin > bStart;
    });
  };

  // Add block handler
  const handleAddBlockRow = () => {
    setNewBlocks((prev) => [...prev, { start_time: "", end_time: "", slot_duration: 30 }]);
  };

  const handleUpdateBlockRow = (index: number, field: string, value: any) => {
    setNewBlocks((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveBlockRow = (index: number) => {
    setNewBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit new blocks concurrently with Promise.all
  const handleCreateBlocks = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!selectedDoctorId) {
      setError("Please select a doctor first.");
      return;
    }

    // Validation
    for (let i = 0; i < newBlocks.length; i++) {
      const b = newBlocks[i];
      if (!b.start_time || !b.end_time) {
        setError(`Please fill in both start and end time for block #${i + 1}.`);
        return;
      }
      if (timeToMinutes(b.start_time) >= timeToMinutes(b.end_time)) {
        setError(`Block #${i + 1}: End time must be after start time.`);
        return;
      }
      if (checkOverlap(activeDay, b.start_time, b.end_time)) {
        setError(
          `Block #${i + 1} (${formatTime12h(b.start_time)} - ${formatTime12h(
            b.end_time
          )}) overlaps with an existing schedule on ${DAYS_OF_WEEK[activeDay].label}.`
        );
        return;
      }
    }

    // Check internal overlap among the new blocks
    for (let i = 0; i < newBlocks.length; i++) {
      for (let j = i + 1; j < newBlocks.length; j++) {
        const b1 = newBlocks[i];
        const b2 = newBlocks[j];
        const s1 = timeToMinutes(b1.start_time);
        const e1 = timeToMinutes(b1.end_time);
        const s2 = timeToMinutes(b2.start_time);
        const e2 = timeToMinutes(b2.end_time);
        if (s1 < e2 && e1 > s2) {
          setError(`New block #${i + 1} and block #${j + 1} overlap with each other.`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const promises = newBlocks.map((b) =>
        createSchedule({
          doctor_clinic_id: Number(selectedDoctorId),
          day_of_week: activeDay,
          start_time: b.start_time.length === 5 ? `${b.start_time}:00` : b.start_time,
          end_time: b.end_time.length === 5 ? `${b.end_time}:00` : b.end_time,
          slot_duration: Number(b.slot_duration) || 30,
        })
      );

      const createdList = await Promise.all(promises);
      setSchedules((prev) => [...prev, ...createdList]);
      setNewBlocks([{ start_time: "", end_time: "", slot_duration: 30 }]);
      setSuccessMsg(
        `Added ${createdList.length} schedule block${
          createdList.length > 1 ? "s" : ""
        } for ${DAYS_OF_WEEK[activeDay].label}.`
      );
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (block: DoctorSchedule) => {
    setEditingBlock(block);
    setEditForm({
      start_time: block.start_time.slice(0, 5),
      end_time: block.end_time.slice(0, 5),
      slot_duration: block.slot_duration,
      day_of_week: block.day_of_week,
    });
    setError(null);
  };

  // Submit Edit
  const handleSaveEdit = async () => {
    if (!editingBlock) return;
    setError(null);

    if (!editForm.start_time || !editForm.end_time) {
      setError("Please specify both start and end time.");
      return;
    }
    if (timeToMinutes(editForm.start_time) >= timeToMinutes(editForm.end_time)) {
      setError("End time must be after start time.");
      return;
    }
    if (checkOverlap(editForm.day_of_week, editForm.start_time, editForm.end_time, editingBlock.id)) {
      setError(
        `This time block overlaps with another schedule on ${DAYS_OF_WEEK[editForm.day_of_week].label}.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateSchedule(editingBlock.id, {
        day_of_week: editForm.day_of_week,
        start_time: editForm.start_time.length === 5 ? `${editForm.start_time}:00` : editForm.start_time,
        end_time: editForm.end_time.length === 5 ? `${editForm.end_time}:00` : editForm.end_time,
        slot_duration: Number(editForm.slot_duration) || 30,
      });

      setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditingBlock(null);
      setSuccessMsg("Schedule block updated successfully.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Delete with confirmation
  const handleConfirmDelete = async () => {
    if (!deletingBlockId) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteSchedule(deletingBlockId);
      setSchedules((prev) => prev.filter((s) => s.id !== deletingBlockId));
      setDeletingBlockId(null);
      setSuccessMsg("Schedule block deleted successfully.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const selectClass =
    "w-full pl-11 pr-4 py-3 bg-warm-surface border border-border rounded-xl text-ink font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition shadow-sm";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink heading-font flex items-center gap-3">
          <Calendar className="w-8 h-8 text-primary" /> Doctor Schedules
        </h1>
        <p className="text-muted mt-1">
          Manage weekly recurring availability, slot durations, and consultation shifts for clinic doctors.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-sm shadow-sm animate-fade-in-up">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-700 p-1 rounded-lg transition"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-sm font-medium shadow-sm animate-fade-in-up">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-500 hover:text-emerald-800 p-1 rounded-lg transition"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Doctor Selector Card */}
      <Card className="p-6 border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <label htmlFor="doctor_select" className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
              Select Doctor
            </label>
            {loadingDoctors ? (
              <Skeleton className="h-12 w-full rounded-xl" />
            ) : (
              <div className="relative">
                <select
                  id="doctor_select"
                  className={selectClass}
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  disabled={doctors.length === 0}
                  aria-label="Select Doctor"
                >
                  {doctors.length === 0 ? (
                    <option value="">No active doctors found in clinic</option>
                  ) : (
                    doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.first_name
                          ? `Dr. ${doc.first_name} ${doc.last_name || ""} (${doc.specialization || "General"})`
                          : doc.doctor_email}
                      </option>
                    ))
                  )}
                </select>
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="text-right">
              <span className="text-xs text-muted block font-medium">Total Weekly Blocks</span>
              <span className="text-xl font-bold text-ink font-mono">{schedules.length}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 7-Day Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {DAYS_OF_WEEK.map((day) => {
          const count = (schedulesByDay[day.value] || []).length;
          const isActive = activeDay === day.value;
          return (
            <button
              key={day.value}
              onClick={() => setActiveDay(day.value)}
              className={`p-3 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between gap-2 ${
                isActive
                  ? "bg-primary text-white border-primary shadow-md shadow-primary/20 scale-[1.02]"
                  : "bg-paper text-ink border-border hover:border-primary/40 hover:bg-warm-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">{day.short}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    isActive
                      ? "bg-white/20 text-white"
                      : count > 0
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/10 text-muted"
                  }`}
                >
                  {count}
                </span>
              </div>
              <span className={`text-xs ${isActive ? "text-white/80" : "text-muted"}`}>
                {count === 0 ? "Off" : `${count} shift${count > 1 ? "s" : ""}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Day Schedule & Management Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Existing Blocks for Active Day (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink heading-font flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {DAYS_OF_WEEK[activeDay].label} Availability
            </h2>
            <span className="text-xs font-semibold text-muted">
              {activeDayBlocks.length} block{activeDayBlocks.length === 1 ? "" : "s"} scheduled
            </span>
          </div>

          {loadingSchedules ? (
            <div className="space-y-3 p-6 bg-paper rounded-2xl border border-border">
              <div className="flex items-center justify-center py-10 gap-3 text-muted">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-sm font-medium">Loading schedules...</span>
              </div>
            </div>
          ) : activeDayBlocks.length === 0 ? (
            <Card className="p-8 text-center border-dashed border-border bg-warm-surface/40">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6" />
              </div>
              <p className="font-bold text-ink text-sm">No schedule blocks for {DAYS_OF_WEEK[activeDay].label}</p>
              <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
                The doctor is currently unavailable on this day. Use the form on the right to configure active consultation shifts.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeDayBlocks.map((block, idx) => {
                const startMin = timeToMinutes(block.start_time);
                const endMin = timeToMinutes(block.end_time);
                const totalMinutes = endMin - startMin;
                const estimatedSlots =
                  block.slot_duration > 0 ? Math.floor(totalMinutes / block.slot_duration) : 0;

                return (
                  <Card
                    key={block.id}
                    className="p-4 border-border hover:border-primary/30 transition-all flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink text-sm">
                            {formatTime12h(block.start_time)} – {formatTime12h(block.end_time)}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                            Active
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-0.5">
                          {block.slot_duration} min slots • ~{estimatedSlots} bookable slots
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(block)}
                        className="text-muted hover:text-primary hover:bg-primary/10 w-8 h-8 rounded-lg"
                        title="Edit schedule block"
                        aria-label="Edit schedule block"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingBlockId(block.id)}
                        className="text-muted hover:text-red-600 hover:bg-red-50 w-8 h-8 rounded-lg"
                        title="Delete schedule block"
                        aria-label="Delete schedule block"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Add New Block Form (5 Cols) */}
        <div className="lg:col-span-5">
          <Card className="p-6 border-border space-y-6 sticky top-24">
            <div>
              <h3 className="text-base font-bold text-ink heading-font flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" /> Add Time Blocks ({DAYS_OF_WEEK[activeDay].label})
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Add recurring consultation blocks for {DAYS_OF_WEEK[activeDay].label}.
              </p>
            </div>

            <form onSubmit={handleCreateBlocks} className="space-y-4">
              {newBlocks.map((block, idx) => {
                const hasOverlap =
                  block.start_time &&
                  block.end_time &&
                  checkOverlap(activeDay, block.start_time, block.end_time);

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all space-y-3 relative ${
                      hasOverlap
                        ? "bg-amber-50/50 border-amber-300"
                        : "bg-warm-surface/60 border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted uppercase tracking-wider">
                        Block #{idx + 1}
                      </span>
                      {newBlocks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBlockRow(idx)}
                          className="text-muted hover:text-red-600 text-xs font-semibold p-1"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor={`start_time_${idx}`} className="block text-[11px] font-bold text-muted mb-1">
                          Start Time
                        </label>
                        <Input
                          id={`start_time_${idx}`}
                          aria-label="Start Time"
                          type="time"
                          value={block.start_time}
                          onChange={(e) => handleUpdateBlockRow(idx, "start_time", e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor={`end_time_${idx}`} className="block text-[11px] font-bold text-muted mb-1">
                          End Time
                        </label>
                        <Input
                          id={`end_time_${idx}`}
                          aria-label="End Time"
                          type="time"
                          value={block.end_time}
                          onChange={(e) => handleUpdateBlockRow(idx, "end_time", e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor={`slot_duration_${idx}`} className="block text-[11px] font-bold text-muted mb-1">
                        Slot Duration
                      </label>
                      <select
                        id={`slot_duration_${idx}`}
                        aria-label="Slot Duration"
                        className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-ink font-medium text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        value={block.slot_duration}
                        onChange={(e) =>
                          handleUpdateBlockRow(idx, "slot_duration", Number(e.target.value))
                        }
                      >
                        <option value={15}>15 minutes</option>
                        <option value={20}>20 minutes</option>
                        <option value={30}>30 minutes (Standard)</option>
                        <option value={45}>45 minutes</option>
                        <option value={60}>60 minutes</option>
                      </select>
                    </div>

                    {hasOverlap && (
                      <div className="flex items-center gap-1.5 text-amber-700 text-xs font-medium pt-1">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Warning: Overlaps an existing schedule block!</span>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddBlockRow}
                  className="text-primary font-bold text-xs"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Another Row
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || !selectedDoctorId}
                  className="font-bold text-xs"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...
                    </>
                  ) : (
                    <>Save Configuration</>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      {editingBlock && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 bg-paper border-border shadow-2xl space-y-5 animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-ink heading-font flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" /> Edit Schedule Block
              </h3>
              <button
                onClick={() => setEditingBlock(null)}
                className="text-muted hover:text-ink p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="edit_day_of_week" className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
                  Day of Week
                </label>
                <select
                  id="edit_day_of_week"
                  aria-label="Day of Week"
                  className="w-full px-3 py-2.5 bg-warm-surface border border-border rounded-xl text-ink font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={editForm.day_of_week}
                  onChange={(e) => setEditForm({ ...editForm, day_of_week: Number(e.target.value) })}
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit_start_time" className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
                    Start Time
                  </label>
                  <Input
                    id="edit_start_time"
                    aria-label="Start Time"
                    type="time"
                    value={editForm.start_time}
                    onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="edit_end_time" className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
                    End Time
                  </label>
                  <Input
                    id="edit_end_time"
                    aria-label="End Time"
                    type="time"
                    value={editForm.end_time}
                    onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit_slot_duration" className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
                  Slot Duration (Minutes)
                </label>
                <select
                  id="edit_slot_duration"
                  aria-label="Slot Duration"
                  className="w-full px-3 py-2.5 bg-warm-surface border border-border rounded-xl text-ink font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={editForm.slot_duration}
                  onChange={(e) => setEditForm({ ...editForm, slot_duration: Number(e.target.value) })}
                >
                  <option value={15}>15 minutes</option>
                  <option value={20}>20 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setEditingBlock(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...
                  </>
                ) : (
                  "Update Block"
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBlockId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 bg-paper border-border shadow-2xl space-y-4 animate-fade-in-up">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-ink heading-font">Delete Schedule Block?</h3>
              <p className="text-xs text-muted mt-1">
                Patients will no longer be able to book slots in this time window. This action is immediate and cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setDeletingBlockId(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleConfirmDelete}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Delete"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
