"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
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
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const { data } = await api.get<SubscriptionStatus>("/subscriptions/status/");
      setSubscription(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch subscription");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch for roles that belong to a clinic
    if (userRole && ['CLINIC_ADMIN', 'RECEPTIONIST', 'DOCTOR'].includes(userRole)) {
      fetchSubscription();
    } else {
      setLoading(false);
    }
  }, [userRole]);

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, error, fetchSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
