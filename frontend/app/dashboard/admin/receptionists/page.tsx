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

  const canInvite = !activeReceptionist && !pendingInvite;

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      await apiClient.post("/clinics/receptionists/create/", {
        email: email.trim().toLowerCase(),
      });
      setSuccessMessage(`Invitation sent to ${email.trim()}. They will receive an email to accept and set their password.`);
      setEmail("");
      await fetchData();
    } catch (err: any) {
      console.error(err);
      const backendErr =
        err.response?.data?.errors?.non_field_errors?.[0] ||
        err.response?.data?.errors?.email?.[0] ||
        err.response?.data?.error ||
        "Failed to send invitation. Please try again.";
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

      {/* Primary Action / Status Banner Card */}
      <Card className="p-6 sm:p-8 space-y-6">
        {/* Status: Active Receptionist */}
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
                Each clinic is limited to <strong>1 assigned Receptionist</strong>. Your clinic currently has an active receptionist registered.
              </span>
            </div>
          </div>
        )}

        {/* Status: Pending Invite */}
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
                      <Clock className="w-3 h-3" /> Invitation Pending
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Invite sent on {new Date(pendingInvite.created_at).toLocaleDateString()} • Expires on {new Date(pendingInvite.expires_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-muted flex items-start gap-2.5">
              <MailCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                An invitation email was sent to <strong>{pendingInvite.email}</strong>. They will set their password upon accepting. Only 1 receptionist assignment is permitted at a time.
              </span>
            </div>
          </div>
        )}

        {/* Status: Available to Invite */}
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
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
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
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
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
              </TableRow>
            ))}

            {receptionists.length === 0 && invitations.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-muted">
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
