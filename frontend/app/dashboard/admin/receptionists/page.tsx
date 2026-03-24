"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ReceptionistsListPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [receptionists, setReceptionists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== "CLINIC_ADMIN") {
      router.push("/dashboard");
      return;
    }

    const fetchReceptionists = async () => {
      try {
        const response = await apiClient.get("/clinics/receptionists/");
        setReceptionists(response.data.results || response.data);
      } catch (error) {
        console.error("Error fetching receptionists:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReceptionists();
  }, [user, router]);

  if (loading) return <div className="p-6">Loading receptionists...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Manage Receptionists</h1>
          <p className="text-gray-500 mt-1">View and add front-desk staff for your clinic</p>
        </div>
        <Link href="/dashboard/admin/receptionists/new">
          <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-sm whitespace-nowrap">
            + Add Receptionist
          </button>
        </Link>
      </div>

      <div className="bg-white shadow-sm overflow-hidden rounded-2xl border border-gray-100">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {receptionists.map((rec) => (
              <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {rec.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {rec.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(rec.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {receptionists.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                  No receptionists registered in this clinic.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
