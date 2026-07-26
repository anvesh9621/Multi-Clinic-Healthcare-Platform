import api from "./api";
import type { DoctorEntry } from "@/types/api";

export const getDoctors = async (): Promise<DoctorEntry[]> => {
  const response = await api.get<DoctorEntry[]>("/doctors/");
  return response.data;
};