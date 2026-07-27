"use client";

import { useState, useContext, useEffect } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Send, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export default function CreateReceptionistPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (user && user.role !== "CLINIC_ADMIN") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await apiClient.post("/clinics/receptionists/create/", {
        email: email.trim().toLowerCase(),
      });
      router.push("/dashboard/admin/receptionists");
    } catch (err: any) {
      const data = err.response?.data;
      const backendErr =
        data?.errors?.email?.[0] ||
        data?.errors?.non_field_errors?.[0] ||
        (typeof data?.errors === "string" ? data.errors : null) ||
        data?.detail ||
        data?.error ||
        "Failed to send receptionist invitation";
      setError(backendErr);
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
          <h1 className="text-2xl font-bold tracking-tight text-ink heading-font">
            Invite Receptionist
          </h1>
          <p className="text-muted text-sm">
            Send an email invitation to your new front-desk staff member
          </p>
        </div>
      </div>

      <Card className="p-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-2.5 text-sm font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-ink mb-2">
              Email Address *
            </label>
            <Input
              type="email"
              name="email"
              icon={<Mail className="w-4 h-4 text-muted" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="receptionist@clinic.com"
            />
            <p className="text-xs text-muted mt-2">
              An invitation link will be sent to this email. The receptionist will set their own password upon accepting.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/dashboard/admin/receptionists">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Invitation
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
