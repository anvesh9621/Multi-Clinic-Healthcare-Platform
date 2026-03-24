import api from "./api";

export const getDashboardStats = async () => {
  const response = await api.get("/analytics/dashboard/");
  return response.data.data;
};

export const getDoctorWorkload = async () => {
  const response = await api.get("/analytics/doctor-workload/");
  return response.data.data;
};

export const getAppointmentTrend = async () => {
  const response = await api.get("/analytics/appointment-trend/");
  return response.data.data;
};