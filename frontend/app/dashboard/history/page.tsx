"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getMedicalHistory } from "@/services/history";
import { ReviewModal } from "@/components/patient/ReviewModal";
import { MedicalRecord } from "@/types/api";
import { ClipboardList, Calendar, User, Pill, Star, AlertCircle, FileText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function HistoryPageContent() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId");

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(0);
  const [selectedDoctorName, setSelectedDoctorName] = useState("");

  const handleOpenReview = (doctorId: number, doctorName: string) => {
    setSelectedDoctorId(doctorId);
    setSelectedDoctorName(doctorName);
    setReviewModalOpen(true);
  };

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getMedicalHistory(patientId || undefined);
        setRecords(Array.isArray(data) ? data : data?.results || []);
      } catch (err) {
        console.error("Failed to load history", err);
        setError("Couldn't load medical history right now.");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [patientId, retryCount]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3 text-muted">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium">Loading your medical history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-red-100 shadow-sm text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            setError(null);
            setRetryCount((r) => r + 1);
          }}
          className="px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition shadow-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink flex items-center gap-2.5 heading-font">
          <ClipboardList className="w-6 h-6 text-primary" /> Medical History & Consultations
        </h1>
        <p className="text-sm text-muted mt-1">
          Review your past diagnoses, treatment notes, and doctor prescriptions.
        </p>
      </div>

      {records.length === 0 ? (
        <Card className="p-12 text-center border-border">
          <div className="w-16 h-16 bg-warm-surface rounded-2xl flex items-center justify-center mx-auto mb-4 text-muted">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-ink heading-font mb-1">No medical records yet</h3>
          <p className="text-sm text-muted max-w-md mx-auto">
            Once you complete a consultation with a doctor, your diagnosis notes and prescriptions will appear here.
          </p>
        </Card>
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-warm-surface/60 text-muted font-semibold uppercase tracking-wider text-xs border-b border-border">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Doctor & Clinic</th>
                  <th className="px-6 py-4">Diagnosis</th>
                  <th className="px-6 py-4">Prescriptions</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-warm-surface/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-ink whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted" />
                        <span>{record.appointment_date || "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-ink">{record.doctor_name}</div>
                      {record.clinic_name && (
                        <div className="text-xs text-muted">{record.clinic_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-ink font-medium">{record.diagnosis || "General Consultation"}</p>
                      {record.notes && (
                        <p className="text-xs text-muted mt-0.5 max-w-xs line-clamp-2">{record.notes}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {record.prescriptions && record.prescriptions.length > 0 ? (
                        <div className="space-y-1">
                          {record.prescriptions.map((p: any, i: number) => (
                            <div key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-medium border border-emerald-100 mr-1.5 mb-1">
                              <Pill className="w-3 h-3 text-emerald-600" />
                              <span>
                                {p.medicine_name || p.medication_name || p.name} ({p.dosage || p.frequency || "as prescribed"})
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted italic">No medications prescribed</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {record.doctor_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenReview(record.doctor_id, record.doctor_name)}
                          className="inline-flex items-center gap-1 text-xs"
                        >
                          <Star className="w-3.5 h-3.5 text-amber-500" />
                          <span>Review</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ReviewModal
        doctorId={selectedDoctorId}
        doctorName={selectedDoctorName}
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onSuccess={() => {}}
      />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading history...</div>}>
      <HistoryPageContent />
    </Suspense>
  );
}
