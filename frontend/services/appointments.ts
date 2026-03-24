import api from "./api";

export const getAppointments = async () => {
  const response = await api.get("/appointments/");
  return response.data;
};

export const getAppointmentById = async (id: number) => {
  const response = await api.get(`/appointments/${id}/`);
  return response.data;
};

export const updateAppointmentStatus = async (
  appointmentId: number,
  status: string
) => {
  const response = await api.patch(`/appointments/${appointmentId}/status/`, {
    status,
  });
  return response.data;
};

export const generateMeetingLink = async (appointmentId: number): Promise<string> => {
  const response = await api.post(`/appointments/${appointmentId}/meeting-link/`);
  return response.data.meeting_link;
};