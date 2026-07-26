import api from "./api";
import type { Appointment, ClinicOption } from "@/types/api";

/** Shape returned by /doctors/?clinic_id=X */
export interface BookableDoctorClinic {
  id: number;
  doctor_email: string;
  first_name: string;
  last_name: string;
  specialization: string;
  bio: string;
  consultation_fee: number;
  clinic_id: number;
  clinic_name: string;
}

export interface BookingPayload {
  doctor_clinic_id: number;
  appointment_date: string;   // "YYYY-MM-DD"
  start_time: string;         // "HH:MM:SS"
  end_time: string;           // "HH:MM:SS"
  reason?: string;
}

export interface ReceptionistBookingPayload extends BookingPayload {
  patient_id: number;
}

export const getClinics = async (): Promise<ClinicOption[]> => {
  const response = await api.get<ClinicOption[]>("/doctors/clinics/");
  return response.data;
};

export const getDoctorsByClinic = async (
  clinicId: number
): Promise<BookableDoctorClinic[]> => {
  const response = await api.get<BookableDoctorClinic[]>(
    `/doctors/?clinic_id=${clinicId}`
  );
  return response.data;
};

export const getAvailableSlots = async (
  doctorClinicId: number,
  date: string
): Promise<string[]> => {
  const response = await api.get<{ available_slots: string[] }>(
    `/appointments/slots/?doctor_clinic_id=${doctorClinicId}&date=${date}`
  );
  return response.data.available_slots;
};

export const bookAppointment = async (
  payload: BookingPayload
): Promise<Appointment> => {
  const response = await api.post<Appointment>("/appointments/book/", payload);
  return response.data;
};

export const receptionistBookAppointment = async (
  payload: ReceptionistBookingPayload
): Promise<Appointment> => {
  const response = await api.post<Appointment>(
    "/appointments/receptionist/book/",
    payload
  );
  return response.data;
};