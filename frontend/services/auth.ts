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
};