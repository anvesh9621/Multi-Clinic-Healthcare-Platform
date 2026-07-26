/**
 * types/api.ts
 *
 * Canonical TypeScript interfaces derived from backend serializers.
 * These are the authoritative shapes consumed by the frontend.
 * Update when backend serializers change.
 */

// ── Auth / User ────────────────────────────────────────────────────────────────

export type UserRole =
  | "SUPER_ADMIN"
  | "CLINIC_ADMIN"
  | "DOCTOR"
  | "RECEPTIONIST"
  | "PATIENT";

export type Gender = "MALE" | "FEMALE" | "OTHER";

/** Shape returned by GET /accounts/me/ → data.data (MeSerializer) */
export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  gender: Gender | null;
  clinic_id: number | null;
}

/** Shape of AuthContext */
export interface AuthContextValue {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  loading: boolean;
}

// ── Receptionists ─────────────────────────────────────────────────────────────

export interface ReceptionistUser {
  id: number;
  email: string;
  created_at: string;
}

export interface ReceptionistInvitation {
  id: number;
  clinic_name: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  created_at: string;
  expires_at: string;
}

// ── Appointments ──────────────────────────────────────────────────────────────

export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

/** Shape returned by AppointmentListSerializer */
export interface Appointment {
  id: number;
  clinic: number;
  doctor_name: string;
  doctor_first_name: string;
  doctor_last_name: string;
  /** patient.id */
  patient: number;
  patient_email: string;
  patient_name: string;
  appointment_date: string;   // "YYYY-MM-DD"
  start_time: string;         // "HH:MM:SS"
  end_time: string;           // "HH:MM:SS"
  status: AppointmentStatus;
  reason: string;
  queue_token: number | null;
}

// ── Analytics / Dashboard ─────────────────────────────────────────────────────

/** Shape returned by /analytics/dashboard/ → data (get_clinic_dashboard_stats) */
export interface ClinicDashboardStats {
  appointments_today: number;
  appointments_this_week: number;
  completed_today: number;
  cancelled_today: number;
  total_patients: number;
  total_doctors: number;
}

/** Single row from /analytics/doctor-workload/ → data (get_doctor_workload) */
export interface DoctorWorkloadEntry {
  doctor: string;         // email
  appointments: number;
}

/** Single row from /analytics/appointment-trend/ → data (get_appointment_trend) */
export interface AppointmentTrendEntry {
  date: string;           // "YYYY-MM-DD"
  appointments: number;
}

// ── Super Admin Stats ─────────────────────────────────────────────────────────

export interface ClinicBreakdown {
  id: number;
  name: string;
  plan: string;
  is_active: boolean;
  total_appointments: number;
  appointments_today: number;
  total_doctors: number;
  total_patients: number;
}

export interface SuperAdminTrendEntry {
  date: string;           // "MMM DD"
  revenue: number;
  appointments: number;
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;      // ISO datetime
  action: string;
  user: string;
  clinic: string;
  description: string;
}

/** Shape returned by /analytics/super-admin/ → data */
export interface SuperAdminData {
  total_clinics: number;
  active_clinics: number;
  total_users: number;
  total_appointments: number;
  appointments_today: number;
  total_revenue_paid: number;
  clinic_breakdown: ClinicBreakdown[];
  trend_data: SuperAdminTrendEntry[];
  recent_logs: AuditLogEntry[];
}

// ── Doctors ───────────────────────────────────────────────────────────────────

/** Shape returned by /doctors/ list endpoint (DoctorClinicSerializer) */
export interface DoctorEntry {
  id: number;
  doctor_email: string;
  first_name: string;
  last_name: string;
  specialization: string;
  experience_years: number;
  qualifications: string;
  about: string;
  languages_spoken: string[];
  profile_photo: string | null;
  consultation_fee: string;     // decimal string from DRF
  clinic_id: number;
  clinic_name: string;
}

/** Doctor full profile (DoctorDetailSerializer) */
export interface DoctorProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  specialization: string;
  experience_years: number;
  qualifications: string;
  about: string;
  languages_spoken: string[];
  education: Record<string, string>[];
  profile_photo: string | null;
  is_verified: boolean;
  doctor_clinic_id: number | null;
  consultation_fee: number | null;
  average_rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

/** Shape returned by /doctors/clinics/ (ClinicListSerializer) */
export interface ClinicOption {
  id: number;
  name: string;
  address: string;
  is_active: boolean;
  doctor_count: number;
  latitude: number | null;
  longitude: number | null;
}

// ── Invitations ───────────────────────────────────────────────────────────────

export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";

export interface InvitationEntry {
  id: number;
  email: string;
  specialization: string;
  status: InvitationStatus;
  created_at: string;     // ISO datetime
  expires_at: string;     // ISO datetime
}

// ── Patients ──────────────────────────────────────────────────────────────────

export interface Patient {
  id: number;
  email: string;
  phone: string;
  date_of_birth: string | null;   // "YYYY-MM-DD"
  created_at: string;             // ISO datetime
}

// ── Medical Records & Prescriptions ──────────────────────────────────────────

export interface PrescriptionItem {
  id?: number;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions: string;
}

export interface Prescription {
  id: number;
  medical_record: number;
  items: PrescriptionItem[];
  created_at: string;
}

export interface MedicalRecord {
  id: number;
  appointment: number | null;
  patient: number;
  doctor_clinic: number;
  patient_name?: string;
  doctor_name?: string;
  doctor_id?: number;
  symptoms: string;
  diagnosis: string;
  doctor_notes: string;
  private_notes?: string;
  vitals_temperature?: string;
  vitals_blood_pressure?: string;
  prescriptions?: Prescription[];
  created_at: string;
  updated_at: string;
}

export interface PrescriptionTemplate {
  id: number;
  doctor_clinic: number;
  name: string;
  items: PrescriptionItem[];
  created_at: string;
}

// ── Schedules & Leaves ────────────────────────────────────────────────────────

/** Shape returned by DoctorScheduleSerializer */
export interface DoctorSchedule {
  id: number;
  /** write-only on create, but present in read responses via related serializer */
  doctor_clinic_id: number;
  /** 0 = Monday … 6 = Sunday */
  day_of_week: number;
  start_time: string;           // "HH:MM:SS"
  end_time: string;             // "HH:MM:SS"
  slot_duration: number;        // minutes
}

/** Shape returned by DoctorLeaveSerializer */
export interface DoctorLeave {
  id: number;
  doctor_clinic_id: number;
  start_date: string;           // "YYYY-MM-DD"
  end_date: string;             // "YYYY-MM-DD"
  reason: string;
}

// ── Billing ───────────────────────────────────────────────────────────────────

export type InvoiceStatus = "PAID" | "PENDING" | "FAILED";

export interface InvoiceLineItem {
  id: number;
  description: string;
  amount: string;         // decimal string
}

/** Shape returned by /billing/invoices/ */
export interface Invoice {
  id: number;
  patient_name: string;
  patient_email: string;
  appointment_date: string | null;
  appointment_doctor: string | null;
  total_amount: string;           // decimal string
  amount_paid: string;            // decimal string
  status: InvoiceStatus;
  issued_date: string;            // "YYYY-MM-DD"
  due_date: string | null;
  items: InvoiceLineItem[];
}

// ── Notifications ─────────────────────────────────────────────────────────────

/** Shape returned by /notifications/ */
export interface Notification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  related_link: string | null;
  created_at: string;           // ISO datetime
}
