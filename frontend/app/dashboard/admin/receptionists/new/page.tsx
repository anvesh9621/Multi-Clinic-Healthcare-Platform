"use client";

import { useState, useContext, useEffect } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, Mail, Lock, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export default function CreateReceptionistPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  useEffect(() => {
    if (user && user.role !== "CLINIC_ADMIN") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await apiClient.post("/clinics/receptionists/create/", formData);
      alert("Receptionist created successfully!");
      router.push(`/dashboard/admin/receptionists`);
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.errors?.email?.[0] || 
        err.response?.data?.detail || 
        "Failed to create receptionist"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/admin/receptionists">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5 text-muted" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink heading-font">Create New Receptionist</h1>
          <p className="text-muted text-sm">Add front-desk staff to your clinic</p>
        </div>
      </div>

      <Card className="p-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-2 text-sm font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-ink mb-2">Email Address *</label>
            <Input
              type="email"
              name="email"
              icon={<Mail className="w-4 h-4 text-muted" />}
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="receptionist@clinic.com"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-ink mb-2">Temporary Password *</label>
            <Input
              type="password"
              name="password"
              icon={<Lock className="w-4 h-4 text-muted" />}
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            {loading ? "Creating Account..." : "Create Receptionist Account"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
