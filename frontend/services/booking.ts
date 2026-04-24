import api from "./api";

export interface Clinic {
  id: number;
  name: string;
  address: string;
  doctor_count: number;
  latitude: number | null;
  longitude: number | null;
}

export interface DoctorClinic {
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
  appointment_date: string;
  start_time: string;
  end_time: string;
  reason?: string;
}

export const getClinics = async (): Promise<Clinic[]> => {
  const response = await api.get("/doctors/clinics/");
  return response.data;
};

export const getDoctorsByClinic = async (clinicId: number): Promise<DoctorClinic[]> => {
  const response = await api.get(`/doctors/?clinic_id=${clinicId}`);
  return response.data;
};

export const getAvailableSlots = async (
  doctorClinicId: number,
  date: string
): Promise<string[]> => {
  const response = await api.get(
    `/appointments/slots/?doctor_clinic_id=${doctorClinicId}&date=${date}`
  );
  return response.data.available_slots;
};

export const bookAppointment = async (payload: BookingPayload) => {
  const response = await api.post("/appointments/book/", payload);
  return response.data;
};

export const receptionistBookAppointment = async (payload: any) => {
  const response = await api.post("/appointments/receptionist/book/", payload);
  return response.data;
};