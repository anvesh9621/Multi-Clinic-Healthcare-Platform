"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/services/api";
import { createMedicalRecord } from "@/services/records";
import { createPrescription } from "@/services/prescriptions";

export default function ConsultPage() {

  const { id } = useParams();
  const router = useRouter();

  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");

  const [medicines, setMedicines] = useState<Record<string, string>[]>([
    { medication_name: "", dosage: "", instructions: "" }
  ]);

  const [recordExists, setRecordExists] = useState(false);
  const [loading, setLoading] = useState(true);

  // 🔹 Check if record already exists
  const checkRecord = async () => {
    try {
      await api.get(`/records/${id}/`);
      setRecordExists(true);
    } catch {
      setRecordExists(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkRecord();
  }, []);

  const addMedicine = () => {
    setMedicines([
      ...medicines,
      { medication_name: "", dosage: "", instructions: "" }
    ]);
  };

  const updateMedicine = (index: number, field: string, value: string) => {
    const updated = [...medicines];
    updated[index][field] = value;
    setMedicines(updated);
  };

  const handleSubmit = async () => {
    try {

      const record = await createMedicalRecord({
        appointment: Number(id),
        diagnosis,
        notes
      });

      for (const med of medicines) {

        if (!med.medication_name) continue;

        await createPrescription({
          medical_record: record.id,
          medication_name: med.medication_name,
          dosage: med.dosage,
          instructions: med.instructions
        });

      }

      alert("Medical record saved");

      router.push("/dashboard/appointments");

    } catch {
      alert("Failed to save medical record");
    }
  };

  if (loading) {
    return <div className="p-6">Checking consultation status...</div>;
  }

  // 🔴 If record already exists
  if (recordExists) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">
          Medical Record Already Exists
        </h1>

        <button
          onClick={() =>
            router.push(`/dashboard/appointments/${id}/record`)
          }
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          View Record
        </button>
      </div>
    );
  }

  // 🟢 Consultation Form
  return (
    <div className="p-6 max-w-xl space-y-6">

      <h1 className="text-2xl font-bold">Consultation</h1>

      <div>
        <label>Diagnosis</label>
        <input
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          className="border p-2 w-full"
        />
      </div>

      <div>
        <label>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="border p-2 w-full"
        />
      </div>

      <div>
        <h2 className="font-semibold mb-2">Prescriptions</h2>

        {medicines.map((med, i) => (
          <div key={i} className="space-y-2 mb-4">

            <input
              placeholder="Medicine name"
              className="border p-2 w-full"
              onChange={(e) =>
                updateMedicine(i, "medication_name", e.target.value)
              }
            />

            <input
              placeholder="Dosage"
              className="border p-2 w-full"
              onChange={(e) =>
                updateMedicine(i, "dosage", e.target.value)
              }
            />

            <input
              placeholder="Instructions"
              className="border p-2 w-full"
              onChange={(e) =>
                updateMedicine(i, "instructions", e.target.value)
              }
            />

          </div>
        ))}

        <button
          onClick={addMedicine}
          className="bg-gray-200 px-3 py-1 rounded"
        >
          + Add Medicine
        </button>
      </div>

      <button
        onClick={handleSubmit}
        className="bg-green-500 text-white px-4 py-2 rounded"
      >
        Save Record
      </button>

    </div>
  );
}