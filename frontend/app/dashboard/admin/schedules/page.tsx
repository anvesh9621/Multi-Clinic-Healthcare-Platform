"use client";

import { useEffect, useState } from "react";
import { getDoctors } from "@/services/doctors";
import { createSchedule } from "@/services/schedules";
import { Clock, Calendar, Save, Plus, X, User } from "lucide-react";

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
          doctor_clinic_id: doctorClinicId,
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Doctor Schedule</h1>
        <p className="text-gray-500 mt-1">Configure re-occurring availability blocks for your doctors</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-10 shadow-sm">
        <div className="space-y-6">
          
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Doctor Select */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">Select Provider</label>
              <div className="relative">
                <select
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
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
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Day Select */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">Day of Week</label>
              <div className="relative">
                <select
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
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
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Slot Duration */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">Slot Duration (Minutes)</label>
            <div className="relative max-w-xs">
              <input
                type="number"
                min="5"
                step="5"
                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
                placeholder="e.g. 30"
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value))}
              />
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Time Blocks */}
          <div className="pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Availability Blocks</h3>
              <button
                onClick={addBlock}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 font-bold text-sm rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Time Block
              </button>
            </div>
            
            <div className="space-y-4">
              {blocks.map((block, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 bg-gray-50/50 border border-gray-100 rounded-2xl relative group">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Start Time</label>
                    <input
                      type="time"
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
                      value={block.start_time}
                      onChange={(e) => updateBlock(index, "start_time", e.target.value)}
                    />
                  </div>
                  
                  <span className="hidden sm:block text-gray-300 font-bold mt-6">-</span>
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">End Time</label>
                    <input
                      type="time"
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
                      value={block.end_time}
                      onChange={(e) => updateBlock(index, "end_time", e.target.value)}
                    />
                  </div>

                  {blocks.length > 1 && (
                    <button 
                      onClick={() => setBlocks(blocks.filter((_, i) => i !== index))}
                      className="p-2.5 mt-6 text-gray-400 hover:text-red-500 hover:bg-red-50 bg-white border border-gray-200 rounded-xl transition-colors shadow-sm"
                      title="Remove block"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8 border-t border-gray-100">
            <button
              onClick={handleSubmit}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-gray-900 hover:bg-gray-800 text-white text-base font-bold rounded-xl transition-colors shadow-md"
            >
              <Save className="w-5 h-5" />
              Save Schedule Configuration
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
