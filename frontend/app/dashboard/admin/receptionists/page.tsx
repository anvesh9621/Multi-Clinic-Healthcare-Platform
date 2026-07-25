"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink heading-font">Manage Receptionists</h1>
          <p className="text-muted mt-1">View and add front-desk staff for your clinic</p>
        </div>
        <Link href="/dashboard/admin/receptionists/new">
          <Button className="whitespace-nowrap">
            <UserPlus className="w-4 h-4 mr-2" /> Add Receptionist
          </Button>
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Joined Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receptionists.map((rec) => (
            <TableRow key={rec.id}>
              <TableCell className="font-bold">{rec.id}</TableCell>
              <TableCell>{rec.email}</TableCell>
              <TableCell>{new Date(rec.created_at).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
          {receptionists.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-12 text-center text-muted">
                No receptionists registered in this clinic.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
