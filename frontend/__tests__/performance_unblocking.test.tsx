import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardLayout from '@/app/dashboard/layout';
import { AuthContext } from '@/context/AuthContext';
import React from 'react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/dashboard',
}));

// Mock SubscriptionContext & NotificationContext
vi.mock('@/context/SubscriptionContext', () => ({
  SubscriptionProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="subscription-provider">{children}</div>,
  useSubscription: () => ({ subscription: null, loading: false }),
}));

vi.mock('@/context/NotificationContext', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="notification-provider">{children}</div>,
}));

vi.mock('@/components/ui/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

function createFakeJwt(payload: Record<string, any>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesignature`;
}

describe('DashboardLayout Token Unblocking & Performance Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('unblocks initial render when token is present in localStorage, rendering nav & children before user profile loads', () => {
    const fakeToken = createFakeJwt({
      role: 'DOCTOR',
      user_id: 12,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    localStorage.setItem('access', fakeToken);

    // AuthContext still in loading state (user profile fetch in flight)
    render(
      <AuthContext.Provider value={{ user: null, setUser: vi.fn(), loading: true }}>
        <DashboardLayout>
          <div data-testid="dashboard-child-content">Doctor Dashboard Content</div>
        </DashboardLayout>
      </AuthContext.Provider>
    );

    // Sidebar with Doctor navigation and Children must be rendered immediately
    expect(screen.getByTestId('dashboard-child-content')).toBeInTheDocument();
    expect(screen.getByText('MediClinic')).toBeInTheDocument();
    expect(screen.getByText('Live Queue')).toBeInTheDocument();
    expect(screen.getByText('Schedule & Leaves')).toBeInTheDocument();
    expect(screen.getByText('Loading profile...')).toBeInTheDocument();
  });

  it('shows PageLoader when loading and no token exists in localStorage', () => {
    localStorage.removeItem('access');

    const { container } = render(
      <AuthContext.Provider value={{ user: null, setUser: vi.fn(), loading: true }}>
        <DashboardLayout>
          <div data-testid="dashboard-child-content">Hidden Content</div>
        </DashboardLayout>
      </AuthContext.Provider>
    );

    expect(screen.queryByTestId('dashboard-child-content')).not.toBeInTheDocument();
    expect(screen.queryByText('MediClinic')).not.toBeInTheDocument();
    // Skeleton loader pulse is rendered
    expect(container.querySelector('.animate-pulse') || container.querySelector('.bg-gray-100')).toBeDefined();
  });
});
