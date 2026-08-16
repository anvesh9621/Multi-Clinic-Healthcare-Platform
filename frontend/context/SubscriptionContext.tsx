"use client";

import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";

export interface SubscriptionStatus {
  status: string;
  plan: string;
  trial_end: string | null;
  current_period_end: string | null;
  grace_period_end: string | null;
  show_warning: boolean;
  warning_message: string;
}

interface SubscriptionContextType {
  subscription: SubscriptionStatus | null;
  loading: boolean;
  error: string | null;
  fetchSubscription: () => Promise<void>;
}

export const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  loading: true,
  error: null,
  fetchSubscription: async () => {},
});

export function SubscriptionProvider({ children, userRole }: { children: ReactNode; userRole?: string }) {
  const shouldFetch = Boolean(userRole && ['CLINIC_ADMIN', 'RECEPTIONIST', 'DOCTOR'].includes(userRole));

  const { data: subscription = null, isLoading, error, refetch } = useQuery<SubscriptionStatus | null>({
    queryKey: ['subscription-status', userRole],
    queryFn: async () => {
      const { data } = await api.get<SubscriptionStatus>("/subscriptions/status/");
      return data;
    },
    enabled: shouldFetch,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <SubscriptionContext.Provider
      value={{
        subscription: shouldFetch ? (subscription ?? null) : null,
        loading: shouldFetch ? isLoading : false,
        error: error ? (error as any).message || "Failed to fetch subscription" : null,
        fetchSubscription: async () => {
          await refetch();
        },
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);

