import api from './api';
import type { Notification } from '@/types/api';

export const fetchNotifications = async (): Promise<Notification[]> => {
  const response = await api.get<any>('/notifications/');
  return Array.isArray(response.data) ? response.data : (response.data.results || []);
};

export const markNotificationAsRead = async (id: number): Promise<void> => {
  await api.patch(`/notifications/${id}/`, { is_read: true });
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  await api.post('/notifications/mark-all-read/');
};
