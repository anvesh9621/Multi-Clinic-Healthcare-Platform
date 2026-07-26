import api from "./api";
import type {
  ClinicDashboardStats,
  DoctorWorkloadEntry,
  AppointmentTrendEntry,
  SuperAdminData,
} from "@/types/api";

export const getDashboardStats = async (): Promise<ClinicDashboardStats> => {
  const response = await api.get<{ success: boolean; data: ClinicDashboardStats }>(
    "/analytics/dashboard/"
  );
  return response.data.data;
};

export const getDoctorWorkload = async (): Promise<DoctorWorkloadEntry[]> => {
  const response = await api.get<{ success: boolean; data: DoctorWorkloadEntry[] }>(
    "/analytics/doctor-workload/"
  );
  return response.data.data;
};

export const getAppointmentTrend = async (): Promise<AppointmentTrendEntry[]> => {
  const response = await api.get<{ success: boolean; data: AppointmentTrendEntry[] }>(
    "/analytics/appointment-trend/"
  );
  return response.data.data;
};

export const getSuperAdminStats = async (): Promise<SuperAdminData> => {
  const response = await api.get<{ success: boolean; data: SuperAdminData }>(
    "/analytics/super-admin/"
  );
  return response.data.data;
};