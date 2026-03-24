"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getDashboardStats, getDoctorWorkload, getAppointmentTrend } from "@/services/analytics";
import AppointmentTrendChart from "@/components/analytics/AppointmentTrendChart";
import { 
  CalendarCheck, CalendarDays, CheckCircle2, 
  XCircle, Users, Stethoscope, Activity, TrendingUp 
} from "lucide-react";
import { PageLoader } from "@/components/ui/Skeleton";
import { motion } from "framer-motion";
export default function DashboardPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();

  const [stats, setStats] = useState<any>(null);
  const [workload, setWorkload] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState([]);

  useEffect(() => {

    const loadDashboard = async () => {
      try {
        const statsData = await getDashboardStats();
        const workloadData = await getDoctorWorkload();
        const trendData = await getAppointmentTrend();

        setStats(statsData);
        setWorkload(workloadData);
        setTrend(trendData)
      } catch (error) {
        console.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    if (user && user.role === "PATIENT") {
        router.push("/dashboard/patient");
    } else if (user && user.role === "DOCTOR") {
        router.push("/dashboard/appointments");
    } else {
        loadDashboard();
    }

  }, [user, router]);

  if (loading) return <PageLoader message="Loading dashboard insights..." />;

  return (
    <div className="space-y-8 pb-10">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold heading-font text-gray-900">Clinic Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of today's clinic performance & metrics.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm flex items-center gap-2">
           <Activity className="w-4 h-4 text-emerald-500" />
           <span className="text-sm font-medium text-gray-700">Live Updates Active</span>
        </div>
      </div>

      {stats && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, staggerChildren: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {/* Stats Cards - Array map for cleaner code */}
          {[
            { label: "Appointments Today", value: stats.appointments_today, icon: CalendarCheck, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
            { label: "Appointments This Week", value: stats.appointments_this_week, icon: CalendarDays, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
            { label: "Completed Today", value: stats.completed_today, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
            { label: "Cancelled Today", value: stats.cancelled_today, icon: XCircle, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
            { label: "Total Patients", value: stats.total_patients, icon: Users, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-100" },
            { label: "Total Doctors", value: stats.total_doctors, icon: Stethoscope, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
          ].map((stat, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md hover:-translate-y-1 hover:border-blue-100 transition-all duration-300"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-current to-transparent opacity-[0.03] rounded-bl-full -z-10 group-hover:scale-110 transition-transform ${stat.color}`}></div>
              <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center border ${stat.border} group-hover:scale-110 transition-transform`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-gray-500 font-medium tracking-wide text-sm uppercase">{stat.label}</h3>
              <p className="text-3xl font-bold text-gray-900 mt-1 heading-font">{stat.value}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Doctor Workload Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="col-span-1 bg-white shadow-sm rounded-2xl p-6 border border-gray-100 flex flex-col"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold heading-font text-gray-900">Doctor Workload</h2>
          </div>

          {workload.length === 0 ? (
            <div className="flex-1 flex items-center justify-center flex-col text-center p-8 border-2 border-dashed border-gray-100 rounded-xl">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3 text-gray-400">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-gray-500 font-medium">No active workloads right now</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-100 flex-1">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 uppercase tracking-wider text-xs">Doctor</th>
                    <th className="px-4 py-3 uppercase tracking-wider text-xs text-right">Appts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {workload.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] text-blue-700 font-bold tracking-tighter">
                          {item.doctor.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        {item.doctor}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 font-bold">
                          {item.appointments}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Appointment Trend Chart */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="col-span-1 lg:col-span-2 bg-white shadow-sm rounded-2xl p-6 border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-cyan-50 rounded-lg text-cyan-600">
              <Activity className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold heading-font text-gray-900">Appointment Trends</h2>
          </div>
          <div className="h-[300px] w-full">
            <AppointmentTrendChart data={trend} />
          </div>
        </motion.div>
      </div>

    </div>
  );
}
