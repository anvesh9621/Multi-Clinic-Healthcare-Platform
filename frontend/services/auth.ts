import api from "./api";

export const login = async (email: string, password: string) => {
  const response = await api.post("/token/", { email, password });

  localStorage.setItem("access", response.data.access);
  localStorage.setItem("refresh", response.data.refresh);
  
  // Immediately attach to default headers so subsequent calls in the same tick work
  api.defaults.headers.common.Authorization = `Bearer ${response.data.access}`;

  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/accounts/me/");
  return response.data;
};

export const logout = () => {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  // Hard redirect to clear React Query cache and AuthContext state
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
};

export const requestPatientOTP = async (email: string, purpose: 'REGISTER' | 'LOGIN') => {
  const response = await api.post("/accounts/patient/otp/request/", { email, purpose });
  return response.data;
};

export const verifyPatientOTP = async (payload: {
  email: string;
  code: string;
  purpose: 'REGISTER' | 'LOGIN';
  first_name?: string;
  last_name?: string;
  phone?: string;
}) => {
  const response = await api.post("/accounts/patient/otp/verify/", payload);
  if (response.data.access) {
    localStorage.setItem("access", response.data.access);
    localStorage.setItem("refresh", response.data.refresh);
    api.defaults.headers.common.Authorization = `Bearer ${response.data.access}`;
  }
  return response.data;
};

export const googleAuthPatient = async (idToken: string) => {
  const response = await api.post("/accounts/patient/google/", { id_token: idToken });
  if (response.data.access) {
    localStorage.setItem("access", response.data.access);
    localStorage.setItem("refresh", response.data.refresh);
    api.defaults.headers.common.Authorization = `Bearer ${response.data.access}`;
  }
  return response.data;
};