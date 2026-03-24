"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { getIntakeForm, updateIntakeForm, IntakeFormData } from "@/services/patients";
import { toast } from "react-hot-toast";

export default function IntakeFormPage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = Number(params?.appointmentId);

  const [form, setForm] = useState<IntakeFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!appointmentId) return;
    getIntakeForm(appointmentId)
      .then(setForm)
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load intake form.");
      })
      .finally(() => setLoading(false));
  }, [appointmentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    if (!form.signature_provided) {
      toast.error("Digital signature is required to complete the form.");
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
      toast.success("Intake form submitted successfully!");
      router.push("/dashboard/patient");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to submit form");
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
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Medical Information</CardTitle>
                <CardDescription>Review and easily update your known medical history.</CardDescription>
              </div>
              {form.is_completed && <Badge className="bg-green-500">Completed</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Reported Allergies</Label>
              <Textarea
                placeholder="List any drug or food allergies here..."
                value={form.allergies_update || ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, allergies_update: e.target.value })}
                disabled={form.is_completed}
              />
              <p className="text-xs text-gray-400">Comma-separated values worked best.</p>
            </div>

            <div className="space-y-2">
              <Label>Current Medications</Label>
              <Textarea
                placeholder="List current prescription medications..."
                value={form.current_medications_update || ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, current_medications_update: e.target.value })}
                disabled={form.is_completed}
              />
            </div>

            <div className="space-y-2">
              <Label>Any new notes or concerns?</Label>
              <Textarea
                placeholder="Describe any new symptoms or reasons for the visit..."
                value={form.medical_history_notes || ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, medical_history_notes: e.target.value })}
                disabled={form.is_completed}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Digital Signature</CardTitle>
            <CardDescription>Confirm that the information provided is accurate to the best of your knowledge.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-3">
              <Switch
                id="signature"
                checked={form.signature_provided}
                onCheckedChange={(val: boolean) => setForm({ ...form, signature_provided: val })}
                disabled={form.is_completed}
              />
              <Label htmlFor="signature">I confirm the above information is accurate</Label>
            </div>
          </CardContent>
        </Card>

        {!form.is_completed && (
          <div className="flex justify-end gap-4">
            <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.signature_provided}>
              {saving ? "Submitting..." : "Submit Intake Form"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
