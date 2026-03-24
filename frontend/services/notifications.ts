import api from './api';

export interface Notification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  related_link: string | null;
  created_at: string;
}

export const fetchNotifications = async (): Promise<Notification[]> => {
  const response = await api.get('/notifications/');
  return response.data;
};

export const markNotificationAsRead = async (id: number): Promise<void> => {
  await api.patch(`/notifications/${id}/`, { is_read: true });
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  await api.post('/notifications/mark-all-read/');
};
