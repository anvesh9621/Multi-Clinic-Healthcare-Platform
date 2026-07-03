"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import apiClient from "@/services/api";
import {
  Building2,
  Users,
  CalendarCheck,
  TrendingUp,
  DollarSign,
  Activity,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  UserPlus,
  X,
  PlusCircle,
  LogIn,
  Power,
  PowerOff,
  Link2,
  Copy,
  ChevronsUp,
  Check
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ClinicRow {
  id: number;
  name: string;
  plan: string;
  is_active: boolean;
  total_appointments: number;
  appointments_today: number;
  total_doctors: number;
  total_patients: number;
}

interface SuperAdminData {
  total_clinics: number;
  active_clinics: number;
  total_users: number;
  total_appointments: number;
  appointments_today: number;
  total_revenue_paid: number;
  clinic_breakdown: ClinicRow[];
  trend_data: any[];
  recent_logs: any[];
}

const PLAN_BADGE: Record<string, string> = {
  BASIC: "bg-slate-100 text-slate-600",
  PRO: "bg-blue-100 text-blue-700",
  ENTERPRISE: "bg-violet-100 text-violet-700",
};

function StatCard({ label, value, icon: Icon, color, sub }: any) {
  return (
    <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-gray-100 shadow-sm p-6 flex items-start gap-4 hover:shadow-md transition">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-3xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [data, setData] = useState<SuperAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Modal State for Clinic Admin
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [clinics, setClinics] = useState<{ id: number; name: string }[]>([]);
  const [adminFormData, setAdminFormData] = useState({
    first_name: "", last_name: "", email: "", password: "", clinic_id: "",
  });
  const [adminFormLoading, setAdminFormLoading] = useState(false);
  const [adminFormError, setAdminFormError] = useState("");
  const [adminFormSuccess, setAdminFormSuccess] = useState("");

  // Modal State for Clinic Creation
  const [isClinicModalOpen, setIsClinicModalOpen] = useState(false);
  const [clinicFormData, setClinicFormData] = useState({
    name: "", address: "", subscription_plan: "BASIC",
  });
  const [clinicFormLoading, setClinicFormLoading] = useState(false);
  const [clinicFormError, setClinicFormError] = useState("");
  const [clinicFormSuccess, setClinicFormSuccess] = useState("");

  // Billing Fallback Actions (Super Admin only)
  const [billingClinic, setBillingClinic] = useState<ClinicRow | null>(null);
  const [billingAction, setBillingAction] = useState<"generate" | "change-plan" | null>(null);
  const [billingPlan, setBillingPlan] = useState("professional");
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingResult, setBillingResult] = useState("");
  const [billingError, setBillingError] = useState("");
  const [copied, setCopied] = useState(false);

  const openBillingModal = (clinic: ClinicRow) => {
    setBillingClinic(clinic);
    setBillingAction(null);
    setBillingResult("");
    setBillingError("");
    setBillingPlan("professional");
    setCopied(false);
  };

  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/dashboard");
      return;
    }
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      const res = await apiClient.get("/analytics/super-admin/");
      setData(res.data.data);
    } catch {
      setError("Failed to load platform stats.");
    } finally {
      setLoading(false);
    }
  };

  const openAdminModal = async () => {
    setIsAdminModalOpen(true); setAdminFormError(""); setAdminFormSuccess("");
    try {
      const res = await apiClient.get("/doctors/clinics/");
      setClinics(res.data);
    } catch (err) { console.error("Failed to fetch clinics", err); }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault(); setAdminFormLoading(true); setAdminFormError(""); setAdminFormSuccess("");
    try {
      await apiClient.post("/accounts/clinic-admins/create/", adminFormData);
      setAdminFormSuccess("Clinic Admin created successfully!");
      setAdminFormData({ first_name: "", last_name: "", email: "", password: "", clinic_id: "" });
      setTimeout(() => setIsAdminModalOpen(false), 2000);
      fetchStats();
    } catch (err: any) {
      const apiErrors = err.response?.data?.errors;
      if (apiErrors?.non_field_errors) setAdminFormError(apiErrors.non_field_errors[0]);
      else if (apiErrors?.clinic_id) setAdminFormError(apiErrors.clinic_id[0]);
      else setAdminFormError("Failed to create Clinic Admin.");
    } finally { setAdminFormLoading(false); }
  };

  const handleCreateClinic = async (e: React.FormEvent) => {
    e.preventDefault(); setClinicFormLoading(true); setClinicFormError(""); setClinicFormSuccess("");
    try {
      await apiClient.post("/clinics/create/", clinicFormData);
      setClinicFormSuccess("Clinic created successfully!");
      setClinicFormData({ name: "", address: "", subscription_plan: "BASIC" });
      setTimeout(() => setIsClinicModalOpen(false), 2000);
      fetchStats();
    } catch (err: any) {
      setClinicFormError(err.response?.data?.errors?.non_field_errors?.[0] || "Failed to create Clinic.");
    } finally { setClinicFormLoading(false); }
  };

  const handleImpersonate = async (clinicId: number) => {
    if (!confirm("Are you sure you want to login as the admin of this clinic?")) return;
    try {
      const res = await apiClient.post("/accounts/impersonate/", { clinic_id: clinicId });
      localStorage.setItem("access_token", res.data.access);
      localStorage.setItem("refresh_token", res.data.refresh);
      window.location.href = "/dashboard";
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to impersonate clinic admin.");
    }
  };

  const handleToggleStatus = async (clinicId: number, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'suspend' : 'activate'} this clinic?`)) return;
    try {
      await apiClient.patch(`/clinics/${clinicId}/toggle-status/`);
      fetchStats();
    } catch (err) {
      alert("Failed to toggle clinic status.");
    }
  };

  const handleGeneratePaymentLink = async () => {
    if (!billingClinic) return;
    setBillingLoading(true);
    setBillingError("");
    setBillingResult("");
    try {
      const { data } = await apiClient.post("/billing/super-admin/generate-subscription-link/", {
        clinic_id: billingClinic.id,
        plan: billingPlan,
      });
      setBillingResult(data.payment_link_url);
      setBillingAction("generate");
    } catch (err: any) {
      setBillingError(err.response?.data?.error || "Failed to generate link.");
    } finally {
      setBillingLoading(false);
    }
  };

  const handleChangePlan = async () => {
    if (!billingClinic) return;
    if (!confirm(`Change ${billingClinic.name}'s plan to "${billingPlan}"?`)) return;
    setBillingLoading(true);
    setBillingError("");
    try {
      await apiClient.post(`/clinics/super-admin/${billingClinic.id}/change-plan/`, { plan: billingPlan });
      setBillingAction("change-plan");
      setBillingResult(`Plan updated to "${billingPlan}" successfully.`);
      fetchStats();
    } catch (err: any) {
      setBillingError(err.response?.data?.error || "Failed to change plan.");
    } finally {
      setBillingLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" /></div>
  );

  if (error || !data) return (
    <div className="p-8 text-center"><AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" /><p className="text-gray-700 font-medium">{error || "No data available."}</p></div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-violet-600" />
            <span className="text-xs font-bold uppercase tracking-widest text-violet-600">SaaS Command Center</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Platform Overview</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsClinicModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 shadow-sm transition">
            <PlusCircle className="w-4 h-4" /> Create Clinic
          </button>
          <button onClick={openAdminModal} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 shadow-sm transition">
            <UserPlus className="w-4 h-4" /> Create Admin
          </button>
          <button onClick={fetchStats} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 shadow-sm transition">
            <Activity className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button onClick={() => setActiveTab("overview")} className={`px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === "overview" ? "border-violet-600 text-violet-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Overview
        </button>
        <button onClick={() => setActiveTab("clinics")} className={`px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === "clinics" ? "border-violet-600 text-violet-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Tenants ({data.total_clinics})
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard label="MRR (Revenue)" value={`₹${data.total_revenue_paid.toLocaleString()}`} icon={DollarSign} color="bg-emerald-50 text-emerald-600" sub="All-time paid invoices" />
            <StatCard label="Active Clinics" value={data.active_clinics} icon={Building2} color="bg-violet-50 text-violet-600" sub={`Out of ${data.total_clinics} total`} />
            <StatCard label="Total Users" value={data.total_users} icon={Users} color="bg-blue-50 text-blue-600" sub="Doctors, patients, staff" />
            <StatCard label="Total Appointments" value={data.total_appointments} icon={CalendarCheck} color="bg-amber-50 text-amber-600" sub={`${data.appointments_today} today`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">7-Day Platform Growth</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trend_data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} dy={10} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} name="Revenue (₹)" />
                    <Line yAxisId="right" type="monotone" dataKey="appointments" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 6 }} name="Appointments" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Security Feed</h3>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              </div>
              <div className="space-y-4">
                {data.recent_logs.map((log: any) => (
                  <div key={log.id} className="text-sm border-l-2 border-gray-200 pl-3 py-1">
                    <p className="text-gray-900 font-medium">{log.user} <span className="text-gray-400 font-normal">in</span> {log.clinic}</p>
                    <p className="text-gray-500">{log.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                  </div>
                ))}
                {data.recent_logs.length === 0 && <p className="text-gray-400 text-sm">No recent activity.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLINICS TAB */}
      {activeTab === "clinics" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Tenant</th>
                  <th className="px-6 py-4 text-left font-semibold">Plan</th>
                  <th className="px-6 py-4 text-center font-semibold">Doctors / Patients</th>
                  <th className="px-6 py-4 text-right font-semibold">Appts (Today)</th>
                  <th className="px-6 py-4 text-center font-semibold">Status</th>
                  <th className="px-6 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.clinic_breakdown.map((clinic) => (
                  <tr key={clinic.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{clinic.name}</td>
                    <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${PLAN_BADGE[clinic.plan] || "bg-gray-100 text-gray-600"}`}>{clinic.plan}</span></td>
                    <td className="px-6 py-4 text-center text-gray-500 font-medium">{clinic.total_doctors} / {clinic.total_patients}</td>
                    <td className="px-6 py-4 text-right text-gray-500 font-medium">{clinic.total_appointments} <span className="text-emerald-600 font-bold">({clinic.appointments_today})</span></td>
                    <td className="px-6 py-4 text-center">
                      {clinic.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded-full"><AlertTriangle className="w-3.5 h-3.5" /> Suspended</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => handleImpersonate(clinic.id)} className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg transition" title="Login as Admin">
                        <LogIn className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleToggleStatus(clinic.id, clinic.is_active)} className={`p-2 rounded-lg transition ${clinic.is_active ? 'text-red-500 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`} title={clinic.is_active ? "Suspend Clinic" : "Activate Clinic"}>
                        {clinic.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openBillingModal(clinic)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="Billing Actions">
                        <Link2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Clinic Modal */}
      {isClinicModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">Create Tenant</h3>
              <button onClick={() => setIsClinicModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateClinic} className="p-6 space-y-4">
              {clinicFormError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl">{clinicFormError}</div>}
              {clinicFormSuccess && <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-xl">{clinicFormSuccess}</div>}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Clinic Name</label><input type="text" required value={clinicFormData.name} onChange={(e) => setClinicFormData({ ...clinicFormData, name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><textarea required rows={2} value={clinicFormData.address} onChange={(e) => setClinicFormData({ ...clinicFormData, address: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none resize-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Subscription Plan</label><select required value={clinicFormData.subscription_plan} onChange={(e) => setClinicFormData({ ...clinicFormData, subscription_plan: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none bg-white"><option value="BASIC">Basic</option><option value="PRO">Pro</option><option value="ENTERPRISE">Enterprise</option></select></div>
              <div className="pt-4 flex gap-3"><button type="button" onClick={() => setIsClinicModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition">Cancel</button><button type="submit" disabled={clinicFormLoading} className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition disabled:opacity-50">{clinicFormLoading ? "Creating..." : "Create Clinic"}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Create Clinic Admin Modal */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">Assign Tenant Admin</h3>
              <button onClick={() => setIsAdminModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateAdmin} className="p-6 space-y-4">
              {adminFormError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl">{adminFormError}</div>}
              {adminFormSuccess && <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-xl">{adminFormSuccess}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name</label><input type="text" required value={adminFormData.first_name} onChange={(e) => setAdminFormData({ ...adminFormData, first_name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-violet-600 outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label><input type="text" required value={adminFormData.last_name} onChange={(e) => setAdminFormData({ ...adminFormData, last_name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-violet-600 outline-none" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" required value={adminFormData.email} onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-violet-600 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><input type="password" required minLength={8} value={adminFormData.password} onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-violet-600 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Assign to Tenant</label><select required value={adminFormData.clinic_id} onChange={(e) => setAdminFormData({ ...adminFormData, clinic_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-violet-600 outline-none bg-white"><option value="" disabled>Select a clinic</option>{clinics.map((clinic) => (<option key={clinic.id} value={clinic.id}>{clinic.name}</option>))}</select></div>
              <div className="pt-4 flex gap-3"><button type="button" onClick={() => setIsAdminModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition">Cancel</button><button type="submit" disabled={adminFormLoading} className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition disabled:opacity-50">{adminFormLoading ? "Creating..." : "Assign Admin"}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Billing Actions Modal */}
      {billingClinic && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Billing Actions</h3>
                <p className="text-xs text-gray-500 mt-0.5">Fallback tools for: <strong>{billingClinic.name}</strong></p>
              </div>
              <button onClick={() => setBillingClinic(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              {billingError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {billingError}
                </div>
              )}

              {/* Plan selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Target Plan</label>
                <div className="grid grid-cols-2 gap-2">
                  {["professional", "enterprise"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setBillingPlan(p)}
                      className={`py-2.5 px-4 rounded-xl border text-sm font-semibold capitalize transition-all ${
                        billingPlan === p
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-700 border-gray-200 hover:border-indigo-200"
                      }`}
                    >
                      {p} {p === "professional" ? "(₹999/mo)" : "(₹2999/mo)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Payment Link */}
              <div className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <Link2 className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Generate Payment Link</p>
                    <p className="text-xs text-gray-500 mt-0.5">Create a one-time Razorpay link to share via WhatsApp/email when e-mandate fails.</p>
                  </div>
                </div>
                {billingAction === "generate" && billingResult ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <span className="text-xs text-gray-600 flex-1 truncate font-mono">{billingResult}</span>
                      <button
                        onClick={() => copyToClipboard(billingResult)}
                        className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-all ${
                          copied ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                        }`}
                      >
                        {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                      </button>
                    </div>
                    <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">After payment is confirmed, use "Change Plan" below to activate the clinic.</p>
                  </div>
                ) : (
                  <button
                    onClick={handleGeneratePaymentLink}
                    disabled={billingLoading}
                    className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {billingLoading && billingAction !== "change-plan" ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Link2 className="w-4 h-4" />}
                    Generate Link
                  </button>
                )}
              </div>

              {/* Change Plan Manually */}
              <div className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <ChevronsUp className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Manually Change Plan</p>
                    <p className="text-xs text-gray-500 mt-0.5">Use after confirming payment receipt. Activates the plan immediately.</p>
                  </div>
                </div>
                {billingAction === "change-plan" && billingResult ? (
                  <div className="bg-emerald-50 text-emerald-700 text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> {billingResult}
                  </div>
                ) : (
                  <button
                    onClick={handleChangePlan}
                    disabled={billingLoading}
                    className="w-full py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {billingLoading && billingAction !== "generate" ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <ChevronsUp className="w-4 h-4" />}
                    Activate {billingPlan.charAt(0).toUpperCase() + billingPlan.slice(1)} Plan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
