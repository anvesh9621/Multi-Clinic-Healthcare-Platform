import api from "./api";
import type { Appointment } from "@/types/api";

export const getAppointments = async (): Promise<Appointment[]> => {
  const response = await api.get<any>("/appointments/");
  return Array.isArray(response.data) ? response.data : (response.data.results || []);
};

export const getAppointmentById = async (id: number): Promise<Appointment> => {
  const response = await api.get<Appointment>(`/appointments/${id}/`);
  return response.data;
};

export const updateAppointmentStatus = async (
  appointmentId: number,
  status: string
): Promise<Appointment> => {
  const response = await api.patch<Appointment>(
    `/appointments/${appointmentId}/status/`,
    { status }
  );
  return response.data;
};

export const generateMeetingLink = async (appointmentId: number): Promise<string> => {
  const response = await api.post<{ meeting_link: string }>(
    `/appointments/${appointmentId}/meeting-link/`
  );
  return response.data.meeting_link;
};