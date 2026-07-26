"use client";

import { useContext, useEffect, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  ClipboardList,
  Clock,
  HeartPulse,
  Plus,
  ChevronRight,
  LogOut,
  User,
  AlertCircle,
  X,
  FileText,
} from "lucide-react";
import { logout } from "@/services/auth";
import api from "@/services/api";
import { getPatientProfile, PatientProfileData } from "@/services/patients";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface Appointment {
  id: number;
  appointment_date: string;
  start_time: string;
  status: string;
  doctor_name: string;
  clinic_name: string;
}

export default function PatientDashboard() {
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [apptLoading, setApptLoading] = useState(true);
  const [profile, setProfile] = useState<PatientProfileData | null>(null);
  const [showProfileBanner, setShowProfileBanner] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && user.role !== "PATIENT") router.push("/dashboard");
  }, [user, loading, router]);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const res = await api.get("/appointments/?limit=5&ordering=-appointment_date");
        const data = res.data?.results ?? res.data ?? [];
        setAppointments(Array.isArray(data) ? data.slice(0, 5) : []);
      } catch {
        setAppointments([]);
      } finally {
        setApptLoading(false);
      }
    };
    const fetchProfile = async () => {
      try {
        const p = await getPatientProfile();
        setProfile(p);
        if (!p.profile_completed) setShowProfileBanner(true);
      } catch {
        // not a blocker
      }
    };
    if (user) {
      fetchAppointments();
      fetchProfile();
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-surface/30">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted font-medium text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const firstName = user.first_name || user.email?.split("@")[0] || "Patient";

  const upcomingAppointments = appointments.filter(
    (a) => a.status === "SCHEDULED" || a.status === "CONFIRMED"
  );

  const statusColor: Record<string, string> = {
    SCHEDULED: "bg-blue-100 text-blue-800 border border-blue-200",
    CONFIRMED: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    COMPLETED: "bg-gray-100 text-gray-700 border border-gray-200",
    CANCELLED: "bg-rose-100 text-rose-800 border border-rose-200",
  };

  return (
    <div className="min-h-screen bg-warm-surface/30">
      {/* Topbar */}
      <header className="bg-paper border-b border-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-ink text-lg heading-font">MediClinic</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-ink hidden sm:block">
                {user.first_name} {user.last_name}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-muted hover:text-rose-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Profile Completion Banner */}
        {showProfileBanner && !profile?.profile_completed && (
          <div className="mb-6 flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5 text-amber-700" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-amber-900 mb-1 heading-font">Complete your medical profile</p>
              <p className="text-sm text-amber-800 mb-3">
                Help your doctors serve you better by adding your blood group, allergies, and current medications.
              </p>
              <Link href="/dashboard/patient/profile">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white border-none">
                  Complete Profile <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <button
              onClick={() => setShowProfileBanner(false)}
              className="text-amber-500 hover:text-amber-700 transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-primary to-primary-dark rounded-3xl p-8 mb-8 text-white shadow-lg shadow-primary/20">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute right-24 bottom-0 w-40 h-40 bg-white/5 rounded-full -mb-12"></div>
          <div className="relative z-10">
            <p className="text-primary-light font-medium mb-1">Good to see you 👋</p>
            <h1 className="text-3xl font-bold mb-3 heading-font">Welcome back, {firstName}!</h1>
            <p className="text-white/90 mb-6 max-w-md text-sm leading-relaxed">
              Manage your appointments, view prescriptions, and track your health history all in one place.
            </p>
            <Link href="/dashboard/book">
              <Button variant="secondary" className="bg-white text-primary hover:bg-warm-surface border-none shadow-md">
                <Plus className="w-4 h-4 mr-1.5" /> Book Appointment
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Link href="/dashboard/book">
            <Card hoverable className="p-6 cursor-pointer group">
              <div className="w-12 h-12 bg-primary/10 group-hover:bg-primary rounded-xl flex items-center justify-center mb-4 transition-colors">
                <CalendarCheck className="w-6 h-6 text-primary group-hover:text-white transition-colors" />
              </div>
              <div className="text-sm font-semibold text-ink">Book</div>
              <div className="text-xs text-muted">Appointment</div>
            </Card>
          </Link>

          <Link href="/dashboard/appointments">
            <Card hoverable className="p-6 cursor-pointer group">
              <div className="w-12 h-12 bg-accent/10 group-hover:bg-accent rounded-xl flex items-center justify-center mb-4 transition-colors">
                <Clock className="w-6 h-6 text-accent group-hover:text-white transition-colors" />
              </div>
              <div className="text-sm font-semibold text-ink">My</div>
              <div className="text-xs text-muted">Appointments</div>
            </Card>
          </Link>

          <Link href="/dashboard/history">
            <Card hoverable className="p-6 cursor-pointer group">
              <div className="w-12 h-12 bg-emerald-100 group-hover:bg-emerald-600 rounded-xl flex items-center justify-center mb-4 transition-colors">
                <ClipboardList className="w-6 h-6 text-emerald-700 group-hover:text-white transition-colors" />
              </div>
              <div className="text-sm font-semibold text-ink">Medical</div>
              <div className="text-xs text-muted">History</div>
            </Card>
          </Link>

          <Link href="/dashboard/patient/profile">
            <Card hoverable className="p-6 cursor-pointer group">
              <div className="w-12 h-12 bg-purple-100 group-hover:bg-purple-600 rounded-xl flex items-center justify-center mb-4 transition-colors">
                <User className="w-6 h-6 text-purple-700 group-hover:text-white transition-colors" />
              </div>
              <div className="text-sm font-semibold text-ink">My</div>
              <div className="text-xs text-muted">Profile</div>
            </Card>
          </Link>
        </div>

        {/* Upcoming Appointments */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-ink heading-font">Upcoming Appointments</h2>
            <Link
              href="/dashboard/appointments"
              className="text-sm text-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {apptLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-warm-surface rounded-xl animate-pulse" />
              ))}
            </div>
          ) : upcomingAppointments.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <div className="w-16 h-16 bg-warm-surface rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarCheck className="w-8 h-8 text-muted" />
              </div>
              <p className="text-ink font-semibold mb-1">No upcoming appointments</p>
              <p className="text-muted text-sm mb-6">Book your first appointment today</p>
              <Link href="/dashboard/book">
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1.5" /> Book Appointment
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((appt) => (
                <div
                  key={appt.id}
                  className="flex flex-col p-4 border border-border rounded-xl hover:border-primary/30 hover:bg-warm-surface/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <CalendarCheck className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-ink">{appt.doctor_name}</p>
                        <p className="text-sm text-muted">{appt.clinic_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink font-mono">
                        {new Date(appt.appointment_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                      <p className="text-sm text-muted">{appt.start_time?.slice(0, 5)}</p>
                      <span
                        className={`mt-1 inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${statusColor[appt.status] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {appt.status}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action Links */}
                  <div className="border-t border-border pt-3 flex justify-end gap-2">
                    <Link href={`/dashboard/patient/intake-form/${appt.id}`}>
                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary-dark">
                        <FileText className="w-3.5 h-3.5 mr-1" /> Fill Intake Form &gt;
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Medical History Quick View */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-ink heading-font">Medical History</h2>
            <Link
              href="/dashboard/history"
              className="text-sm text-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-warm-surface rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8 text-muted" />
            </div>
            <p className="text-ink font-semibold mb-1">No medical records yet</p>
            <p className="text-muted text-sm">Your diagnosis and prescription history will appear here after your consultations.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
