"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, AlertTriangle, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";

interface Patient {
  id: number;
  email: string;
  phone: string;
  date_of_birth: string | null;
  address: string | null;
  emergency_contact: string | null;
  created_at: string;
}

interface Appointment {
  id: number;
  doctor_name: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  reason: string;
}

export default function PatientHistoryPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const params = useParams();
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && (user.role === "RECEPTIONIST" || user.role === "CLINIC_ADMIN")) {
      fetchHistory();
    } else if (user) {
      router.push("/dashboard");
    }
  }, [user, router, params.id]);

  const fetchHistory = async () => {
    try {
      const response = await apiClient.get(`/patients/${params.id}/history/`);
      setPatient(response.data.patient);
      setAppointments(response.data.appointments);
    } catch (err: any) {
      console.error("Error fetching patient history:", err);
      setError(err.response?.data?.error || "Failed to load patient history.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">Error Loading Profile</h2>
          <p className="text-muted mb-6">{error}</p>
          <Link href="/dashboard/receptionist/patients">
            <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Patients List</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card className="flex flex-col items-center justify-center py-16 text-center px-4">
          <User className="w-12 h-12 text-muted mb-3" />
          <h2 className="text-xl font-bold text-ink mb-2">Patient Not Found</h2>
          <Link href="/dashboard/receptionist/patients">
            <Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Patients List</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink heading-font">Patient Details</h1>
          <p className="text-muted mt-1">Review patient profile and appointment history.</p>
        </div>
        <Link href="/dashboard/receptionist/patients">
          <Button variant="secondary">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Patients List
          </Button>
        </Link>
      </div>

      <Card className="p-8">
        <h2 className="text-xl font-bold text-ink border-b border-border pb-4 mb-6 heading-font">Profile Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <div>
            <p className="text-sm font-bold text-muted">Email Address</p>
            <p className="mt-1 text-base font-medium text-ink">{patient.email}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-muted">Phone Number</p>
            <p className="mt-1 text-base font-medium text-ink">{patient.phone}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-muted">Date of Birth</p>
            <p className="mt-1 text-base font-medium text-ink">{patient.date_of_birth || "Not provided"}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-muted">Address</p>
            <p className="mt-1 text-base font-medium text-ink">{patient.address || "Not provided"}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-muted">Emergency Contact</p>
            <p className="mt-1 text-base font-medium text-ink">{patient.emergency_contact || "Not provided"}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-muted">Registration Date</p>
            <p className="mt-1 text-base font-medium text-ink">{new Date(patient.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border">
          <Link href={`/dashboard/receptionist/book?patientId=${patient.id}`}>
            <Button>
              <Calendar className="w-4 h-4 mr-2" /> Book New Appointment
            </Button>
          </Link>
        </div>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-ink heading-font">Appointment History</h2>
        
        {appointments.length === 0 ? (
          <Card className="p-12 text-center text-muted font-medium">
            This patient has no recorded appointments.
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((apt) => (
                <TableRow key={apt.id}>
                  <TableCell>
                    <div className="font-bold text-ink">{new Date(apt.appointment_date).toLocaleDateString()}</div>
                    <div className="text-muted mt-0.5 font-medium text-xs">{apt.start_time} - {apt.end_time}</div>
                  </TableCell>
                  <TableCell className="font-bold text-ink">Dr. {apt.doctor_name}</TableCell>
                  <TableCell className="text-muted font-medium">{apt.reason || "-"}</TableCell>
                  <TableCell>
                    <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full uppercase tracking-wider ${
                      apt.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : 
                      apt.status === "CANCELLED" ? "bg-rose-100 text-rose-800 border border-rose-200" : 
                      "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}>
                      {apt.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
