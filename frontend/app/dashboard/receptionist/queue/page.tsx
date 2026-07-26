"use client";

import { useState, useEffect } from "react";
import { LayoutDashboard, CheckSquare, Clock, UserCheck, ExternalLink } from "lucide-react";
import api from "@/services/api";
import { MotionTrItem } from "@/components/ui/MotionListItem";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";

type Appointment = {
  id: number;
  patient_name: string;
  doctor_name: string;
  appointment_date: string;
  start_time: string;
  status: string;
  queue_token: string;
};

export default function ReceptionistQueue() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get("/appointments/");
      const data = res.data.results || res.data;
      const today = new Date().toISOString().split('T')[0];
      const todaysAppointments = data.filter((a: Appointment) => a.appointment_date === today);
      setAppointments(todaysAppointments);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await api.patch(`/appointments/${id}/status/`, { status });
      fetchData();
    } catch (e) {
      console.error(e);
      alert("Failed to update status");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink heading-font flex items-center gap-3">
            <LayoutDashboard className="w-6 h-6 text-primary" /> Walk-in Queue Manager
          </h1>
          <p className="text-muted mt-1">Mark patients as arrived to instantly display their tokens on the waiting room TV.</p>
        </div>
        <a href="/queue-display" target="_blank" rel="noopener noreferrer">
          <Button variant="secondary" className="w-full md:w-auto">
            Open TV Display <ExternalLink className="w-4 h-4 ml-1.5" />
          </Button>
        </a>
      </div>

      {appointments.length === 0 ? (
        <Card className="p-16 text-center text-muted font-medium">
          No appointments scheduled for today.
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Token</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Queue Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {appointments.sort((a, b) => a.start_time.localeCompare(b.start_time)).map((apt) => (
                <MotionTrItem key={apt.id} className="hover:bg-warm-surface/50 transition-colors">
                  <TableCell className="font-bold text-xl text-primary font-mono tracking-widest">{apt.queue_token}</TableCell>
                  <TableCell className="font-bold text-ink">{apt.start_time.slice(0, 5)}</TableCell>
                  <TableCell className="font-medium text-ink">{apt.patient_name}</TableCell>
                  <TableCell className="text-muted font-medium">{apt.doctor_name}</TableCell>
                  <TableCell>
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase ${
                      apt.status === 'WAITING' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      apt.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                      apt.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {apt.status.replace("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {apt.status === 'SCHEDULED' || apt.status === 'CONFIRMED' ? (
                      <Button size="sm" variant="secondary" onClick={() => updateStatus(apt.id, 'WAITING')} className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-none">
                        <UserCheck className="w-3.5 h-3.5 mr-1" /> Mark Arrived
                      </Button>
                    ) : null}
                    {apt.status === 'WAITING' && (
                      <Button size="sm" onClick={() => updateStatus(apt.id, 'IN_PROGRESS')}>
                        <Clock className="w-3.5 h-3.5 mr-1" /> Send to Doctor
                      </Button>
                    )}
                    {apt.status === 'IN_PROGRESS' && (
                      <Button size="sm" variant="secondary" onClick={() => updateStatus(apt.id, 'COMPLETED')} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-none">
                        <CheckSquare className="w-3.5 h-3.5 mr-1" /> Mark Done
                      </Button>
                    )}
                  </TableCell>
                </MotionTrItem>
              ))}
            </AnimatePresence>
          </TableBody>
        </Table>
      )}
    </div>
  );
}
