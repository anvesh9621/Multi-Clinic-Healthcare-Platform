import api from "./api";

export interface PatientSelfRegisterData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  date_of_birth?: string;
  gender?: string;
}

export interface PatientProfileData {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  phone: string;
  date_of_birth: string | null;
  address: string | null;
  emergency_contact: string | null;
  blood_group: string | null;
  allergies: string | null;
  current_medications: string | null;
  profile_completed: boolean;
  created_at: string;
}

export const selfRegisterPatient = async (data: PatientSelfRegisterData) => {
  const response = await api.post("/patients/self-register/", data);
  // Store tokens on success for auto-login
  if (response.data.access) {
    localStorage.setItem("access", response.data.access);
    localStorage.setItem("refresh", response.data.refresh);
  }
  return response.data;
};

export const getPatientProfile = async (): Promise<PatientProfileData> => {
  const response = await api.get("/patients/profile/");
  return response.data.data;
};

export const updatePatientProfile = async (
  data: Partial<PatientProfileData & { password?: string }>
): Promise<PatientProfileData> => {
  const response = await api.patch("/patients/profile/", data);
  return response.data.data;
};

export interface IntakeFormData {
  id: number;
  patient: number;
  appointment: number;
  allergies_update: string | null;
  current_medications_update: string | null;
  medical_history_notes: string | null;
  signature_provided: boolean;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const getIntakeForm = async (appointmentId: number): Promise<IntakeFormData> => {
  const response = await api.get(`/patients/intake-form/${appointmentId}/`);
  return response.data.data;
};

export const updateIntakeForm = async (
  appointmentId: number,
  data: Partial<IntakeFormData>
): Promise<IntakeFormData> => {
  const response = await api.patch(`/patients/intake-form/${appointmentId}/`, data);
  return response.data.data;
};
