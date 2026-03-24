"use client";

import { useState, useEffect } from "react";
import api from "@/services/api";

type Appointment = {
  id: number;
  doctor_name: string;
  status: string;
  queue_token: string;
  start_time: string;
};

export default function TVQueueDisplay() {
  const [inProgress, setInProgress] = useState<Appointment[]>([]);
  const [waiting, setWaiting] = useState<Appointment[]>([]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // 5s polling for TV
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get("/appointments/");
      const data = res.data.results || res.data;
      const today = new Date().toISOString().split('T')[0];
      const todays = data.filter((a: Appointment) => a.appointment_date === today);
      
      setInProgress(todays.filter((a: Appointment) => a.status === 'IN_PROGRESS'));
      setWaiting(todays.filter((a: Appointment) => a.status === 'WAITING'));
      
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white p-8 font-sans flex flex-col">
      <header className="flex items-center justify-between pb-8 border-b border-gray-800">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">MediClinic <span className="text-indigo-500">Care</span></h1>
          <p className="text-gray-400 text-xl font-medium">Outpatient Wait Listing Monitor</p>
        </div>
        <div className="text-right">
          <p className="text-5xl font-bold tabular-nums tracking-tighter text-indigo-400">
            {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
          <p className="text-gray-400 mt-1 uppercase tracking-widest text-sm font-bold">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12">
        {/* NOW SERVING COLUMN */}
        <div className="space-y-6">
          <h2 className="text-3xl font-extrabold uppercase tracking-widest text-emerald-400 mb-8 flex items-center gap-4">
            <span className="w-4 h-4 rounded-full bg-emerald-400 animate-pulse"></span> Now Serving
          </h2>
          
          <div className="space-y-4">
            {inProgress.length === 0 ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-12 text-center text-gray-500 text-xl">
                 Currently no active consultations.
              </div>
            ) : inProgress.map(apt => (
              <div key={apt.id} className="bg-gradient-to-r from-emerald-900/40 to-gray-900 border border-emerald-900/50 rounded-3xl p-8 flex items-center justify-between shadow-2xl shadow-emerald-900/20 transform transition-all">
                <div>
                   <p className="text-gray-400 text-lg uppercase tracking-widest font-bold mb-2">Consulting</p>
                   <p className="text-3xl font-bold text-white tracking-tight">{apt.doctor_name}</p>
                </div>
                <div className="text-right">
                   <p className="text-gray-400 text-lg uppercase tracking-widest font-bold mb-1">Queue Token</p>
                   <div className="bg-emerald-500 text-gray-900 font-extrabold text-6xl tracking-tighter px-6 py-2 rounded-2xl shadow-inner font-mono inline-block">
                     {apt.queue_token}
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WAITING ROOM COLUMN */}
        <div className="space-y-6 pl-0 lg:pl-12 lg:border-l border-gray-800">
           <h2 className="text-3xl font-extrabold uppercase tracking-widest text-amber-500 mb-8">
            Next In Line
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
             {waiting.length === 0 ? (
               <div className="col-span-2 text-gray-600 text-xl italic mt-4">No patients are currently waiting.</div>
             ) : waiting.map(apt => (
               <div key={apt.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                 <div className="text-amber-500 font-extrabold text-4xl tracking-tighter font-mono mb-3">
                   {apt.queue_token}
                 </div>
                 <p className="text-gray-400 text-sm uppercase tracking-wider font-bold truncate">For {apt.doctor_name}</p>
                 <p className="text-gray-500 text-xs mt-1 font-mono">EST: {apt.start_time.slice(0, 5)}</p>
               </div>
             ))}
          </div>
        </div>
      </main>
    </div>
  );
}
