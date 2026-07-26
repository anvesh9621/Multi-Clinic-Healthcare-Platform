"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getMedicalHistory } from "@/services/history";
import { ReviewModal } from "@/components/patient/ReviewModal";

import { MedicalRecord } from "@/types/api";

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
    if (!patientId) {
      setLoading(false);
      return;
    }

    const loadHistory = async () => {

      try {

        const data = await getMedicalHistory(patientId);

        setRecords(data);

      } catch (err) {
        console.error("Failed to load history", err);
        setError("Couldn't load medical history right now.");
      } finally {

        setLoading(false);

      }

    };

    loadHistory();

  }, [patientId, retryCount]);

  if (loading) return <div className="p-6">Loading history...</div>;

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-red-100 shadow-sm text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <button 
          onClick={() => { setLoading(true); setError(null); setRetryCount(r => r + 1); }}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">

      <h1 className="text-2xl font-bold mb-4">Medical History</h1>

      <table className="w-full border">

        <thead className="bg-gray-100">

          <tr>
            <th className="border p-2">Date</th>
            <th className="border p-2">Doctor</th>
            <th className="border p-2">Diagnosis</th>
            <th className="border p-2">Medicines</th>
            <th className="border p-2">Actions</th>
          </tr>

        </thead>

        <tbody>

          {records.map((record) => (

            <tr key={record.id}>

              <td className="border p-2">
                {record.appointment_date}
              </td>

              <td className="border p-2">
                {record.doctor_name}
              </td>

              <td className="border p-2">
                {record.diagnosis}
              </td>

              <td className="border p-2">
                {record.prescriptions.map((p: any, i: number) => (
                  <div key={i}>
                    {p.medicine_name || p.medication_name} ({p.dosage})
                  </div>
                ))}
              </td>

              <td className="border p-2 text-center">
                {record.doctor_id && (
                  <button
                    onClick={() => handleOpenReview(record.doctor_id, record.doctor_name)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Leave Review
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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
