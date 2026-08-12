import api from "./api";
import type { DoctorEntry } from "@/types/api";

export const getDoctors = async (): Promise<DoctorEntry[]> => {
  const response = await api.get<any>("/doctors/");
  return Array.isArray(response.data) ? response.data : (response.data.results || []);
};