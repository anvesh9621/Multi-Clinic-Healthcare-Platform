"use client";

import { useEffect, useState } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { Calendar, Clock } from "lucide-react";
import api from "@/services/api";
import { useBooking } from "../layout";

interface SlotResponse {
  date: string;
  consultation_fee: number;
  slots: string[];
}

export default function SlotSelector() {
  const { state, updateState, goToStep } = useBooking();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slotsData, setSlotsData] = useState<SlotResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Generate next 14 days
  const dates = Array.from({ length: 14 }).map((_, i) => addDays(new Date(), i));

  useEffect(() => {
    if (!state.doctorClinicId) return;
    
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
    api.get(`/public/doctors/${state.doctorClinicId}/slots/?date=${dateStr}`)
      .then(res => setSlotsData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [state.doctorClinicId, selectedDate]);

  const handleSelect = (timeSlot: string) => {
    if (!slotsData) return;
    updateState({
      date: slotsData.date,
      timeSlot,
      consultationFee: slotsData.consultation_fee,
    });
    goToStep(5);
  };

  // Group slots
  const morning = slotsData?.slots.filter(s => parseInt(s.split(":")[0]) < 12) || [];
  const afternoon = slotsData?.slots.filter(s => {
    const h = parseInt(s.split(":")[0]);
    return h >= 12 && h < 17;
  }) || [];
  const evening = slotsData?.slots.filter(s => parseInt(s.split(":")[0]) >= 17) || [];

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Select Date & Time</h2>
        <p className="text-gray-500 mt-1">For {state.doctorName}</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
        {dates.map(date => {
          const isSelected = isSameDay(date, selectedDate);
          return (
            <button
              key={date.toISOString()}
              onClick={() => setSelectedDate(date)}
              className={`flex flex-col items-center justify-center min-w-[70px] p-3 rounded-xl border transition-all ${
                isSelected 
                  ? "bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200" 
                  : "bg-white border-gray-200 text-gray-700 hover:border-violet-300 hover:bg-violet-50"
              }`}
            >
              <span className="text-xs font-medium uppercase mb-1">{format(date, "EEE")}</span>
              <span className={`text-xl font-bold ${isSelected ? "text-white" : "text-gray-900"}`}>
                {format(date, "d")}
              </span>
              <span className="text-[10px] opacity-80">{format(date, "MMM")}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600"></div>
        </div>
      ) : !slotsData?.slots.length ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No slots available on this date.</p>
          <p className="text-sm text-gray-400 mt-1">Please select another date.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[
            { label: "Morning", slots: morning },
            { label: "Afternoon", slots: afternoon },
            { label: "Evening", slots: evening },
          ].map(section => section.slots.length > 0 && (
            <div key={section.label}>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" /> {section.label}
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {section.slots.map(slot => (
                  <button
                    key={slot}
                    onClick={() => handleSelect(slot)}
                    className="py-2.5 px-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:border-violet-600 hover:text-violet-700 hover:bg-violet-50 hover:shadow-sm transition-all"
                  >
                    {slot.slice(0, 5)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
