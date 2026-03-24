import api from "./api";

export const getSchedules = async () => {
  const res = await api.get("/doctors/schedules/");
  return res.data;
};

export const createSchedule = async (payload: any) => {
  const res = await api.post("/doctors/schedules/", payload);
  return res.data;
};

export const updateSchedule = async (id: number, payload: any) => {
  const res = await api.patch(`/doctors/schedules/${id}/`, payload);
  return res.data;
};

export const deleteSchedule = async (id: number) => {
  const res = await api.delete(`/doctors/schedules/${id}/`);
  return res.data;
};

export const getLeaves = async () => {
  const res = await api.get("/doctors/leaves/");
  return res.data;
};

export const createLeave = async (payload: any) => {
  const res = await api.post("/doctors/leaves/", payload);
  return res.data;
};

export const deleteLeave = async (id: number) => {
  const res = await api.delete(`/doctors/leaves/${id}/`);
  return res.data;
};