import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import React from 'react';
import SuperAdminDashboard from '@/app/dashboard/super-admin/page';
import { AuthContext } from '@/context/AuthContext';
import apiClient from '@/services/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock recharts ResponsiveContainer
vi.mock('recharts', async () => {
  const OriginalModule = await vi.importActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: any) => <div style={{ width: '100%', height: '100%' }}>{children}</div>,
  };
});

describe('SuperAdminDashboard Tab Separation & Lazy Loading', () => {
  let queryClient: QueryClient;

  beforeAll(() => {
    // Mock IntersectionObserver for Framer Motion in JSDOM
    global.IntersectionObserver = class IntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;

    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const mockSuperAdmin = {
    id: 1,
    email: 'admin@platform.com',
    role: 'SUPER_ADMIN',
    first_name: 'Platform',
    last_name: 'Admin',
  };

  it('renders Overview tab initially and loads /analytics/super-admin/ without loading payments or clinics', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url.includes('/analytics/super-admin/clinics/')) {
        return { data: { count: 0, next: null, previous: null, results: [] } };
      }
      if (url.includes('/analytics/super-admin/')) {
        return {
          data: {
            success: true,
            data: {
              total_clinics: 12,
              active_clinics: 10,
              total_users: 150,
              total_appointments: 500,
              appointments_today: 25,
              total_revenue_paid: 250000,
              trend_data: [{ date: 'Aug 15', revenue: 10000, appointments: 5 }],
              recent_logs: [],
            },
          },
        };
      }
      if (url.includes('/analytics/payment-metrics/')) {
        return {
          data: {
            success: true,
            data: {
              days: 30,
              overall_success_rate: 98.5,
              total_attempts: 100,
              total_successful: 98,
              total_failed: 2,
              total_reconciliation_catches: 1,
              total_refunds: 0,
              total_refund_amount: 0,
              snapshots: [],
            },
          },
        };
      }
      return { data: {} };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ user: mockSuperAdmin, setUser: vi.fn(), loading: false }}>
          <SuperAdminDashboard />
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    // Initial Overview tab load
    await waitFor(() => {
      expect(screen.getByText('Platform Overview')).toBeInTheDocument();
      expect(screen.getByText('Active Clinics')).toBeInTheDocument();
    });

    // Verify /analytics/super-admin/ was requested
    expect(apiClient.get).toHaveBeenCalledWith('/analytics/super-admin/');
    // Verify payments and clinics endpoints were NOT requested initially
    expect(apiClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/analytics/payment-metrics/'));
    expect(apiClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/analytics/super-admin/clinics/'));

    // Switch to Clinics tab (Tenants)
    const clinicsTab = screen.getByRole('button', { name: /tenants/i });
    fireEvent.click(clinicsTab);

    // Verify /analytics/super-admin/clinics/ is requested lazily on tab activation
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/analytics/super-admin/clinics/'));
    });

    // Switch to Payments tab
    const paymentsTab = screen.getByRole('button', { name: /payment health/i });
    fireEvent.click(paymentsTab);

    // Verify /analytics/payment-metrics/ is requested lazily on tab activation
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/analytics/payment-metrics/'));
    });
  });
});
