"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getMedicalHistory } from "@/services/history";
import { ReviewModal } from "@/components/patient/ReviewModal";

function HistoryPageContent() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId");

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

      } catch {

        console.error("Failed to load history");

      } finally {

        setLoading(false);

      }

    };

    loadHistory();

  }, [patientId]);

  if (loading) return <div className="p-6">Loading history...</div>;

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
