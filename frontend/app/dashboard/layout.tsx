"use client";

import { useContext, useEffect, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { logout } from "@/services/auth";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarPlus,
  Stethoscope,
  Users,
  UserCog,
  Clock,
  ClipboardList,
  HeartPulse,
  LogOut,
  User,
  Receipt,
  Package,
  ShieldCheck,
  BarChart3,
  CreditCard,
  Landmark,
  Settings,
} from "lucide-react";
import { PageLoader } from "@/components/ui/Skeleton";
import { NotificationProvider } from "@/context/NotificationContext";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { SubscriptionProvider, useSubscription } from "@/context/SubscriptionContext";
import { AlertCircle } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const COMMON_NAV: NavItem[] = [
  { label: "Dashboard",    href: "/dashboard",             icon: LayoutDashboard },
  { label: "Appointments", href: "/dashboard/appointments", icon: CalendarCheck },
];

const ROLE_NAV: Record<string, NavItem[]> = {
  PATIENT: [
    { label: "Book Appointment", href: "/dashboard/book",            icon: CalendarPlus },
    { label: "Medical History",  href: "/dashboard/history",         icon: ClipboardList },
    { label: "My Invoices",      href: "/dashboard/patient/invoices", icon: Receipt },
  ],
  DOCTOR: [
    { label: "Live Queue",    href: "/dashboard/doctor",            icon: LayoutDashboard },
    { label: "Patient DB",    href: "/dashboard/doctor/history",    icon: Users },
    { label: "Rx Templates",  href: "/dashboard/doctor/templates",  icon: ClipboardList },
    { label: "Schedule & Leaves", href: "/dashboard/doctor/schedule", icon: CalendarPlus },
    { label: "My Profile",    href: "/dashboard/doctor/profile",    icon: UserCog },
  ],
  CLINIC_ADMIN: [
    { label: "Clinic Billing",       href: "/dashboard/receptionist/billing",  icon: Receipt },
    { label: "Manage Doctors",       href: "/dashboard/admin/doctors",       icon: Stethoscope },
    { label: "Manage Receptionists", href: "/dashboard/admin/receptionists", icon: UserCog },
    { label: "Doctor Schedules",     href: "/dashboard/admin/schedules",     icon: Clock },
    { label: "Clinic Inventory",     href: "/dashboard/admin/inventory",     icon: Package },
    { label: "Subscription",         href: "/dashboard/admin/subscription",  icon: CreditCard },
    { label: "Bank Account",         href: "/dashboard/admin/bank",          icon: Landmark },
  ],
  RECEPTIONIST: [
    { label: "Manage Patients",  href: "/dashboard/receptionist/patients", icon: Users },
    { label: "Book Appointment", href: "/dashboard/receptionist/book",     icon: CalendarPlus },
    { label: "Live Queue",       href: "/dashboard/receptionist/queue",    icon: LayoutDashboard },
    { label: "Clinic Billing",   href: "/dashboard/receptionist/billing",  icon: Receipt },
    { label: "Clinic Inventory", href: "/dashboard/admin/inventory",       icon: Package },
  ],
  SUPER_ADMIN: [
    { label: "Platform Overview", href: "/dashboard/super-admin",          icon: ShieldCheck },
    { label: "All Clinics",       href: "/dashboard/super-admin#clinics",  icon: BarChart3 },
    { label: "Platform Settings", href: "/dashboard/super-admin/settings", icon: Settings },
  ],
};

function decodeRoleFromToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const token = localStorage.getItem("access");
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const decoded = JSON.parse(jsonPayload);
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }
    return decoded.role || null;
  } catch {
    return null;
  }
}

function NavLink({ href, icon: Icon, label, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={`
        relative flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm
        transition-all duration-300 group
        ${active
          ? "bg-blue-50 text-blue-700 font-semibold border border-blue-100 shadow-sm"
          : "text-gray-500 hover:text-blue-600 hover:bg-gray-50"
        }
      `}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 transition-transform duration-150 ${active ? "" : "group-hover:scale-110"}`} />
      <span>{label}</span>
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full -ml-px hidden sm:block" />
      )}
    </Link>
  );
}

function SubscriptionBanner({ userRole }: { userRole: string }) {
  const { subscription } = useSubscription();
  // Only CLINIC_ADMIN sees the subscription warning banner
  if (userRole !== 'CLINIC_ADMIN') return null;
  if (!subscription || !subscription.show_warning) return null;
  const graceEnd = subscription.grace_period_end
    ? new Date(subscription.grace_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'soon';
  return (
    <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center justify-center gap-3 relative z-20">
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
      <p className="text-red-700 text-sm font-medium">
        Payment failed. Account suspends on {graceEnd}.
        {' '}<a href="/dashboard/admin/subscription" className="underline font-bold">Update billing →</a>
      </p>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const [tokenRole, setTokenRole] = useState<string | null>(() => decodeRoleFromToken());

  useEffect(() => {
    const role = decodeRoleFromToken();
    if (role !== tokenRole) {
      setTokenRole(role);
    }
  }, [tokenRole]);

  const effectiveRole = user?.role || tokenRole;

  useEffect(() => {
    if (!loading && !user && !effectiveRole) router.push("/login");
  }, [user, loading, effectiveRole, router]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (loading && !effectiveRole) return <PageLoader />;
  if (!loading && !user && !effectiveRole) return null;

  const currentRole = effectiveRole || "PATIENT";

  // Patient has their own full-page layout at /dashboard/patient
  // This layout serves staff roles + shared pages like /dashboard/appointments
  if (currentRole === "PATIENT" && pathname?.startsWith("/dashboard/patient")) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const roleNav = ROLE_NAV[currentRole] ?? [];
  const roleLabel: Record<string, string> = {
    CLINIC_ADMIN:  "Admin",
    RECEPTIONIST:  "Reception",
    DOCTOR:        "Clinical",
    PATIENT:       "My Health",
    SUPER_ADMIN:   "Super Admin",
  };
  const initials = user?.first_name
    ? `${user.first_name[0]}${user.last_name?.[0] ?? ""}`.toUpperCase()
    : user?.email
    ? user.email[0].toUpperCase()
    : currentRole[0];

  return (
    <SubscriptionProvider userRole={currentRole}>
      <NotificationProvider>
        <div className="flex min-h-screen bg-gray-50 transition-colors duration-300 selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-gray-900/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside 
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-100 flex flex-col h-screen overflow-y-auto flex-shrink-0 z-40 shadow-xl shadow-gray-200/20 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="px-5 py-6 border-b border-gray-100 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md group-hover:shadow-blue-600/30 transition-all duration-300">
              <HeartPulse className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">MediClinic</span>
          </Link>
          <button 
            className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            onClick={() => setMobileMenuOpen(false)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {COMMON_NAV.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={pathname === item.href}
            />
          ))}

          {roleNav.length > 0 && (
            <>
              <div className="pt-5 pb-2 px-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {roleLabel[currentRole] ?? currentRole}
                </p>
              </div>
              {roleNav.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  active={pathname === item.href || pathname?.startsWith(item.href + "/")}
                />
              ))}
            </>
          )}
        </nav>

        {/* User + Logout */}
        <div className="px-3 py-4 border-t border-gray-100 space-y-1 bg-white mt-auto">
          {/* Profile shortcut for patients */}
          {currentRole === "PATIENT" && (
            <Link
              href="/dashboard/patient/profile"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 hover:text-blue-600 hover:bg-gray-50 transition-all text-sm font-medium"
            >
              <User className="w-4 h-4" />
              My Profile
            </Link>
          )}

          {/* User card */}
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-50/80 border border-gray-100 hover:border-gray-200 transition-colors shadow-sm">
            <div className="relative">
              <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-inner">
                {initials}
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 text-xs font-semibold truncate">
                {user ? (user.first_name ? `${user.first_name} ${user.last_name ?? ""}` : user.email) : "Loading profile..."}
              </p>
              <p className="text-gray-500 text-[10px] truncate uppercase tracking-wider font-medium">{currentRole.replace("_", " ")}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all text-sm font-medium mt-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto relative flex flex-col">
        {/* Top Header for Notifications */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-20 flex-shrink-0">
          <div className="flex items-center">
            <button 
              className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              onClick={() => setMobileMenuOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          <NotificationBell />
        </header>
        
        <SubscriptionBanner userRole={currentRole} />
        
        <div className="p-6 max-w-7xl mx-auto relative z-10 w-full flex-1 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      </div>
      </NotificationProvider>
    </SubscriptionProvider>
  );
}
