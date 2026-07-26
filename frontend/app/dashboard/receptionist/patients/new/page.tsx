"use client";

import { useState, useContext, useEffect } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { useRouter } from "next/navigation";
import { UserPlus, AlertCircle, Mail, Lock, Phone, Calendar, MapPin, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export default function RegisterPatientPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    phone: "",
    date_of_birth: "",
    address: "",
    emergency_contact: "",
  });

  useEffect(() => {
    if (user && user.role !== "RECEPTIONIST" && user.role !== "CLINIC_ADMIN") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const resp = await apiClient.post("/patients/register/", formData);
      alert("Patient registered successfully!");
      // Redirect to the booking page with the new patient selected
      router.push(`/dashboard/receptionist/book?patientId=${resp.data.patient_id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || err.response?.data?.email?.[0] || "Failed to register patient");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-8">
      <Card className="p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink heading-font mb-2">Register New Patient</h1>
          <p className="text-muted text-sm mb-6">Create a profile for a new patient to book consultations.</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex gap-2 items-center text-sm font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-ink mb-2">Email Address *</label>
              <Input
                type="email"
                name="email"
                icon={<Mail className="w-4 h-4" />}
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="patient@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-ink mb-2">Temporary Password *</label>
              <Input
                type="password"
                name="password"
                icon={<Lock className="w-4 h-4" />}
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-ink mb-2">Phone Number *</label>
              <Input
                type="text"
                name="phone"
                icon={<Phone className="w-4 h-4" />}
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="+91 9876543210"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-ink mb-2">Date of Birth</label>
              <Input
                type="date"
                name="date_of_birth"
                icon={<Calendar className="w-4 h-4" />}
                value={formData.date_of_birth}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-ink mb-2">Emergency Contact</label>
            <Input
              type="text"
              name="emergency_contact"
              icon={<UserCheck className="w-4 h-4" />}
              value={formData.emergency_contact}
              onChange={handleChange}
              placeholder="Name & Contact number"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-ink mb-2">Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-warm-surface border border-border rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition shadow-sm resize-none"
              rows={3}
              placeholder="Full street address..."
            ></textarea>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full py-3"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {loading ? "Registering..." : "Register Patient"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
