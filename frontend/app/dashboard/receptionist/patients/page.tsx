"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, UserPlus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Card } from "@/components/ui/Card";

interface Patient {
  id: number;
  email: string;
  phone: string;
  date_of_birth: string | null;
  created_at: string;
}

export default function ReceptionistPatientsPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user && (user.role === "RECEPTIONIST" || user.role === "CLINIC_ADMIN")) {
      const timer = setTimeout(() => fetchPatients(searchQuery), 300);
      return () => clearTimeout(timer);
    } else if (user) {
      router.push("/dashboard");
    }
  }, [user, router, searchQuery, retryCount]);

  const fetchPatients = async (query: string = "") => {
    try {
      const url = query ? `/patients/?search=${encodeURIComponent(query)}` : "/patients/";
      const response = await apiClient.get(url);
      setPatients(response.data.results || response.data);
    } catch (err) {
      console.error("Error fetching patients:", err);
      setError("Couldn't load patients right now.");
    } finally {
      setLoading(false);
    }
  };

  if (loading && patients.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">Something went wrong</h2>
          <p className="text-muted mb-6">{error}</p>
          <Button onClick={() => { setLoading(true); setError(null); setRetryCount(r => r + 1); }}>
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink heading-font">Manage Patients</h1>
          <p className="text-muted mt-1">View, search, and manage registered clinic patients.</p>
        </div>
        <Link href="/dashboard/receptionist/patients/new">
          <Button className="w-full md:w-auto">
            <UserPlus className="w-4 h-4 mr-2" /> Register New Patient
          </Button>
        </Link>
      </div>

      {/* SEARCH */}
      <Input
        icon={<Search className="w-4 h-4" />}
        type="text"
        placeholder="Search patients by email or phone number..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-md py-3"
      />

      {/* TABLE */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Contact Details</TableHead>
            <TableHead>Date of Birth</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => (
            <TableRow key={patient.id}>
              <TableCell className="font-bold">PT-{patient.id}</TableCell>
              <TableCell>
                <div className="font-semibold text-ink">{patient.email}</div>
                <div className="text-muted text-xs mt-0.5">{patient.phone}</div>
              </TableCell>
              <TableCell>{patient.date_of_birth || "Not provided"}</TableCell>
              <TableCell>
                <div className="flex gap-4">
                  <Link
                    href={`/dashboard/receptionist/book?patientId=${patient.id}`}
                    className="text-primary hover:text-primary-dark text-sm font-semibold transition-colors"
                  >
                    Book Appointment
                  </Link>
                  <Link
                    href={`/dashboard/receptionist/patients/${patient.id}`}
                    className="text-muted hover:text-ink text-sm font-semibold transition-colors"
                  >
                    View History
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {patients.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-12 text-center text-muted">
                No patients found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
