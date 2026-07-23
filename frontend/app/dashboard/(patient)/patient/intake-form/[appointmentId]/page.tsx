"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getIntakeForm, updateIntakeForm, IntakeFormData } from "@/services/patients";
import { useToast } from "@/context/ToastContext";

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
  }, [appointmentId]);

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
    return <div className="p-6">Loading intake form...</div>;
  }

  if (!form) {
    return <div className="p-6">Form not found.</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">Pre-Appointment Intake Form</h1>
        <p className="text-gray-500">
          Please fill out this form before your visit to save time in the clinic.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold leading-none tracking-tight">Medical Information</h3>
                <p className="text-sm text-gray-500 mt-1.5">Review and easily update your known medical history.</p>
              </div>
              {form.is_completed && <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500 text-white">Completed</span>}
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none opacity-70">Reported Allergies</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="List any drug or food allergies here..."
                value={form.allergies_update || ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, allergies_update: e.target.value })}
                disabled={form.is_completed}
              />
              <p className="text-xs text-gray-400">Comma-separated values worked best.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none opacity-70">Current Medications</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="List current prescription medications..."
                value={form.current_medications_update || ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, current_medications_update: e.target.value })}
                disabled={form.is_completed}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none opacity-70">Any new notes or concerns?</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Describe any new symptoms or reasons for the visit..."
                value={form.medical_history_notes || ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, medical_history_notes: e.target.value })}
                disabled={form.is_completed}
              />
            </div>
          </div>
        </div>

        <div className="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold leading-none tracking-tight">Digital Signature</h3>
            <p className="text-sm text-gray-500 mt-1.5">Confirm that the information provided is accurate to the best of your knowledge.</p>
          </div>
          <div className="p-6">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="signature"
                className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                checked={form.signature_provided}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, signature_provided: e.target.checked })}
                disabled={form.is_completed}
              />
              <label htmlFor="signature" className="text-sm font-medium leading-none">I confirm the above information is accurate</label>
            </div>
          </div>
        </div>

        {!form.is_completed && (
          <div className="flex justify-end gap-4">
            <button 
              type="button" 
              onClick={() => router.back()}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 border border-gray-200 bg-white hover:bg-gray-100 hover:text-gray-900 h-10 px-4 py-2"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving || !form.signature_provided}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? "Submitting..." : "Submit Intake Form"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
