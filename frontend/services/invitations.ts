import api from "./api";

export const getAdminInvites = async () => {
  const res = await api.get("/doctors/invitations/");
  return res.data;
};

export const sendInvites = async (payload: { emails: string[]; specialization: string }) => {
  const res = await api.post("/doctors/invitations/create/", payload);
  return res.data;
};

export const checkInviteToken = async (token: string) => {
  const res = await api.get(`/doctors/invitations/status/${token}/`);
  return res.data;
};

export const acceptInvite = async (payload: any) => {
  const res = await api.post("/doctors/invite/accept/", payload);
  return res.data;
};
