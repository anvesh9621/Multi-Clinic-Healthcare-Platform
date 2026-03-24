"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UserPlus, Mail, Stethoscope, Phone, Globe, Award,
  Search, CheckCircle, Clock, X, Plus, ChevronDown,
  Loader2, AlertCircle, Send, MoreVertical,
} from "lucide-react";
import api from "@/services/api";

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

  const [doctors, setDoctors] = useState<DoctorEntry[]>([]);
  const [invitesList, setInvitesList] = useState<InvitationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "doctors") {
         const res = await api.get("/doctors/");
         const data = res.data;
         setDoctors(Array.isArray(data) ? data : data.results || []);
      } else {
         const res = await api.get("/doctors/invitations/");
         setInvitesList(res.data);
      }
    } catch {
      if (activeTab === "doctors") setDoctors([]);
      else setInvitesList([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredDoctors = doctors.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.doctor_email.toLowerCase().includes(q) ||
      (d.first_name + " " + d.last_name).toLowerCase().includes(q) ||
      d.specialization.toLowerCase().includes(q)
    );
  });

  const filteredInvites = invitesList.filter((i) => 
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
      fetchData();
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
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Staff Management</h1>
          <p className="text-gray-500 mt-1">Manage your doctors and pending invitations</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-sm whitespace-nowrap"
        >
          <UserPlus className="w-5 h-5" />
          Invite Doctors
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("doctors")}
          className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === "doctors" ? "text-blue-600" : "text-gray-500 hover:text-gray-900"}`}
        >
          Active Doctors ({doctors.length})
          {activeTab === "doctors" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab("invites")}
          className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === "invites" ? "text-blue-600" : "text-gray-500 hover:text-gray-900"}`}
        >
          Sent Invitations ({invitesList.length})
          {activeTab === "invites" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, or specialization…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
        />
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : activeTab === "doctors" ? (
        filteredDoctors.length === 0 ? (
          <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl shadow-sm text-gray-500">
            <Stethoscope className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-semibold text-lg text-gray-900">{search ? "No doctors match your search." : "No active doctors yet."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredDoctors.map((doc) => (
              <DoctorCard key={doc.id} doctor={doc} />
            ))}
          </div>
        )
      ) : (
        /* Invitations List */
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-xs uppercase font-bold text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Specialization</th>
                <th className="px-6 py-4">Sent On</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredInvites.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 font-medium">
                    {search ? "No invitations match your search." : "No pending invitations."}
                  </td>
                </tr>
              ) : (
                filteredInvites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                        <Mail className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="font-bold text-gray-900 text-base">{invite.email}</span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-700">{invite.specialization}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(invite.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                        invite.status === "PENDING" ? "bg-amber-50 border-amber-200 text-amber-700" :
                        invite.status === "ACCEPTED" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                        "bg-red-50 border-red-200 text-red-700"
                      }`}>
                        {invite.status === "PENDING" && <Clock className="w-3.5 h-3.5" />}
                        {invite.status === "ACCEPTED" && <CheckCircle className="w-3.5 h-3.5" />}
                        {invite.status === "EXPIRED" && <X className="w-3.5 h-3.5" />}
                        {invite.status.charAt(0) + invite.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Doctor Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-8 py-5 flex items-center justify-between rounded-t-3xl z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Invite Doctors</h2>
                <p className="text-gray-500 text-sm mt-0.5">Send bulk email invitations</p>
              </div>
              <button onClick={resetModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {inviteSuccess.length > 0 ? (
              /* ✅ Success state */
              <div className="p-10 text-center space-y-4">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Send className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Invitations Sent!</h3>
                <p className="text-gray-600 max-w-sm mx-auto">
                  Sent {inviteSuccess.length} invitation(s) successfully. They will receive a secure link to create their profile.
                  <br /><br />
                  <span className="text-amber-600 font-semibold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200inline-block">📋 Check runserver terminal for links</span>
                </p>
                <div className="flex gap-4 justify-center pt-8">
                  <button onClick={resetModal} className="px-6 py-3 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-colors font-bold shadow-sm">
                    Close
                  </button>
                  <button
                    onClick={() => { setInviteSuccess([]); setForm(initialForm); setError(null); }}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-bold shadow-sm"
                  >
                    + Invite More
                  </button>
                </div>
              </div>
            ) : (
              /* ─ Form ─ */
              <form onSubmit={handleCreate} className="p-8 space-y-6">
                {error && (
                  <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-semibold shadow-sm">
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                {/* Emails */}
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Doctor Email Addresses <span className="text-red-500">*</span></label>
                  <textarea
                    required
                    rows={4}
                    value={form.emails}
                    onChange={(e) => setForm((f) => ({ ...f, emails: e.target.value }))}
                    placeholder="dr.sharma@gmail.com, dr.kapoor@gmail.com&#10;(Separate with commas or newlines)"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm resize-none"
                  />
                  <p className="text-gray-500 text-sm mt-2">You can enter multiple emails at once.</p>
                </div>

                {/* Specialization */}
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Assigned Specialization <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select
                      required
                      value={form.specialization}
                      onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
                    >
                      <option value="">Select specialization…</option>
                      {SPECIALIZATIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                  </div>
                </div>

                {/* Info banner */}
                <div className="flex items-start gap-3 px-5 py-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 shadow-sm">
                  <UserPlus className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    <strong className="block mb-1 text-blue-900">Streamlined Onboarding</strong>
                    Doctors will fill out their own profile details (Name, Experience, Fees) when they accept the invite.
                  </div>
                </div>

                {/* Footer */}
                <div className="flex gap-4 pt-6 border-t border-gray-100 mt-8">
                  <button
                    type="button"
                    onClick={resetModal}
                    className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-colors font-bold shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    {submitting ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Sending Invites…</>
                    ) : (
                      <><Send className="w-5 h-5" /> Send Invitations</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Doctor Card ──────────────────────────────────────────────────────────────
function DoctorCard({ doctor }: { doctor: DoctorEntry }) {
  const initials = `${doctor.first_name?.[0] || ""}${doctor.last_name?.[0] || ""}`.toUpperCase() || "DR";
  const AVATAR_COLORS = [
    "from-blue-600 to-indigo-600",
    "from-purple-600 to-fuchsia-600",
    "from-emerald-600 to-teal-600",
    "from-rose-600 to-pink-600",
    "from-amber-500 to-orange-500",
  ];
  const colorClass = AVATAR_COLORS[doctor.id % AVATAR_COLORS.length];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:border-blue-100 transition-all group flex flex-col h-full">
      <div className="flex items-start gap-4 mb-5">
        {doctor.profile_photo ? (
          <img
            src={doctor.profile_photo}
            alt={doctor.first_name}
            className="w-14 h-14 rounded-2xl object-cover border border-gray-200 shadow-sm"
          />
        ) : (
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${colorClass} shadow-sm flex items-center justify-center text-white font-bold text-xl shrink-0`}>
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="font-bold text-gray-900 text-lg truncate group-hover:text-blue-600 transition-colors">
            Dr. {doctor.first_name || "New Doctor"} {doctor.last_name || ""}
          </h3>
          <p className="text-blue-600 text-sm font-semibold">{doctor.specialization}</p>
        </div>
      </div>

      <div className="space-y-3 flex-1">
        <div className="flex items-center gap-3 text-gray-600 text-sm">
          <Mail className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="truncate">{doctor.doctor_email}</span>
        </div>
        {doctor.experience_years > 0 && (
          <div className="flex items-center gap-3 text-gray-600 text-sm">
            <Award className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="font-medium">{doctor.experience_years} year{doctor.experience_years !== 1 ? "s" : ""} experience</span>
          </div>
        )}
        {doctor.qualifications && (
          <div className="flex items-center gap-3 text-gray-600 text-sm">
            <Stethoscope className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="truncate font-medium">{doctor.qualifications}</span>
          </div>
        )}
        {doctor.languages_spoken?.length > 0 && (
          <div className="flex items-center gap-3 text-gray-600 text-sm">
            <Globe className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="truncate text-gray-500">{doctor.languages_spoken.join(", ")}</span>
          </div>
        )}
      </div>

      <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between">
        <div className="text-sm">
          <span className="text-gray-500 font-medium">Consultation Fee: </span>
          <span className="text-gray-900 font-bold text-lg">₹{doctor.consultation_fee || "0"}</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full font-bold">
          <CheckCircle className="w-3.5 h-3.5" />
          Active
        </span>
      </div>
    </div>
  );
}
