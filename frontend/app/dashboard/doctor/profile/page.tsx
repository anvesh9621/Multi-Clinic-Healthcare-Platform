"use client";

import { useState, useEffect } from "react";
import {
  User, Stethoscope, Award, Globe, BookOpen, Camera, Save,
  Plus, X, ChevronDown, CheckCircle, AlertCircle, Loader2,
} from "lucide-react";
import apiClient from "@/services/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FormLegend } from "@/components/ui/FormLegend";

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
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectClass = "w-full px-4 py-3 bg-warm-surface border border-border rounded-xl text-ink appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition shadow-sm font-medium";
  const textareaClass = "w-full px-4 py-3 bg-warm-surface border border-border rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition shadow-sm resize-none font-medium";

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-sm font-semibold transition-all
          ${toast.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink tracking-tight heading-font">My Profile</h1>
          <p className="text-muted mt-1">Manage how you appear to patients and staff</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Photo + Basic */}
        <div className="space-y-6">
          {/* Photo Card */}
          <Card className="p-6 text-center">
            <div className="relative inline-block mb-4">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Profile"
                  className="w-28 h-28 rounded-2xl object-cover border-4 border-paper shadow-sm"
                />
              ) : (
                <div className="w-28 h-28 rounded-2xl bg-primary/10 border-2 border-dashed border-primary/30 flex items-center justify-center">
                  <User className="w-10 h-10 text-primary" />
                </div>
              )}
              <label className="absolute -bottom-2 -right-2 p-2.5 bg-ink text-paper rounded-xl cursor-pointer hover:bg-ink/80 transition-colors shadow-md">
                <Camera className="w-4 h-4 text-paper" />
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </label>
            </div>
            <p className="text-ink font-bold text-lg heading-font">{form.first_name} {form.last_name}</p>
            <p className="text-muted text-sm font-medium">{form.specialization || "Specialist"}</p>
            {profile?.is_verified && (
              <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-full">
                <CheckCircle className="w-3.5 h-3.5" /> Verified Profile
              </span>
            )}
          </Card>

          {/* Consultation Fee */}
          <Card className="p-6">
            <label className="block text-sm font-bold text-ink mb-2">Consultation Fee (₹)</label>
            <Input
              type="number"
              value={form.consultation_fee || ""}
              onChange={(e) => setForm((f) => ({ ...f, consultation_fee: parseFloat(e.target.value) }))}
              placeholder="e.g. 500"
            />
          </Card>
        </div>

        {/* Right — All Fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Info */}
          <Card className="p-6">
            <FormLegend />
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <User className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-ink heading-font">Personal Information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-ink mb-2">
                  First Name <span className="text-red-500 ml-1" aria-hidden="true">*</span>
                </label>
                <Input
                  type="text"
                  value={form.first_name || ""}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink mb-2">
                  Last Name <span className="text-red-500 ml-1" aria-hidden="true">*</span>
                </label>
                <Input
                  type="text"
                  value={form.last_name || ""}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink mb-2">Email</label>
                <Input value={form.email || ""} readOnly className="opacity-70 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink mb-2">Experience (Years)</label>
                <Input
                  type="number"
                  value={form.experience_years || 0}
                  onChange={(e) => setForm((f) => ({ ...f, experience_years: parseInt(e.target.value) }))}
                  min={0}
                />
              </div>
            </div>
          </Card>

          {/* Specialization & Qualifications */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-accent/10 rounded-lg text-accent">
                <Stethoscope className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-ink heading-font">Professional Details</h2>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-ink mb-2">
                  Specialization <span className="text-red-500 ml-1" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <select
                    value={form.specialization || ""}
                    onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
                    className={selectClass}
                    required
                  >
                    <option value="">Select specialization…</option>
                    {SPECIALIZATIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-ink mb-2">Qualifications</label>
                <Input
                  type="text"
                  value={form.qualifications || ""}
                  onChange={(e) => setForm((f) => ({ ...f, qualifications: e.target.value }))}
                  placeholder="e.g. MBBS, MD (Cardiology), DNB"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink mb-2">About / Bio</label>
                <textarea
                  rows={4}
                  value={form.about || ""}
                  onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
                  placeholder="Describe your practice, approach, and expertise…"
                  className={textareaClass}
                />
              </div>
            </div>
          </Card>

          {/* Languages */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-800">
                <Globe className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-ink heading-font">Languages Spoken</h2>
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              {(form.languages_spoken || []).map((lang) => (
                <span key={lang} className="flex items-center gap-1.5 px-3 py-1.5 bg-warm-surface border border-border text-ink font-semibold text-sm rounded-xl">
                  {lang}
                  <button onClick={() => removeLanguage(lang)} className="hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition-colors ml-1">
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
                  className={selectClass}
                >
                  <option value="">Add a language…</option>
                  {LANGUAGES.filter((l) => !(form.languages_spoken || []).includes(l)).map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
              </div>
              <Button onClick={() => addLanguage(newLang)}>
                Add
              </Button>
            </div>
          </Card>

          {/* Education */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-800">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-ink heading-font">Education</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={addEducation} className="text-primary font-bold">
                <Plus className="w-4 h-4 mr-1" /> Add Entry
              </Button>
            </div>
            <div className="space-y-4">
              {(form.education || []).length === 0 && (
                <p className="text-muted font-medium text-center py-6 border-2 border-dashed border-border rounded-xl">No education entries yet. Click "Add Entry" to add one.</p>
              )}
              {(form.education || []).map((edu, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-warm-surface border border-border rounded-xl relative group">
                  <Input
                    placeholder="Degree (e.g. MBBS)"
                    value={edu.degree}
                    onChange={(e) => updateEducation(i, "degree", e.target.value)}
                  />
                  <Input
                    placeholder="Institution"
                    value={edu.institution}
                    onChange={(e) => updateEducation(i, "institution", e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Year"
                      value={edu.year}
                      onChange={(e) => updateEducation(i, "year", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEducation(i)}
                      className="text-muted hover:text-rose-600 border border-border bg-paper"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Credentials Badge */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-center gap-5">
            <div className="p-3 bg-paper shadow-sm border border-primary/20 rounded-xl shrink-0">
              <Award className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-bold text-ink text-lg heading-font">Profile Verification</p>
              <p className="text-muted font-medium text-sm mt-0.5">
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
