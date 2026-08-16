"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/services/notifications';
import type { Notification } from '@/types/api';

interface NotificationContextProps {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  refetch: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, refetch } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => markNotificationAsRead(id),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData<Notification[]>(['notifications']);
      queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
        old ? old.map((n) => (n.id === id ? { ...n, is_read: true } : n)) : []
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notifications'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData<Notification[]>(['notifications']);
      queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
        old ? old.map((n) => ({ ...n, is_read: true })) : []
      );
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notifications'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading: isLoading,
        refetch: async () => {
          await refetch();
        },
        markAsRead: async (id: number) => {
          await markAsReadMutation.mutateAsync(id);
        },
        markAllAsRead: async () => {
          await markAllAsReadMutation.mutateAsync();
        },
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

