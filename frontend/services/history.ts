import api from "./api";

export const getMedicalHistory = async (patientId: string | number) => {
  const res = await api.get(`/records/history/patient/${patientId}/`);
  return res.data;
};