"use client";

import { useEffect, useState } from "react";
import { getDoctors } from "@/services/doctors";
import { createSchedule } from "@/services/schedules";
import { Clock, Calendar, Save, Plus, X, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export default function SchedulePage() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorClinicId, setDoctorClinicId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [slotDuration, setSlotDuration] = useState(30);

  const [blocks, setBlocks] = useState<Record<string, string>[]>([
    { start_time: "", end_time: "" }
  ]);

  useEffect(() => {
    const loadDoctors = async () => {
      const data = await getDoctors();
      setDoctors(data);
    };
    loadDoctors();
  }, []);

  const addBlock = () => {
    setBlocks([...blocks, { start_time: "", end_time: "" }]);
  };

  const updateBlock = (index: number, field: string, value: string) => {
    const updated = [...blocks];
    updated[index][field] = value;
    setBlocks(updated);
  };

  const handleSubmit = async () => {
    try {
      for (const block of blocks) {
        await createSchedule({
          doctor_clinic_id: Number(doctorClinicId),
          day_of_week: dayOfWeek,
          start_time: block.start_time,
          end_time: block.end_time,
          slot_duration: slotDuration
        });
      }
      alert("Schedules created");
    } catch (error: any) {
      console.log("ERROR:", error.response?.data);
      alert(JSON.stringify(error.response?.data));
    }
  };

  const selectClass = "w-full pl-11 pr-4 py-3.5 bg-warm-surface border border-border rounded-xl text-ink font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition shadow-sm";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink heading-font">Doctor Schedule</h1>
        <p className="text-muted mt-1">Configure re-occurring availability blocks for your doctors</p>
      </div>

      <Card className="p-6 sm:p-10">
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Doctor Select */}
            <div>
              <label className="block text-sm font-bold text-ink mb-2">Select Provider</label>
              <div className="relative">
                <select
                  className={selectClass}
                  onChange={(e) => setDoctorClinicId(e.target.value)}
                  value={doctorClinicId}
                >
                  <option value="">Choose a doctor...</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.first_name ? `Dr. ${doc.first_name} ${doc.last_name || ''}` : doc.doctor_email}
                    </option>
                  ))}
                </select>
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
              </div>
            </div>

            {/* Day Select */}
            <div>
              <label className="block text-sm font-bold text-ink mb-2">Day of Week</label>
              <div className="relative">
                <select
                  className={selectClass}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  value={dayOfWeek}
                >
                  <option value="0">Monday</option>
                  <option value="1">Tuesday</option>
                  <option value="2">Wednesday</option>
                  <option value="3">Thursday</option>
                  <option value="4">Friday</option>
                  <option value="5">Saturday</option>
                  <option value="6">Sunday</option>
                </select>
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Slot Duration */}
          <div>
            <label className="block text-sm font-bold text-ink mb-2">Slot Duration (Minutes)</label>
            <div className="max-w-xs">
              <Input
                type="number"
                min="5"
                step="5"
                icon={<Clock className="w-5 h-5 text-muted" />}
                placeholder="e.g. 30"
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Time Blocks */}
          <div className="pt-6 border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-ink heading-font">Availability Blocks</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={addBlock}
                className="text-primary font-bold"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Time Block
              </Button>
            </div>
            
            <div className="space-y-4">
              {blocks.map((block, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 bg-warm-surface/50 border border-border rounded-2xl relative group">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5 ml-1">Start Time</label>
                    <Input
                      type="time"
                      value={block.start_time}
                      onChange={(e) => updateBlock(index, "start_time", e.target.value)}
                    />
                  </div>
                  
                  <span className="hidden sm:block text-muted font-bold mt-6">-</span>
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5 ml-1">End Time</label>
                    <Input
                      type="time"
                      value={block.end_time}
                      onChange={(e) => updateBlock(index, "end_time", e.target.value)}
                    />
                  </div>

                  {blocks.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setBlocks(blocks.filter((_, i) => i !== index))}
                      className="mt-6 text-muted hover:text-rose-600 bg-paper border border-border"
                      title="Remove block"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8 border-t border-border">
            <Button
              onClick={handleSubmit}
              className="w-full sm:w-auto py-3"
            >
              <Save className="w-5 h-5 mr-2" />
              Save Schedule Configuration
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
