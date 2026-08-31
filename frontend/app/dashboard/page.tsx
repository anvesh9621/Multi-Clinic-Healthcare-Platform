"use client";

import { useEffect, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats, getDoctorWorkload, getAppointmentTrend } from "@/services/analytics";
import type { ClinicDashboardStats, DoctorWorkloadEntry, AppointmentTrendEntry } from "@/types/api";
import AppointmentTrendChart from "@/components/analytics/AppointmentTrendChart";
import { 
  CalendarCheck, CalendarDays, CheckCircle2, 
  XCircle, Users, Stethoscope, Activity, TrendingUp 
} from "lucide-react";
import { SkeletonStat, Skeleton } from "@/components/ui/Skeleton";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    if (user && user.role === "PATIENT") {
        router.push("/dashboard/patient");
    } else if (user && user.role === "DOCTOR") {
        router.push("/dashboard/appointments");
    } else if (user && user.role === "SUPER_ADMIN") {
        router.push("/dashboard/super-admin");
    } else if (user && user.role === "RECEPTIONIST") {
        router.push("/dashboard/receptionist/queue");
    }
  }, [user, router]);

  const isAuthorized = user && !["PATIENT", "DOCTOR", "SUPER_ADMIN", "RECEPTIONIST"].includes(user.role);

  const { data, isLoading: loading, isError: error, refetch } = useQuery<{
    stats: ClinicDashboardStats;
    workload: DoctorWorkloadEntry[];
    trend: AppointmentTrendEntry[];
  }>({
    queryKey: ["dashboard", "overview"],
    queryFn: async () => {
      const [statsData, workloadData, trendData] = await Promise.all([
        getDashboardStats(),
        getDoctorWorkload(),
        getAppointmentTrend(),
      ]);
      return { stats: statsData, workload: workloadData, trend: trendData };
    },
    enabled: !!isAuthorized,
  });

  const { stats, workload = [], trend = [] } = data ?? {};

  const statItems = stats ? [
    { label: "Appointments Today", value: stats.appointments_today, icon: CalendarCheck, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
    { label: "Appointments This Week", value: stats.appointments_this_week, icon: CalendarDays, color: "text-accent", bg: "bg-accent/10", border: "border-accent/20" },
    { label: "Completed Today", value: stats.completed_today, icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    { label: "Cancelled Today", value: stats.cancelled_today, icon: XCircle, color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
    { label: "Total Patients", value: stats.total_patients, icon: Users, color: "text-primary-dark", bg: "bg-primary/15", border: "border-primary/30" },
    { label: "Total Doctors", value: stats.total_doctors, icon: Stethoscope, color: "text-accent", bg: "bg-accent/15", border: "border-accent/30" },
  ] : [];

  return (
    <div className="space-y-8 pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold heading-font text-ink">Clinic Dashboard</h1>
          <p className="text-muted mt-1 text-sm">Overview of today's clinic performance & metrics.</p>
        </div>
        <div className="bg-paper px-3.5 py-1.5 rounded-xl border border-border shadow-xs flex items-center gap-2 self-start sm:self-center">
           <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
           <span className="text-xs font-semibold text-ink">Live Updates Active</span>
        </div>
      </div>

      {loading ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[1,2,3,4,5,6].map(i => <SkeletonStat key={i} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <Card className="col-span-1 p-6 h-80">
                <Skeleton className="h-6 w-1/2 mb-6" />
                <div className="space-y-4">
                   <Skeleton className="h-10 w-full rounded-xl" />
                   <Skeleton className="h-10 w-full rounded-xl" />
                   <Skeleton className="h-10 w-full rounded-xl" />
                </div>
             </Card>
             <Card className="col-span-1 lg:col-span-2 p-6 h-80">
                <Skeleton className="h-6 w-1/3 mb-6" />
                <Skeleton className="h-48 w-full rounded-xl" />
             </Card>
          </div>
        </>
      ) : error ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="text-xl font-bold text-ink heading-font mb-2">Something went wrong</h2>
          <p className="text-muted text-sm mb-6">Couldn't load your clinic dashboard right now.</p>
          <Button onClick={() => refetch()}>
            Try Again
          </Button>
        </Card>
      ) : (
        <>
          {stats && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, staggerChildren: 0.08 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {statItems.map((stat, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Card hoverable className="p-6 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center border ${stat.border} group-hover:scale-105 transition-transform`}>
                        <stat.icon className="w-6 h-6" />
                      </div>
                    </div>
                    <h3 className="text-muted font-bold tracking-wider text-xs uppercase">{stat.label}</h3>
                    <div className="text-3xl font-bold text-ink mt-1 heading-font">
                      <AnimatedNumber value={stat.value} />
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Doctor Workload Section */}
            <motion.div 
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
              className="col-span-1"
            >
              <Card className="p-6 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary border border-primary/20">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold heading-font text-ink">Doctor Workload</h2>
                </div>

                {workload.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center flex-col text-center p-8 border-2 border-dashed border-border rounded-xl bg-warm-surface/30">
                    <div className="w-12 h-12 bg-warm-surface rounded-full flex items-center justify-center mb-3 text-muted">
                      <Users className="w-6 h-6" />
                    </div>
                    <p className="text-muted text-sm font-medium">No active workloads recorded yet</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border flex-1">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-warm-surface/60 text-muted font-bold border-b border-border text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Doctor</th>
                          <th className="px-4 py-3 text-right">Appts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-paper">
                        {workload.map((item, index) => {
                          const displayName = item.doctor_name || (item.first_name ? `Dr. ${item.first_name} ${item.last_name || ""}`.trim() : item.doctor);
                          const initials = (item.first_name && item.last_name)
                            ? `${item.first_name[0]}${item.last_name[0]}`.toUpperCase()
                            : item.doctor.substring(0, 2).toUpperCase();

                          return (
                            <tr key={index} className="hover:bg-warm-surface/40 transition-colors">
                              <td className="px-4 py-3 font-medium text-ink flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] text-primary font-bold tracking-tight">
                                  {initials}
                                </div>
                                <span className="truncate font-semibold text-xs text-ink">{displayName}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary font-bold font-mono text-xs">
                                  {item.appointments}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Appointment Trend Chart */}
            <motion.div 
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="col-span-1 lg:col-span-2"
            >
              <Card className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-accent/10 rounded-xl text-accent border border-accent/20">
                    <Activity className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold heading-font text-ink">Appointment Trends</h2>
                </div>
                <div className="h-[300px] w-full">
                  <AppointmentTrendChart data={trend} />
                </div>
              </Card>
            </motion.div>
          </div>
        </>
      )}

    </div>
  );
}
