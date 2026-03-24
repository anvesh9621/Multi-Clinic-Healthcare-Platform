import api from "./api";

export const createMedicalRecord = async (payload: any) => {

  const res = await api.post("/records/create/", payload);

  return res.data;
};