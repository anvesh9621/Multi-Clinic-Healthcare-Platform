"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getIntakeForm, updateIntakeForm, IntakeFormData } from "@/services/patients";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";

export default function IntakeFormPage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = Number(params?.appointmentId);
  const { success, error } = useToast();

  const [form, setForm] = useState<IntakeFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!appointmentId) return;
    getIntakeForm(appointmentId)
      .then(setForm)
      .catch((err) => {
        console.error(err);
        error("Failed to load intake form.");
      })
      .finally(() => setLoading(false));
  }, [appointmentId, error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    if (!form.signature_provided) {
      error("Digital signature is required to complete the form.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateIntakeForm(appointmentId, {
        allergies_update: form.allergies_update,
        current_medications_update: form.current_medications_update,
        medical_history_notes: form.medical_history_notes,
        signature_provided: form.signature_provided,
      });
      setForm(updated);
      success("Intake form submitted successfully!");
      router.push("/dashboard/patient");
    } catch (err: any) {
      error(err?.response?.data?.detail || "Failed to submit form");
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

  if (!form) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="p-12 text-center text-muted">
          <FileText className="w-12 h-12 mx-auto mb-3 text-muted" />
          Intake form not found.
        </Card>
      </div>
    );
  }

  const textareaClass = "w-full min-h-[90px] rounded-xl border border-border bg-warm-surface px-4 py-3 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 transition shadow-sm resize-none";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink heading-font mb-2">Pre-Appointment Intake Form</h1>
        <p className="text-muted">
          Please fill out this form before your visit to save time in the clinic.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-border pb-4">
            <div>
              <h2 className="text-lg font-bold text-ink heading-font">Medical Information</h2>
              <p className="text-sm text-muted mt-1">Review and easily update your known medical history.</p>
            </div>
            {form.is_completed && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Completed
              </span>
            )}
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-ink">Reported Allergies</label>
              <textarea
                className={textareaClass}
                placeholder="List any drug or food allergies here..."
                value={form.allergies_update || ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, allergies_update: e.target.value })}
                disabled={form.is_completed}
              />
              <p className="text-xs text-muted">Separate multiple allergies with commas.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-ink">Current Medications</label>
              <textarea
                className={textareaClass}
                placeholder="List current prescription medications..."
                value={form.current_medications_update || ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, current_medications_update: e.target.value })}
                disabled={form.is_completed}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-ink">Any new notes or concerns?</label>
              <textarea
                className={textareaClass}
                placeholder="Describe any new symptoms or reasons for the visit..."
                value={form.medical_history_notes || ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, medical_history_notes: e.target.value })}
                disabled={form.is_completed}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="border-b border-border pb-3">
            <h2 className="text-lg font-bold text-ink heading-font">Digital Signature</h2>
            <p className="text-sm text-muted mt-1">Confirm that the information provided is accurate to the best of your knowledge.</p>
          </div>
          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                id="signature"
                className="w-5 h-5 text-primary rounded border-border focus:ring-primary/20"
                checked={form.signature_provided}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, signature_provided: e.target.checked })}
                disabled={form.is_completed}
              />
              <span className="text-sm font-semibold text-ink">I confirm the above information is accurate</span>
            </label>
          </div>
        </Card>

        {!form.is_completed && (
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.signature_provided}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
                </>
              ) : (
                "Submit Intake Form"
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
