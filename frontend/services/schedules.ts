import api from "./api";
import type { DoctorSchedule, DoctorLeave } from "@/types/api";

export interface CreateSchedulePayload {
  doctor_clinic_id: number;
  day_of_week: number;
  start_time: string;   // "HH:MM"
  end_time: string;     // "HH:MM"
  slot_duration: number;
}

export interface CreateLeavePayload {
  doctor_clinic_id: number;
  start_date: string;   // "YYYY-MM-DD"
  end_date: string;     // "YYYY-MM-DD"
  reason?: string;
}

export const getSchedules = async (): Promise<DoctorSchedule[]> => {
  const res = await api.get<any>("/doctors/schedules/");
  return Array.isArray(res.data) ? res.data : (res.data.results || []);
};

export const createSchedule = async (
  payload: CreateSchedulePayload
): Promise<DoctorSchedule> => {
  const res = await api.post<DoctorSchedule>("/doctors/schedules/", payload);
  return res.data;
};

export const updateSchedule = async (
  id: number,
  payload: Partial<CreateSchedulePayload>
): Promise<DoctorSchedule> => {
  const res = await api.patch<DoctorSchedule>(`/doctors/schedules/${id}/`, payload);
  return res.data;
};

export const deleteSchedule = async (id: number): Promise<void> => {
  await api.delete(`/doctors/schedules/${id}/`);
};

export const getLeaves = async (): Promise<DoctorLeave[]> => {
  const res = await api.get<any>("/doctors/leaves/");
  return Array.isArray(res.data) ? res.data : (res.data.results || []);
};

export const createLeave = async (
  payload: CreateLeavePayload
): Promise<DoctorLeave> => {
  const res = await api.post<DoctorLeave>("/doctors/leaves/", payload);
  return res.data;
};

export const deleteLeave = async (id: number): Promise<void> => {
  await api.delete(`/doctors/leaves/${id}/`);
};