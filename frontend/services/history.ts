import api from "./api";

export const getMedicalHistory = async (patientId?: string | number) => {
  const url = patientId ? `/records/history/patient/${patientId}/` : `/records/history/patient/me/`;
  const res = await api.get(url);
  return Array.isArray(res.data) ? res.data : (res.data?.results || []);
};