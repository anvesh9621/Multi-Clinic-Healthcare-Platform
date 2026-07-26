"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { 
  ArrowLeft,
  Search, 
  User, 
  History,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

interface Patient {
  id: number;
  email: string;
  phone: string;
  first_name?: string;
  last_name?: string;
  created_at: string;
}

export default function DoctorPatientDBPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user && user.role !== "DOCTOR") {
      router.push("/dashboard");
      return;
    }
  }, [user, router]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPatients(searchQuery);
    }, 300);
    
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchPatients = async (query: string = "") => {
    setLoading(true);
    try {
      const url = query ? `/patients/?search=${encodeURIComponent(query)}` : "/patients/";
      const response = await apiClient.get(url);
      setPatients(response.data.results || response.data);
    } catch (error) {
      console.error("Error fetching patients:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/doctor">
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <ArrowLeft className="w-5 h-5 text-muted" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink heading-font flex items-center gap-3">
              <User className="w-8 h-8 text-primary bg-primary/10 p-1.5 rounded-lg hidden sm:block" />
              Patient Database
            </h1>
            <p className="text-muted mt-1 text-sm sm:text-base">Search and view past consultation history for your clinic's patients.</p>
          </div>
        </div>
        
        <div className="w-full md:w-80 mt-4 md:mt-0">
          <Input
            type="text"
            placeholder="Search by name, email, or phone..."
            icon={<Search className="w-4 h-4 text-muted" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── LIST ── */}
      <Card className="min-h-[500px]">
        {loading && patients.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center text-muted">
            <Search className="w-12 h-12 text-muted mb-4" />
            <p className="text-lg font-bold text-ink heading-font">No patients found</p>
            <p className="text-sm mt-1 text-muted">Try adjusting your search terms.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {patients.map((patient) => {
              const displayName = patient.first_name 
                 ? `${patient.first_name} ${patient.last_name || ""}` 
                 : `Patient #${patient.id}`;
                 
              return (
                <div key={patient.id} className="p-6 hover:bg-warm-surface/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0 text-primary font-bold text-lg shadow-sm">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-ink text-lg">{displayName}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted">
                        <span>{patient.email}</span>
                        {patient.phone && (
                           <>
                             <span className="w-1 h-1 bg-border rounded-full"></span>
                             <span>{patient.phone}</span>
                           </>
                        )}
                        <span className="w-1 h-1 bg-border rounded-full"></span>
                        <span>Registered {format(new Date(patient.created_at), "MMM yyyy")}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                    <Link href={`/dashboard/history?patientId=${patient.id}`} className="w-full md:w-auto">
                      <Button variant="secondary" className="w-full">
                        <History className="w-4 h-4 mr-2" /> View History
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
