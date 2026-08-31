"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UserPlus, Mail, Stethoscope, Phone, Globe, Award,
  Search, CheckCircle, Clock, X, Plus, ChevronDown,
  Loader2, AlertCircle, Send, MoreVertical,
} from "lucide-react";
import api from "@/services/api";

import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DoctorEntry {
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
  consultation_fee: string;
  clinic_name: string;
}

interface InvitationEntry {
  id: number;
  email: string;
  specialization: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  created_at: string;
  expires_at: string;
}

interface FormData {
  emails: string;
  specialization: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SPECIALIZATIONS = [
  "General Physician", "Cardiologist", "Dermatologist", "ENT Specialist",
  "Gastroenterologist", "Gynecologist", "Neurologist", "Oncologist",
  "Ophthalmologist", "Orthopedic Surgeon", "Pediatrician", "Psychiatrist",
  "Pulmonologist", "Radiologist", "Rheumatologist", "Urologist",
];

const LANGUAGES = [
  "English", "Hindi", "Marathi", "Bengali", "Tamil", "Telugu",
  "Gujarati", "Kannada", "Malayalam", "Punjabi", "Urdu", "Arabic",
];

const initialForm: FormData = {
  emails: "",
  specialization: "",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDoctorsPage() {
  const [activeTab, setActiveTab] = useState<"doctors" | "invites">("doctors");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { data: doctorsData, isLoading: loadingDoctors, refetch: refetchDoctors } = useQuery({
    queryKey: ["admin_doctors"],
    queryFn: async () => {
      const res = await api.get("/doctors/");
      const data = res.data;
      return (Array.isArray(data) ? data : data.results || []) as DoctorEntry[];
    },
  });

  const { data: invitesList, isLoading: loadingInvites, refetch: refetchInvites } = useQuery({
    queryKey: ["admin_invitations"],
    queryFn: async () => {
      const res = await api.get("/doctors/invitations/");
      return (Array.isArray(res.data) ? res.data : res.data?.results || []) as InvitationEntry[];
    },
  });

  const doctors = doctorsData || [];
  const invites = invitesList || [];
  const loading = activeTab === "doctors" ? loadingDoctors : loadingInvites;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const filteredDoctors = doctors.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.doctor_email.toLowerCase().includes(q) ||
      (d.first_name + " " + d.last_name).toLowerCase().includes(q) ||
      d.specialization.toLowerCase().includes(q)
    );
  });

  const filteredInvites = invites.filter((i) => 
    i.email.toLowerCase().includes(search.toLowerCase()) ||
    i.specialization.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    
    // Parse emails from comma or newline separated string
    const emailArray = form.emails
        .split(/[\n,]/)
        .map(e => e.trim())
        .filter(e => e !== "");

    if (emailArray.length === 0) {
        setError("Please enter at least one email address.");
        setSubmitting(false);
        return;
    }

    try {
      await api.post("/doctors/invitations/create/", {
          emails: emailArray,
          specialization: form.specialization
      });
      setInviteSuccess(emailArray);
      refetchInvites();
      showToast(`${emailArray.length} invitation(s) sent successfully.`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: any } };
      const data = e?.response?.data;
      if (data) {
        if (typeof data === 'string') {
          // Sometimes Django 500 errors return a plain string or HTML string
          // We truncate it as it might be a full HTML traceback
          setError(data.length > 200 ? "Server error occurred. Please try again." : data);
        } else if (data.error && typeof data.error === 'string') {
          setError(data.error);
        } else {
          // Handle standard DRF dictionary errors
          const msg = Object.entries(data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join(" | ");
          setError(msg);
        }
      } else {
        setError("Failed to send invitations. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetModal = () => {
    setShowModal(false);
    setForm(initialForm);
    setError(null);
    setInviteSuccess([]);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] flex items-center gap-3 px-5 py-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl shadow-xl text-sm font-semibold animate-slide-right pointer-events-auto">
          <CheckCircle className="w-5 h-5 shrink-0" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink heading-font">Staff Management</h1>
          <p className="text-muted mt-1 text-sm">Manage your doctors and pending invitations</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <UserPlus className="w-5 h-5 mr-2" />
          Invite Doctors
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-border">
        <button
          onClick={() => setActiveTab("doctors")}
          className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === "doctors" ? "text-primary" : "text-muted hover:text-ink"}`}
        >
          Active Doctors ({doctors.length})
          {activeTab === "doctors" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab("invites")}
          className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === "invites" ? "text-primary" : "text-muted hover:text-ink"}`}
        >
          Sent Invitations ({invites.length})
          {activeTab === "invites" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />}
        </button>
      </div>

      {/* Search */}
      <Input
        icon={<Search className="w-5 h-5 text-muted" />}
        type="text"
        placeholder="Search by name, email, or specialization…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="py-3.5"
      />

      {/* Content Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : activeTab === "doctors" ? (
        filteredDoctors.length === 0 ? (
          <Card className="text-center py-20 text-muted">
            <Stethoscope className="w-12 h-12 mx-auto mb-3 text-muted" />
            <p className="font-semibold text-lg text-ink heading-font">{search ? "No doctors match your search." : "No active doctors yet."}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredDoctors.map((doc) => (
              <DoctorCard key={doc.id} doctor={doc} />
            ))}
          </div>
        )
      ) : (
        /* Invitations List */
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Specialization</TableHead>
              <TableHead>Sent On</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvites.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-muted">
                  {search ? "No invitations match your search." : "No pending invitations."}
                </TableCell>
              </TableRow>
            ) : (
              filteredInvites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-bold text-ink text-sm">{invite.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-ink text-sm">{invite.specialization}</TableCell>
                  <TableCell className="text-muted text-sm">{new Date(invite.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                      invite.status === "PENDING" ? "bg-amber-50 border-amber-200 text-amber-700" :
                      invite.status === "ACCEPTED" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                      "bg-red-50 border-red-200 text-red-700"
                    }`}>
                      {invite.status === "PENDING" && <Clock className="w-3.5 h-3.5" />}
                      {invite.status === "ACCEPTED" && <CheckCircle className="w-3.5 h-3.5" />}
                      {invite.status === "EXPIRED" && <X className="w-3.5 h-3.5" />}
                      {invite.status.charAt(0) + invite.status.slice(1).toLowerCase()}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <Modal isOpen={showModal} onClose={resetModal} title="Invite Doctors">
        {inviteSuccess.length > 0 ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Send className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-2xl font-bold text-ink heading-font">Invitations Sent!</h3>
            <p className="text-muted max-w-sm mx-auto text-sm">
              Sent {inviteSuccess.length} invitation(s) successfully. They will receive a secure link to create their profile.
              <br /><br />
              <span className="text-amber-700 font-semibold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 inline-block text-xs">📋 Check runserver terminal for links</span>
            </p>
            <div className="flex gap-4 justify-center pt-8">
              <Button variant="secondary" onClick={resetModal}>Close</Button>
              <Button onClick={() => { setInviteSuccess([]); setForm(initialForm); setError(null); }}>+ Invite More</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-6">
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-semibold shadow-xs">
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-ink mb-2">Doctor Email Addresses <span className="text-red-500">*</span></label>
              <textarea
                required
                rows={4}
                value={form.emails}
                onChange={(e) => setForm((f) => ({ ...f, emails: e.target.value }))}
                placeholder={"dr.sharma@gmail.com, dr.kapoor@gmail.com\n(Separate with commas or newlines)"}
                className="w-full px-4 py-3 bg-paper border border-border rounded-xl text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition shadow-xs resize-none"
              />
              <p className="text-muted text-xs mt-2">You can enter multiple emails at once.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-ink mb-2">Assigned Specialization <span className="text-red-500">*</span></label>
              <div className="relative">
                <select
                  required
                  value={form.specialization}
                  onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
                  className="w-full px-4 py-3 bg-paper border border-border rounded-xl text-ink appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition shadow-xs"
                >
                  <option value="">Select specialization…</option>
                  {SPECIALIZATIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
              </div>
            </div>

            <div className="flex items-start gap-3 px-5 py-4 bg-primary/10 border border-primary/20 rounded-xl text-ink text-sm shadow-xs">
              <UserPlus className="w-5 h-5 shrink-0 text-primary mt-0.5" />
              <div>
                <strong className="block mb-1 text-ink font-semibold">Streamlined Onboarding</strong>
                <span className="text-muted">Doctors will fill out their own profile details when they accept the invite.</span>
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-border mt-4">
              <Button type="button" variant="secondary" className="flex-1" onClick={resetModal}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin mr-2" />Sending…</>
                ) : (
                  <><Send className="w-5 h-5 mr-2" />Send Invitations</>
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

// ─── Doctor Card ──────────────────────────────────────────────────────────────
function DoctorCard({ doctor }: { doctor: DoctorEntry }) {
  const initials = `${doctor.first_name?.[0] || ""}${doctor.last_name?.[0] || ""}`.toUpperCase() || "DR";

  return (
    <Card hoverable className="p-6 flex flex-col h-full group">
      <div className="flex items-start gap-4 mb-5">
        {doctor.profile_photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={doctor.profile_photo}
            alt={doctor.first_name}
            className="w-14 h-14 rounded-2xl object-cover border border-border shadow-xs"
          />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-primary text-white shadow-xs flex items-center justify-center font-bold text-xl shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="font-bold text-ink text-lg truncate group-hover:text-primary transition-colors heading-font">
            Dr. {doctor.first_name || "New Doctor"} {doctor.last_name || ""}
          </h3>
          <p className="text-primary text-sm font-semibold">{doctor.specialization}</p>
        </div>
      </div>

      <div className="space-y-3 flex-1">
        <div className="flex items-center gap-3 text-muted text-sm">
          <Mail className="w-4 h-4 text-muted/70 shrink-0" />
          <span className="truncate">{doctor.doctor_email}</span>
        </div>
        {doctor.experience_years > 0 && (
          <div className="flex items-center gap-3 text-muted text-sm">
            <Award className="w-4 h-4 text-muted/70 shrink-0" />
            <span className="font-medium text-ink">{doctor.experience_years} year{doctor.experience_years !== 1 ? "s" : ""} experience</span>
          </div>
        )}
        {doctor.qualifications && (
          <div className="flex items-center gap-3 text-muted text-sm">
            <Stethoscope className="w-4 h-4 text-muted/70 shrink-0" />
            <span className="truncate font-medium text-ink">{doctor.qualifications}</span>
          </div>
        )}
        {doctor.languages_spoken?.length > 0 && (
          <div className="flex items-center gap-3 text-muted text-sm">
            <Globe className="w-4 h-4 text-muted/70 shrink-0" />
            <span className="truncate">{doctor.languages_spoken.join(", ")}</span>
          </div>
        )}
      </div>

      <div className="mt-6 pt-5 border-t border-border flex items-center justify-between">
        <div className="text-sm">
          <span className="text-muted font-medium">Consultation Fee: </span>
          <span className="text-ink font-bold text-lg font-mono">₹{doctor.consultation_fee || "0"}</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-bold">
          <CheckCircle className="w-3.5 h-3.5" />
          Active
        </span>
      </div>
    </Card>
  );
}
