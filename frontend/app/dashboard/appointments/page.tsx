"use client";

import { useEffect, useState, useContext } from "react";
import { getAppointments, updateAppointmentStatus } from "@/services/appointments";
import { AuthContext } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function AppointmentsPage() {

  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { user } = useContext(AuthContext);

  const router = useRouter();

  const fetchAppointments = async () => {
    try {
      const data = await getAppointments();
      setAppointments(data);
    } catch {
      console.error("Failed to fetch appointments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await updateAppointmentStatus(id, status);
      fetchAppointments();
    } catch {
      alert("Failed to update status");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: any = {
      SCHEDULED: "bg-yellow-200 text-yellow-800",
      CONFIRMED: "bg-green-200 text-green-800",
      COMPLETED: "bg-blue-200 text-blue-800",
      CANCELLED: "bg-red-200 text-red-800",
      NO_SHOW: "bg-gray-200 text-gray-800",
    };

    return (
      <span className={`px-2 py-1 rounded text-sm ${styles[status]}`}>
        {status}
      </span>
    );
  };

  if (loading) return <div className="p-6">Loading appointments...</div>;

  return (
    <div className="p-6">

      <h1 className="text-2xl font-bold mb-4">Appointments</h1>

      <table className="w-full border">

        <thead className="bg-gray-100">

          <tr>
            <th className="border p-2">Date</th>
            <th className="border p-2">Start</th>
            <th className="border p-2">End</th>
            <th className="border p-2">Doctor</th>
            <th className="border p-2">Status</th>
            <th className="border p-2">Actions</th>
          </tr>

        </thead>

        <tbody>

          {appointments.map((appt) => (

            <tr key={appt.id}>

              <td className="border p-2">{appt.appointment_date}</td>
              <td className="border p-2">{appt.start_time}</td>
              <td className="border p-2">{appt.end_time}</td>
              <td className="border p-2">{appt.doctor_name}</td>
              <td className="border p-2">{getStatusBadge(appt.status)}</td>

              <td className="border p-2 space-x-2">

                {/* PATIENT CANCEL */}

                {user.role === "PATIENT" && appt.status === "SCHEDULED" && (
                  <button
                    className="bg-red-500 text-white px-2 py-1 rounded"
                    onClick={() =>
                      handleStatusChange(appt.id, "CANCELLED")
                    }
                  >
                    Cancel
                  </button>
                )}

                {/* DOCTOR CONFIRM */}

                {user.role === "DOCTOR" && appt.status === "SCHEDULED" && (
                  <button
                    className="bg-green-500 text-white px-2 py-1 rounded"
                    onClick={() =>
                      handleStatusChange(appt.id, "CONFIRMED")
                    }
                  >
                    Confirm
                  </button>
                )}

                {/* DOCTOR COMPLETE */}

                {user.role === "DOCTOR" && appt.status === "CONFIRMED" && (
                  <button
                    className="bg-blue-500 text-white px-2 py-1 rounded"
                    onClick={() =>
                      handleStatusChange(appt.id, "COMPLETED")
                    }
                  >
                    Complete
                  </button>
                )}

                {/* DOCTOR CONSULT */}

                {user.role === "DOCTOR" && appt.status === "COMPLETED" && (
                  <button
                    className="bg-purple-500 text-white px-2 py-1 rounded"
                    onClick={() =>
                      router.push(`/dashboard/appointments/${appt.id}/consult`)
                    }
                  >
                    Consult
                  </button>
                )}

                {/* PATIENT VIEW RECORDS */}
                {user.role === "PATIENT" && appt.status === "COMPLETED" && (
                  <button
                    className="bg-indigo-500 text-white px-2 py-1 rounded"
                    onClick={() =>
                      router.push(`/dashboard/appointments/${appt.id}/record`)
                    }
                  >
                    View Record
                  </button>
                )}


              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}
