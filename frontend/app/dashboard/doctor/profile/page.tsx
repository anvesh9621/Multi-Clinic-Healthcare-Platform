"use client";

import { useState, useEffect } from "react";
import {
  User, Stethoscope, Award, Globe, BookOpen, Camera, Save,
  Plus, X, ChevronDown, CheckCircle, AlertCircle, Loader2,
} from "lucide-react";
import apiClient from "@/services/api";

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

interface DoctorProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  specialization: string;
  experience_years: number;
  qualifications: string;
  about: string;
  languages_spoken: string[];
  education: { degree: string; institution: string; year: string }[];
  profile_photo: string | null;
  consultation_fee: number | null;
  is_verified: boolean;
}

export default function DoctorProfilePage() {
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [newLang, setNewLang] = useState("");
  const [form, setForm] = useState<Partial<DoctorProfile>>({});

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    apiClient
      .get(`/doctors/profile/`)
      .then((r) => {
        setProfile(r.data.data);
        setForm(r.data.data);
        if (r.data.data.profile_photo) setPhotoPreview(r.data.data.profile_photo);
      })
      .catch(() => showToast("error", "Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const addLanguage = (lang: string) => {
    if (!lang || (form.languages_spoken || []).includes(lang)) return;
    setForm((f) => ({ ...f, languages_spoken: [...(f.languages_spoken || []), lang] }));
    setNewLang("");
  };

  const removeLanguage = (lang: string) => {
    setForm((f) => ({ ...f, languages_spoken: (f.languages_spoken || []).filter((l) => l !== lang) }));
  };

  const addEducation = () => {
    setForm((f) => ({
      ...f,
      education: [...(f.education || []), { degree: "", institution: "", year: "" }],
    }));
  };

  const updateEducation = (i: number, field: string, value: string) => {
    setForm((f) => {
      const edu = [...(f.education || [])];
      edu[i] = { ...edu[i], [field]: value };
      return { ...f, education: edu };
    });
  };

  const removeEducation = (i: number) => {
    setForm((f) => ({ ...f, education: (f.education || []).filter((_, idx) => idx !== i) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (photoFile) {
        const fd = new FormData();
        fd.append("profile_photo", photoFile);
        await apiClient.patch(`/doctors/profile/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      await apiClient.patch(`/doctors/profile/`, {
        first_name: form.first_name,
        last_name: form.last_name,
        specialization: form.specialization,
        experience_years: form.experience_years,
        qualifications: form.qualifications,
        about: form.about,
        languages_spoken: form.languages_spoken,
        education: form.education,
        consultation_fee: form.consultation_fee,
      });

      showToast("success", "Profile updated successfully!");
    } catch {
      showToast("error", "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-sm font-medium transition-all
          ${toast.type === "success" ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300" : "bg-red-500/20 border border-red-500/40 text-red-300"}`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">My Profile</h1>
          <p className="text-gray-500 mt-1">Manage how you appear to patients and staff</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl transition-all shadow-sm"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Photo + Basic */}
        <div className="space-y-6">
          {/* Photo Card */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 text-center">
            <div className="relative inline-block mb-4">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Profile"
                  className="w-28 h-28 rounded-2xl object-cover border-4 border-white shadow-sm"
                />
              ) : (
                <div className="w-28 h-28 rounded-2xl bg-blue-50 border-2 border-dashed border-blue-200 flex items-center justify-center">
                  <User className="w-10 h-10 text-blue-400" />
                </div>
              )}
              <label className="absolute -bottom-2 -right-2 p-2.5 bg-gray-900 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors shadow-md">
                <Camera className="w-4 h-4 text-white" />
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </label>
            </div>
            <p className="text-gray-900 font-bold text-lg">{form.first_name} {form.last_name}</p>
            <p className="text-gray-500 text-sm font-medium">{form.specialization || "Specialist"}</p>
            {profile?.is_verified && (
              <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                <CheckCircle className="w-3.5 h-3.5" /> Verified Profile
              </span>
            )}
          </div>

          {/* Consultation Fee */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
            <label className="block text-sm font-bold text-gray-900 mb-2">Consultation Fee (₹)</label>
            <input
              type="number"
              value={form.consultation_fee || ""}
              onChange={(e) => setForm((f) => ({ ...f, consultation_fee: parseFloat(e.target.value) }))}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
              placeholder="e.g. 500"
            />
          </div>
        </div>

        {/* Right — All Fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Info */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <User className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {(["first_name", "last_name"] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-bold text-gray-900 mb-2 capitalize">{field.replace("_", " ")}</label>
                  <input
                    type="text"
                    value={form[field] || ""}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Email</label>
                <input value={form.email || ""} readOnly className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Experience (Years)</label>
                <input
                  type="number"
                  value={form.experience_years || 0}
                  onChange={(e) => setForm((f) => ({ ...f, experience_years: parseInt(e.target.value) }))}
                  min={0}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Specialization & Qualifications */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <Stethoscope className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Professional Details</h2>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Specialization</label>
                <div className="relative">
                  <select
                    value={form.specialization || ""}
                    onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
                  >
                    <option value="">Select specialization…</option>
                    {SPECIALIZATIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Qualifications</label>
                <input
                  type="text"
                  value={form.qualifications || ""}
                  onChange={(e) => setForm((f) => ({ ...f, qualifications: e.target.value }))}
                  placeholder="e.g. MBBS, MD (Cardiology), DNB"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">About / Bio</label>
                <textarea
                  rows={4}
                  value={form.about || ""}
                  onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
                  placeholder="Describe your practice, approach, and expertise…"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm resize-none"
                />
              </div>
            </div>
          </div>

          {/* Languages */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <Globe className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Languages Spoken</h2>
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              {(form.languages_spoken || []).map((lang) => (
                <span key={lang} className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 border border-gray-200 text-gray-700 font-semibold text-sm rounded-xl">
                  {lang}
                  <button onClick={() => removeLanguage(lang)} className="hover:text-red-500 hover:bg-red-50 p-1 rounded-md transition-colors ml-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <select
                  value={newLang}
                  onChange={(e) => setNewLang(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
                >
                  <option value="">Add a language…</option>
                  {LANGUAGES.filter((l) => !(form.languages_spoken || []).includes(l)).map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
              <button
                onClick={() => addLanguage(newLang)}
                className="px-5 py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-colors shadow-sm whitespace-nowrap"
              >
                 Add
              </button>
            </div>
          </div>

          {/* Education */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                   <BookOpen className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Education</h2>
              </div>
              <button
                onClick={addEducation}
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Entry
              </button>
            </div>
            <div className="space-y-4">
              {(form.education || []).length === 0 && (
                <p className="text-gray-500 font-medium text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">No education entries yet. Click "Add Entry" to add one.</p>
              )}
              {(form.education || []).map((edu, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5 bg-gray-50 border border-gray-200 rounded-xl relative group">
                  <input
                    placeholder="Degree (e.g. MBBS)"
                    value={edu.degree}
                    onChange={(e) => updateEducation(i, "degree", e.target.value)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 font-medium focus:outline-none focus:border-blue-500 transition shadow-sm"
                  />
                  <input
                    placeholder="Institution"
                    value={edu.institution}
                    onChange={(e) => updateEducation(i, "institution", e.target.value)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 font-medium focus:outline-none focus:border-blue-500 transition shadow-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      placeholder="Year"
                      value={edu.year}
                      onChange={(e) => updateEducation(i, "year", e.target.value)}
                      className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 font-medium focus:outline-none focus:border-blue-500 transition shadow-sm"
                    />
                    <button
                      onClick={() => removeEducation(i)}
                      className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 bg-white border border-gray-200 shadow-sm rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Credentials Badge */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 flex items-center gap-5">
            <div className="p-3 bg-white shadow-sm border border-blue-100 rounded-xl shrink-0">
              <Award className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">Profile Verification</p>
              <p className="text-gray-600 font-medium text-sm mt-0.5">
                {profile?.is_verified
                  ? "Your profile is verified by the clinic administration."
                  : "Your profile verification is pending. The clinic admin will verify your credentials."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
