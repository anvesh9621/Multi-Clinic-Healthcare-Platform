import api from "./api";

export const createPrescription = async (payload: any) => {

  const res = await api.post("/prescriptions/create/", payload);

  return res.data;
};