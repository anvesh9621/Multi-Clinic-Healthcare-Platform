"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/services/api";

export default function RecordPage() {

  const { id } = useParams();

  const [record, setRecord] = useState<any>(null);

  useEffect(() => {

    const fetchRecord = async () => {
        try {
            const res = await api.get(`/records/consultation/${id}/`);
            setRecord(res.data);
        } catch (error) {
            alert("Medical record not available yet.");
        }
    };

    fetchRecord();

  }, []);

  if (!record) return <div className="p-6">Loading record...</div>;

  return (
    <div className="p-6 space-y-4">

      <h1 className="text-2xl font-bold">Medical Record</h1>

      <div>
        <strong>Diagnosis:</strong> {record.diagnosis}
      </div>

      <div>
        <strong>Notes:</strong> {record.doctor_notes || "None"}
      </div>

      <div>
        <strong>Prescriptions:</strong>

        {record.prescriptions && record.prescriptions.length > 0 ? (
          record.prescriptions.map((p: any, i: number) => (
            <div key={i} className="mt-2 text-sm border-l-2 border-blue-200 pl-3">
              {p.items?.map((item: any, j: number) => (
                <div key={j} className="mb-1">
                  <span className="font-semibold text-gray-800">{item.medicine_name}</span>{" "}
                  <span className="text-gray-600">({item.dosage})</span> — {item.frequency} for {item.duration_days} days.
                  {item.instructions && <div className="text-gray-500 text-xs mt-0.5">Instructions: {item.instructions}</div>}
                </div>
              ))}
            </div>
          ))
        ) : (
          <span className="text-gray-500 ml-2">No prescriptions added.</span>
        )}
      </div>

    </div>
  );
}