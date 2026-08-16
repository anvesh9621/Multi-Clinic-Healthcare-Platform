"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import apiClient from "@/services/api";
import {
  Building2,
  Users,
  CalendarCheck,
  DollarSign,
  Activity,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  UserPlus,
  X,
  PlusCircle,
  LogIn,
  Power,
  PowerOff,
  Link2,
  Copy,
  ChevronsUp,
  Check,
  RefreshCw,
  CreditCard,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { MotionDivItem } from "@/components/ui/MotionListItem";
import { AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { FormLegend } from "@/components/ui/FormLegend";

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

interface PaginatedClinicsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ClinicRow[];
}

interface PaymentSnapshot {
  id: number;
  date: string;
  date_formatted: string;
  total_payment_attempts: number;
  successful_payments: number;
  failed_payments: number;
  success_rate: number;
  reconciliation_catches: number;
  refunds_processed: number;
  refund_total_amount: number;
  avg_time_to_payment_seconds: number | null;
}

interface PaymentMetricsData {
  days: number;
  overall_success_rate: number;
  total_attempts: number;
  total_successful: number;
  total_failed: number;
  total_reconciliation_catches: number;
  total_refunds: number;
  total_refund_amount: number;
  snapshots: PaymentSnapshot[];
}

interface SuperAdminOverviewData {
  total_clinics: number;
  active_clinics: number;
  total_users: number;
  total_appointments: number;
  appointments_today: number;
  total_revenue_paid: number;
  trend_data: {
    date: string;
    revenue: number;
    appointments: number;
  }[];
  recent_logs: {
    id: number;
    timestamp: string;
    action: string;
    user: string;
    clinic: string;
    description: string;
  }[];
}

const PLAN_BADGE: Record<string, string> = {
  BASIC: "bg-warm-surface border border-border text-muted font-bold",
  STARTER: "bg-warm-surface border border-border text-muted font-bold",
  PRO: "bg-blue-100 border border-blue-200 text-blue-800 font-bold",
  PROFESSIONAL: "bg-blue-100 border border-blue-200 text-blue-800 font-bold",
  ENTERPRISE: "bg-purple-100 border border-purple-200 text-purple-800 font-bold",
};

function StatCard({ label, value, icon: Icon, color, sub, format }: any) {
  return (
    <Card className="p-6 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-muted font-bold">{label}</p>
        <div className="text-3xl font-bold text-ink mt-0.5 heading-font">
          <AnimatedNumber value={value} format={format} />
        </div>
        {sub && <p className="text-xs text-muted mt-1 font-medium">{sub}</p>}
      </div>
    </Card>
  );
}

function TabLoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function TabErrorDisplay({ message }: { message: string }) {
  return (
    <div className="p-8 text-center max-w-xl mx-auto">
      <Card className="p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="text-ink font-bold text-lg">{message}</p>
      </Card>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "clinics" | "payments">("overview");

  // Tab 1: Overview Query (Independent)
  const {
    data: overviewData,
    isLoading: overviewLoading,
    error: overviewQueryError,
  } = useQuery({
    queryKey: ["super-admin", "overview"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/super-admin/");
      return res.data.data as SuperAdminOverviewData;
    },
    enabled: !!user && user.role === "SUPER_ADMIN",
  });

  // Tab 2: Payments Query (Independent, Lazy loaded on tab activate)
  const {
    data: paymentData,
    isLoading: paymentsLoading,
    error: paymentsQueryError,
  } = useQuery({
    queryKey: ["super-admin", "payments"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/payment-metrics/?days=30");
      return res.data.data as PaymentMetricsData;
    },
    enabled: !!user && user.role === "SUPER_ADMIN" && activeTab === "payments",
  });

  // Tab 3: Clinics Query (Independent, Paginated & Searchable, Lazy loaded on tab activate)
  const [clinicPage, setClinicPage] = useState(1);
  const [clinicSearch, setClinicSearch] = useState("");
  const [searchInputValue, setSearchInputValue] = useState("");

  const {
    data: clinicsData,
    isLoading: clinicsLoading,
    error: clinicsQueryError,
  } = useQuery({
    queryKey: ["super-admin", "tenants", clinicPage, clinicSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(clinicPage));
      if (clinicSearch) params.set("search", clinicSearch);
      const res = await apiClient.get(`/analytics/super-admin/clinics/?${params.toString()}`);
      return res.data as PaginatedClinicsResponse;
    },
    enabled: !!user && user.role === "SUPER_ADMIN" && activeTab === "clinics",
  });

  // Modal State for Clinic Admin
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const { data: clinics = [] } = useQuery({
    queryKey: ["super-admin", "clinics-dropdown"],
    queryFn: async () => {
      const res = await apiClient.get("/doctors/clinics/");
      return (Array.isArray(res.data) ? res.data : (res.data?.results || [])) as { id: number; name: string }[];
    },
    enabled: isAdminModalOpen && !!user && user.role === "SUPER_ADMIN",
  });
  const [adminFormData, setAdminFormData] = useState({
    email: "", clinic_id: "",
  });
  const [adminFormLoading, setAdminFormLoading] = useState(false);
  const [adminFormError, setAdminFormError] = useState("");
  const [adminFormSuccess, setAdminFormSuccess] = useState("");

  // Modal State for Clinic Creation
  const [isClinicModalOpen, setIsClinicModalOpen] = useState(false);
  const [clinicFormData, setClinicFormData] = useState({
    name: "", address: "",
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
    }
  }, [user, router]);

  const openAdminModal = async () => {
    setIsAdminModalOpen(true); 
    setAdminFormError(""); 
    setAdminFormSuccess("");
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault(); setAdminFormLoading(true); setAdminFormError(""); setAdminFormSuccess("");
    try {
      await apiClient.post("/accounts/clinic-admins/create/", {
        email: adminFormData.email.trim().toLowerCase(),
        clinic_id: adminFormData.clinic_id,
      });
      setAdminFormSuccess("Clinic Admin invitation sent successfully! They will receive an email link.");
      setAdminFormData({ email: "", clinic_id: "" });
      setTimeout(() => setIsAdminModalOpen(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["super-admin"] });
    } catch (err: any) {
      const apiErrors = err.response?.data?.errors;
      if (apiErrors?.non_field_errors) setAdminFormError(apiErrors.non_field_errors[0]);
      else if (apiErrors?.email) setAdminFormError(apiErrors.email[0]);
      else if (apiErrors?.clinic_id) setAdminFormError(apiErrors.clinic_id[0]);
      else setAdminFormError(err.response?.data?.error || "Failed to invite Clinic Admin.");
    } finally { setAdminFormLoading(false); }
  };

  const handleCreateClinic = async (e: React.FormEvent) => {
    e.preventDefault(); setClinicFormLoading(true); setClinicFormError(""); setClinicFormSuccess("");
    try {
      await apiClient.post("/clinics/create/", clinicFormData);
      setClinicFormSuccess("Clinic created successfully!");
      setClinicFormData({ name: "", address: "" });
      setTimeout(() => setIsClinicModalOpen(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["super-admin"] });
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
      queryClient.invalidateQueries({ queryKey: ["super-admin"] });
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
      queryClient.invalidateQueries({ queryKey: ["super-admin"] });
    } catch (err: any) {
      setBillingError(err.response?.data?.error || "Failed to change plan.");
    } finally {
      setBillingLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClinicPage(1);
    setClinicSearch(searchInputValue.trim());
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const selectClass = "w-full border border-border rounded-xl px-4 py-2.5 bg-warm-surface text-ink font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition shadow-sm";

  const totalClinicsCount = overviewData?.total_clinics ?? clinicsData?.count ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">SaaS Command Center</span>
          </div>
          <h1 className="text-3xl font-bold text-ink heading-font">Platform Overview</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setIsClinicModalOpen(true)}>
            <PlusCircle className="w-4 h-4 mr-1.5" /> Create Clinic
          </Button>
          <Button onClick={openAdminModal}>
            <UserPlus className="w-4 h-4 mr-1.5" /> Create Admin
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["super-admin"] })}
            title="Refresh Dashboard Data"
          >
            <Activity className="w-4 h-4 text-muted" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === "overview" ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("clinics")}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === "clinics" ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Tenants {totalClinicsCount > 0 ? `(${totalClinicsCount})` : ""}
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === "payments" ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Payment Health
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <>
          {overviewLoading ? (
            <TabLoadingSpinner />
          ) : overviewQueryError || !overviewData ? (
            <TabErrorDisplay message="Failed to load platform overview stats." />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard
                  label="MRR (Revenue)"
                  value={overviewData.total_revenue_paid}
                  format={(v: number) => `₹${Math.round(v).toLocaleString()}`}
                  icon={DollarSign}
                  color="bg-emerald-100 text-emerald-800"
                  sub="All-time paid invoices"
                />
                <StatCard
                  label="Active Clinics"
                  value={overviewData.active_clinics}
                  icon={Building2}
                  color="bg-primary/10 text-primary"
                  sub={`Out of ${overviewData.total_clinics} total`}
                />
                <StatCard
                  label="Total Users"
                  value={overviewData.total_users}
                  icon={Users}
                  color="bg-blue-100 text-blue-800"
                  sub="Doctors, patients, staff"
                />
                <StatCard
                  label="Total Appointments"
                  value={overviewData.total_appointments}
                  icon={CalendarCheck}
                  color="bg-amber-100 text-amber-800"
                  sub={`${overviewData.appointments_today} today`}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 p-6">
                  <h3 className="text-lg font-bold text-ink mb-6 heading-font">7-Day Platform Growth</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overviewData.trend_data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EDEDE8" vertical={false} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: '1px solid #EDEDE8', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} name="Revenue (₹)" />
                        <Line yAxisId="right" type="monotone" dataKey="appointments" stroke="#0F7B6C" strokeWidth={3} dot={{ r: 4, fill: '#0F7B6C', strokeWidth: 0 }} activeDot={{ r: 6 }} name="Appointments" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-ink heading-font">Security Feed</h3>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                  </div>
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {overviewData.recent_logs.map((log) => (
                        <MotionDivItem key={log.id} className="text-sm border-l-2 border-border pl-3 py-1">
                          <p className="text-ink font-semibold">{log.user} <span className="text-muted font-normal">in</span> {log.clinic}</p>
                          <p className="text-muted">{log.description}</p>
                          <p className="text-xs text-muted mt-1 font-mono">{new Date(log.timestamp).toLocaleString()}</p>
                        </MotionDivItem>
                      ))}
                    </AnimatePresence>
                    {overviewData.recent_logs.length === 0 && <p className="text-muted text-sm font-medium">No recent activity.</p>}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      {/* PAYMENT HEALTH TAB */}
      {activeTab === "payments" && (
        <>
          {paymentsLoading ? (
            <TabLoadingSpinner />
          ) : paymentsQueryError || !paymentData ? (
            <TabErrorDisplay message="Failed to load payment health metrics." />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <StatCard
                  label="Payment Success Rate"
                  value={paymentData.overall_success_rate ?? 100}
                  format={(v: number) => `${v.toFixed(1)}%`}
                  icon={CheckCircle2}
                  color="bg-emerald-100 text-emerald-800"
                  sub="Successful / Total Attempts"
                />
                <StatCard
                  label="Reconciliation Catches"
                  value={paymentData.total_reconciliation_catches ?? 0}
                  icon={RefreshCw}
                  color="bg-amber-100 text-amber-800"
                  sub="Key Webhook Reliability Signal"
                />
                <StatCard
                  label="Tracked Days"
                  value={paymentData.snapshots?.length ?? 0}
                  icon={CreditCard}
                  color="bg-blue-100 text-blue-800"
                  sub="Daily Metric Snapshots"
                />
              </div>

              {/* Webhook Health Signal Callout Alert */}
              <Card className="p-5 bg-amber-50/70 border-amber-200/80 rounded-2xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-900 heading-font">
                      Webhook Reliability Health Signal
                    </h4>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      <strong>Reconciliation Catches</strong> represent payments that were completed on Razorpay but required background job reconciliation because the webhook was missed or delayed. Per platform architecture guidelines, this number <strong>should trend toward zero</strong>. A sustained non-zero trend indicates webhook delivery reliability issues that require active investigation, rather than relying on reconciliation as a permanent crutch.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Chart */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-ink mb-6 heading-font">
                  Payment Health Trends (Last 30 Days)
                </h3>
                {paymentData.snapshots && paymentData.snapshots.length > 0 ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={paymentData.snapshots} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EDEDE8" vertical={false} />
                        <XAxis dataKey="date_formatted" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                        <YAxis yAxisId="left" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} unit="%" />
                        <YAxis yAxisId="right" orientation="right" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: '1px solid #EDEDE8', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line yAxisId="left" type="monotone" dataKey="success_rate" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} name="Success Rate (%)" />
                        <Line yAxisId="right" type="monotone" dataKey="reconciliation_catches" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 6 }} name="Reconciliation Catches" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-muted text-sm py-12 text-center">No payment snapshots recorded yet. Snapshots are automatically calculated daily at 2:00 AM off-peak.</p>
                )}
              </Card>

              {/* Table */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-ink mb-4 heading-font">
                  Daily Payment Metric Snapshots
                </h3>
                {paymentData.snapshots && paymentData.snapshots.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Attempts</TableHead>
                        <TableHead className="text-right">Successful</TableHead>
                        <TableHead className="text-right">Failed</TableHead>
                        <TableHead className="text-center">Success Rate</TableHead>
                        <TableHead className="text-center">Reconciliation Catches</TableHead>
                        <TableHead className="text-right">Refunds</TableHead>
                        <TableHead className="text-right">Avg Pay Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentData.snapshots.map((snap) => (
                        <TableRow key={snap.id}>
                          <TableCell className="font-bold text-ink">{snap.date_formatted}</TableCell>
                          <TableCell className="text-right font-mono">{snap.total_payment_attempts}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-700 font-bold">{snap.successful_payments}</TableCell>
                          <TableCell className="text-right font-mono text-rose-600 font-medium">{snap.failed_payments}</TableCell>
                          <TableCell className="text-center font-bold">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${snap.success_rate >= 90 ? 'bg-emerald-100 text-emerald-800' : snap.success_rate >= 75 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                              {snap.success_rate}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-bold font-mono">
                            {snap.reconciliation_catches > 0 ? (
                              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs">
                                {snap.reconciliation_catches}
                              </span>
                            ) : (
                              <span className="text-muted font-normal">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {snap.refunds_processed > 0 ? `${snap.refunds_processed} (₹${snap.refund_total_amount})` : '0'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted">
                            {snap.avg_time_to_payment_seconds !== null ? `${snap.avg_time_to_payment_seconds}s` : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted text-sm text-center py-6">No snapshot history found.</p>
                )}
              </Card>
            </div>
          )}
        </>
      )}

      {/* CLINICS TAB */}
      {activeTab === "clinics" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Search tenants by name..."
                  value={searchInputValue}
                  onChange={(e) => setSearchInputValue(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm">Search</Button>
              {clinicSearch && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInputValue("");
                    setClinicSearch("");
                    setClinicPage(1);
                  }}
                >
                  Clear
                </Button>
              )}
            </form>

            <div className="text-xs text-muted font-medium self-end sm:self-center">
              {clinicsData ? `Total Tenants: ${clinicsData.count}` : ""}
            </div>
          </div>

          {clinicsLoading ? (
            <TabLoadingSpinner />
          ) : clinicsQueryError || !clinicsData ? (
            <TabErrorDisplay message="Failed to load clinic tenants." />
          ) : clinicsData.results.length === 0 ? (
            <Card className="p-8 text-center">
              <Building2 className="w-8 h-8 text-muted mx-auto mb-2" />
              <p className="text-muted text-sm font-medium">No tenants found matching your criteria.</p>
            </Card>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-center">Doctors / Patients</TableHead>
                    <TableHead className="text-right">Appts (Today)</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clinicsData.results.map((clinic) => (
                    <TableRow key={clinic.id}>
                      <TableCell className="font-bold text-ink">{clinic.name}</TableCell>
                      <TableCell>
                        <span className={`px-2.5 py-1 rounded-full text-xs uppercase tracking-wider ${PLAN_BADGE[clinic.plan] || "bg-warm-surface border border-border text-muted font-bold"}`}>
                          {clinic.plan}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-muted font-semibold">{clinic.total_doctors} / {clinic.total_patients}</TableCell>
                      <TableCell className="text-right text-muted font-medium font-mono">
                        {clinic.total_appointments} <span className="text-emerald-700 font-bold">({clinic.appointments_today})</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {clinic.is_active ? (
                          <span className="inline-flex items-center gap-1 text-emerald-800 text-xs font-bold bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-800 text-xs font-bold bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-full">
                            <AlertTriangle className="w-3.5 h-3.5" /> Suspended
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleImpersonate(clinic.id)}
                          className="text-primary hover:text-primary-dark"
                          title="Login as Admin"
                        >
                          <LogIn className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(clinic.id, clinic.is_active)}
                          className={clinic.is_active ? 'text-rose-600 hover:text-rose-800' : 'text-emerald-600 hover:text-emerald-800'}
                          title={clinic.is_active ? "Suspend Clinic" : "Activate Clinic"}
                        >
                          {clinic.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openBillingModal(clinic)}
                          className="text-accent hover:text-accent/80"
                          title="Billing Actions"
                        >
                          <Link2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <p className="text-xs text-muted font-medium">
                  Page {clinicPage} of {Math.max(1, Math.ceil(clinicsData.count / 10))} ({clinicsData.count} total)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!clinicsData.previous || clinicPage <= 1}
                    onClick={() => setClinicPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!clinicsData.next}
                    onClick={() => setClinicPage((p) => p + 1)}
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Create Clinic Modal */}
      <Modal isOpen={isClinicModalOpen} onClose={() => setIsClinicModalOpen(false)} title="Create Tenant" className="max-w-md">
        <form onSubmit={handleCreateClinic} className="space-y-4">
          <FormLegend />
          {clinicFormError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl">{clinicFormError}</div>}
          {clinicFormSuccess && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold rounded-xl">{clinicFormSuccess}</div>}
          
          <div>
            <label className="block text-sm font-bold text-ink mb-1">
              Clinic Name <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            </label>
            <Input type="text" required value={clinicFormData.name} onChange={(e) => setClinicFormData({ ...clinicFormData, name: e.target.value })} placeholder="City Health Care" />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">
              Address <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            </label>
            <textarea required rows={2} value={clinicFormData.address} onChange={(e) => setClinicFormData({ ...clinicFormData, address: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 bg-warm-surface text-ink font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none shadow-sm text-sm" placeholder="Street address..." />
          </div>

          <div className="pt-4 flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => setIsClinicModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={clinicFormLoading}>{clinicFormLoading ? "Creating..." : "Create Clinic"}</Button>
          </div>
        </form>
      </Modal>

      {/* Invite Clinic Admin Modal */}
      <Modal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} title="Invite Tenant Admin" className="max-w-md">
        <form onSubmit={handleCreateAdmin} className="space-y-4">
          <FormLegend />
          {adminFormError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl">{adminFormError}</div>}
          {adminFormSuccess && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold rounded-xl">{adminFormSuccess}</div>}
          
          <div>
            <label className="block text-sm font-bold text-ink mb-1">
              Email <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            </label>
            <Input type="email" required placeholder="admin@clinic.com" value={adminFormData.email} onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })} />
            <p className="text-xs text-muted mt-1">An invitation link will be sent to set up their profile and password.</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">
              Assign to Tenant <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            </label>
            <select required value={adminFormData.clinic_id} onChange={(e) => setAdminFormData({ ...adminFormData, clinic_id: e.target.value })} className={selectClass}>
              <option value="" disabled>Select a clinic</option>
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => setIsAdminModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={adminFormLoading}>{adminFormLoading ? "Sending..." : "Send Invitation"}</Button>
          </div>
        </form>
      </Modal>

      {/* Billing Actions Modal */}
      {billingClinic && (
        <Modal isOpen={!!billingClinic} onClose={() => setBillingClinic(null)} title="Billing Actions" className="max-w-md">
          <p className="text-xs text-muted mb-4 font-semibold">Fallback tools for: <strong className="text-ink">{billingClinic.name}</strong></p>

          <div className="space-y-5">
            {billingError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {billingError}
              </div>
            )}

            {/* Plan selector */}
            <div>
              <label className="block text-sm font-bold text-ink mb-2">Target Plan</label>
              <div className="grid grid-cols-2 gap-2">
                {["professional", "enterprise"].map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={billingPlan === p ? "default" : "outline"}
                    onClick={() => setBillingPlan(p)}
                    className="capitalize py-2.5 text-xs font-bold"
                  >
                    {p} {p === "professional" ? "(₹999/mo)" : "(₹2999/mo)"}
                  </Button>
                ))}
              </div>
            </div>

            {/* Generate Payment Link */}
            <div className="border border-border rounded-xl p-4 bg-warm-surface/30">
              <div className="flex items-start gap-3 mb-3">
                <Link2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-ink text-sm">Generate Payment Link</p>
                  <p className="text-xs text-muted mt-0.5">Create a one-time Razorpay link to share via WhatsApp/email when e-mandate fails.</p>
                </div>
              </div>
              {billingAction === "generate" && billingResult ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-paper border border-border rounded-lg px-3 py-2">
                    <span className="text-xs text-ink flex-1 truncate font-mono">{billingResult}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(billingResult)}
                      className="text-xs font-bold text-primary"
                    >
                      {copied ? <><Check className="w-3 h-3 mr-1" /> Copied!</> : <><Copy className="w-3 h-3 mr-1" /> Copy</>}
                    </Button>
                  </div>
                  <p className="text-xs text-amber-800 bg-amber-100 border border-amber-200 px-3 py-2 rounded-lg font-medium">After payment is confirmed, use "Change Plan" below to activate the clinic.</p>
                </div>
              ) : (
                <Button
                  onClick={handleGeneratePaymentLink}
                  disabled={billingLoading}
                  className="w-full"
                >
                  <Link2 className="w-4 h-4 mr-2" /> Generate Link
                </Button>
              )}
            </div>

            {/* Change Plan Manually */}
            <div className="border border-border rounded-xl p-4 bg-warm-surface/30">
              <div className="flex items-start gap-3 mb-3">
                <ChevronsUp className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-ink text-sm">Manually Change Plan</p>
                  <p className="text-xs text-muted mt-0.5">Use after confirming payment receipt. Activates the plan immediately.</p>
                </div>
              </div>
              {billingAction === "change-plan" && billingResult ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold px-3 py-2 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {billingResult}
                </div>
              ) : (
                <Button
                  onClick={handleChangePlan}
                  disabled={billingLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                >
                  <ChevronsUp className="w-4 h-4 mr-2" /> Activate {billingPlan.charAt(0).toUpperCase() + billingPlan.slice(1)} Plan
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
