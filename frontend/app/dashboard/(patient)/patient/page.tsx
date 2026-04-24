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
} from "lucide-react";
import { logout } from "@/services/auth";
import api from "@/services/api";
import { getPatientProfile, PatientProfileData } from "@/services/patients";

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Loading your dashboard...</p>
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
    SCHEDULED: "bg-blue-100 text-blue-700",
    CONFIRMED: "bg-green-100 text-green-700",
    COMPLETED: "bg-gray-100 text-gray-600",
    CANCELLED: "bg-red-100 text-red-600",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">MediClinic</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm font-semibold text-gray-700 hidden sm:block">
                {user.first_name} {user.last_name}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors"
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
          <div className="mb-6 flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-amber-900 mb-1">Complete your medical profile</p>
              <p className="text-sm text-amber-700 mb-3">
                Help your doctors serve you better by adding your blood group, allergies, and current medications.
              </p>
              <Link
                href="/dashboard/patient/profile"
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors"
              >
                Complete Profile <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <button
              onClick={() => setShowProfileBanner(false)}
              className="text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-500 rounded-3xl p-8 mb-8 text-white shadow-lg shadow-blue-500/20">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute right-24 bottom-0 w-40 h-40 bg-white/5 rounded-full -mb-12"></div>
          <div className="relative z-10">
            <p className="text-blue-200 font-medium mb-1">Good to see you 👋</p>
            <h1 className="text-3xl font-bold mb-3">Welcome back, {firstName}!</h1>
            <p className="text-blue-100 mb-6 max-w-md">
              Manage your appointments, view prescriptions, and track your health history all in one place.
            </p>
            <Link
              href="/dashboard/book"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-colors shadow-md"
            >
              <Plus className="w-4 h-4" />
              Book Appointment
            </Link>
          </div>
        </div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Link
            href="/dashboard/book"
            className="group bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-600 rounded-xl flex items-center justify-center mb-4 transition-colors">
              <CalendarCheck className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
            </div>
            <div className="text-sm font-semibold text-gray-800">Book</div>
            <div className="text-xs text-gray-500">Appointment</div>
          </Link>

          <Link
            href="/dashboard/appointments"
            className="group bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 bg-indigo-100 group-hover:bg-indigo-600 rounded-xl flex items-center justify-center mb-4 transition-colors">
              <Clock className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
            </div>
            <div className="text-sm font-semibold text-gray-800">My</div>
            <div className="text-xs text-gray-500">Appointments</div>
          </Link>

          <Link
            href="/dashboard/history"
            className="group bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 bg-emerald-100 group-hover:bg-emerald-600 rounded-xl flex items-center justify-center mb-4 transition-colors">
              <ClipboardList className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" />
            </div>
            <div className="text-sm font-semibold text-gray-800">Medical</div>
            <div className="text-xs text-gray-500">History</div>
          </Link>

          <Link
            href="/dashboard/patient/profile"
            className="group bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-rose-200 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 bg-rose-100 group-hover:bg-rose-500 rounded-xl flex items-center justify-center mb-4 transition-colors">
              <User className="w-6 h-6 text-rose-500 group-hover:text-white transition-colors" />
            </div>
            <div className="text-sm font-semibold text-gray-800">My</div>
            <div className="text-xs text-gray-500">Profile</div>
          </Link>
        </div>

        {/* Upcoming Appointments */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Upcoming Appointments</h2>
            <Link
              href="/dashboard/appointments"
              className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:gap-2 transition-all"
            >
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {apptLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : upcomingAppointments.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarCheck className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium mb-1">No upcoming appointments</p>
              <p className="text-gray-400 text-sm mb-6">Book your first appointment today</p>
              <Link
                href="/dashboard/book"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> Book Appointment
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((appt) => (
                <div
                  key={appt.id}
                  className="flex flex-col p-4 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <CalendarCheck className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{appt.doctor_name}</p>
                        <p className="text-sm text-gray-500">{appt.clinic_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-800">
                        {new Date(appt.appointment_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                      <p className="text-sm text-gray-500">{appt.start_time?.slice(0, 5)}</p>
                      <span
                        className={`mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[appt.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {appt.status}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action Links */}
                  <div className="border-t border-gray-100 pt-3 flex justify-end gap-2">
                    <Link
                      href={`/dashboard/patient/intake-form/${appt.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Fill Intake Form &gt;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Medical History Quick View */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Medical History</h2>
            <Link
              href="/dashboard/history"
              className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:gap-2 transition-all"
            >
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium mb-1">No medical records yet</p>
            <p className="text-gray-400 text-sm">Your diagnosis and prescription history will appear here after your consultations.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
