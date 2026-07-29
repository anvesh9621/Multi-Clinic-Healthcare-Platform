"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getPatientProfile,
  updatePatientProfile,
  PatientProfileData,
} from "@/services/patients";
import {
  HeartPulse,
  User,
  Phone,
  Calendar,
  MapPin,
  ShieldAlert,
  Pill,
  Droplets,
  CheckCircle,
  ArrowLeft,
  Save,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FormLegend } from "@/components/ui/FormLegend";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function PatientProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<PatientProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    gender: "",
    phone: "",
    date_of_birth: "",
    address: "",
    emergency_contact: "",
    blood_group: "",
    allergies: "",
    current_medications: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await getPatientProfile();
        setProfile(data);
        setForm({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          gender: data.gender || "",
          phone: data.phone || "",
          date_of_birth: data.date_of_birth || "",
          address: data.address || "",
          emergency_contact: data.emergency_contact || "",
          blood_group: data.blood_group || "",
          allergies: data.allergies || "",
          current_medications: data.current_medications || "",
        });
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSaved(false);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await updatePatientProfile(form);
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-surface/30">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const completionPercent = (() => {
    const fields = [
      form.first_name,
      form.last_name,
      form.phone,
      form.date_of_birth,
      form.gender,
      form.blood_group,
      form.allergies,
      form.current_medications,
      form.emergency_contact,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  })();

  const selectClass = "w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-warm-surface text-ink text-sm font-medium transition shadow-sm";
  const textareaClass = "w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-warm-surface text-ink text-sm font-medium transition shadow-sm resize-none";

  return (
    <div className="min-h-screen bg-warm-surface/30">
      {/* Header */}
      <header className="bg-paper border-b border-border sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center gap-4 h-16">
          <Link href="/dashboard/patient" className="p-2 hover:bg-warm-surface rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-ink text-lg heading-font">My Profile</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Profile completion card */}
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-ink text-lg heading-font">Profile Completion</h2>
              <p className="text-sm text-muted">Fill in your medical details so doctors can better care for you</p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-primary font-mono">{completionPercent}%</span>
            </div>
          </div>
          <div className="w-full bg-warm-surface rounded-full h-3">
            <div
              className="bg-primary h-3 rounded-full transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          {profile?.profile_completed && (
            <div className="mt-3 flex items-center gap-2 text-emerald-600 font-medium text-sm">
              <CheckCircle className="w-4 h-4" />
              Your medical profile is complete!
            </div>
          )}
        </Card>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold">
            {error}
          </div>
        )}
        {saved && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Profile updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormLegend />

          {/* Personal Information */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-ink heading-font">Personal Information</h3>
                <p className="text-xs text-muted">Basic details about you</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">
                  First Name <span className="text-red-500 ml-1" aria-hidden="true">*</span>
                </label>
                <Input
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="First name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">
                  Last Name <span className="text-red-500 ml-1" aria-hidden="true">*</span>
                </label>
                <Input
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="Last name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">Gender</label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className={selectClass}
                >
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">
                  <Calendar className="inline w-4 h-4 mr-1 text-muted" />Date of Birth
                </label>
                <Input
                  type="date"
                  name="date_of_birth"
                  value={form.date_of_birth}
                  onChange={handleChange}
                />
              </div>
            </div>
          </Card>

          {/* Contact Information */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
                <Phone className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-ink heading-font">Contact & Address</h3>
                <p className="text-xs text-muted">How we can reach you</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">
                  Phone Number <span className="text-red-500 ml-1" aria-hidden="true">*</span>
                </label>
                <Input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91 9876543210"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">Emergency Contact</label>
                <Input
                  type="tel"
                  name="emergency_contact"
                  value={form.emergency_contact}
                  onChange={handleChange}
                  placeholder="+91 9876543210"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-ink mb-2">
                  <MapPin className="inline w-4 h-4 mr-1 text-muted" /> Address
                </label>
                <Input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="123, Street, City, State"
                />
              </div>
            </div>
          </Card>

          {/* Medical Profile */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <HeartPulse className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="font-bold text-ink heading-font">Medical Profile</h3>
                <p className="text-xs text-muted">Critical health information for your doctors</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">
                  <Droplets className="inline w-4 h-4 mr-1 text-rose-500" /> Blood Group
                </label>
                <select
                  name="blood_group"
                  value={form.blood_group}
                  onChange={handleChange}
                  className={selectClass}
                >
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5">
              <label className="block text-sm font-semibold text-ink mb-2">
                <ShieldAlert className="inline w-4 h-4 mr-1 text-amber-600" /> Known Allergies
              </label>
              <textarea
                name="allergies"
                value={form.allergies}
                onChange={handleChange}
                rows={3}
                className={textareaClass}
                placeholder="e.g. Penicillin, Peanuts, Dust mites..."
              />
              <p className="text-xs text-muted mt-1">Separate multiple allergies with commas</p>
            </div>

            <div className="mt-5">
              <label className="block text-sm font-semibold text-ink mb-2">
                <Pill className="inline w-4 h-4 mr-1 text-purple-600" /> Current Medications
              </label>
              <textarea
                name="current_medications"
                value={form.current_medications}
                onChange={handleChange}
                rows={3}
                className={textareaClass}
                placeholder="e.g. Metformin 500mg, Vitamin D3..."
              />
              <p className="text-xs text-muted mt-1">Separate multiple medications with commas</p>
            </div>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <Link href="/dashboard/patient">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" /> Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
