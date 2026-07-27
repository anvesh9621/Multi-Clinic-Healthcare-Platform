"use client";

import { useEffect, useState, useContext, useCallback } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { useRouter } from "next/navigation";
import {
  Mail,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  MailCheck,
  XCircle,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { ReceptionistUser, ReceptionistInvitation } from "@/types/api";

export default function ReceptionistsListPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();

  const [receptionists, setReceptionists] = useState<ReceptionistUser[]>([]);
  const [invitations, setInvitations] = useState<ReceptionistInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite Form State
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [recRes, invRes] = await Promise.allSettled([
        apiClient.get("/clinics/receptionists/"),
        apiClient.get("/clinics/receptionists/invitations/"),
      ]);

      if (recRes.status === "fulfilled") {
        setReceptionists(recRes.value.data.results || recRes.value.data || []);
      }
      if (invRes.status === "fulfilled") {
        setInvitations(invRes.value.data.results || invRes.value.data || []);
      }
    } catch (err) {
      console.error("Error fetching receptionist data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role !== "CLINIC_ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetchData();
  }, [user, router, fetchData]);

  const activeReceptionist = receptionists.length > 0 ? receptionists[0] : null;
  const pendingInvite = invitations.find(
    (i) => i.status === "PENDING" && new Date(i.expires_at) > new Date()
  );
  const expiredOrCancelledInvite = !activeReceptionist && !pendingInvite && invitations.length > 0 ? invitations[0] : null;

  const canInvite = !activeReceptionist && !pendingInvite;

  const getRemainingHours = (expiresAtStr: string) => {
    const expiresAt = new Date(expiresAtStr).getTime();
    const now = new Date().getTime();
    const diffMs = expiresAt - now;
    if (diffMs <= 0) return "Expired";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const extractErrorMessage = (err: any): string => {
    if (!err?.response?.data) {
      return err?.message || "Failed to send invitation. Please try again.";
    }
    const data = err.response.data;

    if (data.errors) {
      if (typeof data.errors === "string") return data.errors;
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        return typeof data.errors[0] === "string" ? data.errors[0] : JSON.stringify(data.errors[0]);
      }
      if (typeof data.errors === "object") {
        if (data.errors.email) {
          return Array.isArray(data.errors.email) ? data.errors.email[0] : data.errors.email;
        }
        if (data.errors.non_field_errors) {
          return Array.isArray(data.errors.non_field_errors) ? data.errors.non_field_errors[0] : data.errors.non_field_errors;
        }
        const firstKey = Object.keys(data.errors)[0];
        if (firstKey && data.errors[firstKey]) {
          const val = data.errors[firstKey];
          return Array.isArray(val) ? val[0] : val;
        }
      }
    }

    if (data.detail) return data.detail;
    if (data.error) return data.error;
    if (data.message) return data.message;

    return "Failed to send invitation. Please try again.";
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    await sendInviteRequest(email.trim().toLowerCase());
  };

  const sendInviteRequest = async (targetEmail: string) => {
    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      await apiClient.post("/clinics/receptionists/create/", {
        email: targetEmail.toLowerCase(),
      });
      setSuccessMessage(`Invitation link sent to ${targetEmail}. They will receive an email to set their password.`);
      setEmail("");
      await fetchData();
    } catch (err: any) {
      const backendErr = extractErrorMessage(err);
      setError(backendErr);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink heading-font">
          Manage Receptionist
        </h1>
        <p className="text-muted mt-1">
          Invite and manage front-desk staff for your clinic
        </p>
      </div>

      {/* Main Status & Action Card */}
      <Card className="p-6 sm:p-8 space-y-6">
        {/* State 1: Active Receptionist */}
        {activeReceptionist && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink text-base">
                      {activeReceptionist.email}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Active Receptionist
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Joined on {new Date(activeReceptionist.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-muted flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>
                Your clinic receptionist slot is <strong>filled and active</strong>. Each clinic is limited to 1 assigned Receptionist.
              </span>
            </div>
          </div>
        )}

        {/* State 2: Pending Invitation */}
        {!activeReceptionist && pendingInvite && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-amber-50/80 border border-amber-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink text-base">
                      {pendingInvite.email}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Invitation Pending ({getRemainingHours(pendingInvite.expires_at)})
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Sent on {new Date(pendingInvite.created_at).toLocaleDateString()} • Expires on {new Date(pendingInvite.expires_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-muted flex items-start gap-2.5">
              <MailCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                An invitation email is currently active for <strong>{pendingInvite.email}</strong>. They will set their password upon accepting.
              </span>
            </div>
          </div>
        )}

        {/* State 3: Expired / Cancelled Invitation (Shows Resend Banner + Form) */}
        {!activeReceptionist && !pendingInvite && expiredOrCancelledInvite && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-ink">
                  Previous Invite to {expiredOrCancelledInvite.email} ({expiredOrCancelledInvite.status.toLowerCase()})
                </p>
                <p className="text-xs text-muted">
                  {expiredOrCancelledInvite.status === "EXPIRED" ? "Invitation expired. You can resend a new invitation link below." : "Invitation was cancelled."}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => sendInviteRequest(expiredOrCancelledInvite.email)}
              className="whitespace-nowrap"
            >

              <RotateCw className="w-3.5 h-3.5 mr-1.5" />
              Resend Invite
            </Button>
          </div>
        )}

        {/* State 4: Available to Invite Form */}
        {canInvite && (
          <div className="space-y-6">
            <div className="border-b border-border/60 pb-4">
              <h2 className="text-lg font-bold text-ink heading-font flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" /> Invite Receptionist
              </h2>
              <p className="text-sm text-muted mt-0.5">
                Send an email invitation link. The receptionist will set their own password upon accepting.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-2.5 text-sm font-semibold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {successMessage && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-2.5 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-bold text-ink mb-2">
                  Receptionist Email Address *
                </label>
                <Input
                  type="email"
                  required
                  placeholder="receptionist@clinic.com"
                  icon={<Mail className="w-4 h-4 text-muted" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="whitespace-nowrap h-11 px-6"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Invitation
              </Button>
            </form>
          </div>
        )}
      </Card>

      {/* Staff & Invitation History Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-ink heading-font">
          Receptionist & Invitation History
        </h2>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient Email</TableHead>
              <TableHead>Type / Role</TableHead>
              <TableHead>Date Sent / Joined</TableHead>
              <TableHead>Status & Expiration</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Active User row */}
            {receptionists.map((rec) => (
              <TableRow key={`user-${rec.id}`}>
                <TableCell className="font-bold text-ink">{rec.email}</TableCell>
                <TableCell className="text-muted">Assigned Receptionist</TableCell>
                <TableCell className="text-muted">
                  {new Date(rec.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                </TableCell>
                <TableCell className="text-right text-xs text-muted italic">
                  Active Member
                </TableCell>
              </TableRow>
            ))}

            {/* Invitations rows */}
            {invitations.map((inv) => (
              <TableRow key={`inv-${inv.id}`}>
                <TableCell className="font-bold text-ink">{inv.email}</TableCell>
                <TableCell className="text-muted">Email Invitation</TableCell>
                <TableCell className="text-muted">
                  {new Date(inv.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {inv.status === "PENDING" && (
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3" /> Pending ({getRemainingHours(inv.expires_at)})
                      </span>
                    </div>
                  )}
                  {inv.status === "ACCEPTED" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> Accepted
                    </span>
                  )}
                  {inv.status === "EXPIRED" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      <Clock className="w-3 h-3 text-slate-400" /> Expired
                    </span>
                  )}
                  {inv.status === "CANCELLED" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                      <XCircle className="w-3 h-3" /> Cancelled
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!activeReceptionist && (inv.status === "EXPIRED" || inv.status === "CANCELLED") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={submitting}
                      onClick={() => sendInviteRequest(inv.email)}
                      className="text-xs font-semibold"
                    >
                      <RotateCw className="w-3 h-3 mr-1" /> Resend
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}

            {receptionists.length === 0 && invitations.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted">
                  No receptionist staff or invitations found for this clinic.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
