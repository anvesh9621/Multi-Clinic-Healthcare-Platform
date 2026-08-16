import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { PatientAuthForm } from '@/components/patient/PatientAuthForm';
import { AuthContext } from '@/context/AuthContext';
import * as authService from '@/services/auth';

// Mock next/navigation
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock auth services
vi.mock('@/services/auth', () => ({
  login: vi.fn(),
  getCurrentUser: vi.fn(),
  requestPatientOTP: vi.fn(),
  verifyPatientOTP: vi.fn(),
  googleAuthPatient: vi.fn(),
}));

describe('PatientAuthForm Distinct Login & Register Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('(a) LOGIN with a nonexistent email shows the "create an account" CTA and does NOT advance to OTP entry', async () => {
    vi.mocked(authService.requestPatientOTP).mockRejectedValueOnce({
      response: {
        data: {
          error: 'No account found with this email address. Please register first.',
        },
      },
    });

    render(
      <AuthContext.Provider value={{ user: null, setUser: vi.fn(), loading: false }}>
        <PatientAuthForm initialPurpose="LOGIN" />
      </AuthContext.Provider>
    );

    // Initial screen headers
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back');
    expect(screen.getByText(/sign in to your patient account/i)).toBeInTheDocument();

    // Fill email and submit
    const emailInput = screen.getByPlaceholderText('you@example.com');
    fireEvent.change(emailInput, { target: { value: 'nonexistent@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /continue with email otp/i });
    fireEvent.click(submitBtn);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText(/no account found with this email address/i)).toBeInTheDocument();
    });

    // Check CTA link
    const ctaLink = screen.getByRole('link', { name: /no account found\. create an account instead →/i });
    expect(ctaLink).toBeInTheDocument();
    expect(ctaLink).toHaveAttribute('href', '/register?email=nonexistent%40example.com');

    // Confirm form did NOT advance to Step 2 (OTP code input is NOT present)
    expect(screen.queryByPlaceholderText('123456')).not.toBeInTheDocument();
    // Confirm authService was called once with LOGIN purpose
    expect(authService.requestPatientOTP).toHaveBeenCalledWith('nonexistent@example.com', 'LOGIN');
    expect(authService.requestPatientOTP).toHaveBeenCalledTimes(1);
  });

  it('(b) REGISTER with an existing email shows the "log in instead" CTA and does NOT advance to OTP entry', async () => {
    vi.mocked(authService.requestPatientOTP).mockRejectedValueOnce({
      response: {
        data: {
          error: 'An account with this email already exists. Please log in instead.',
        },
      },
    });

    render(
      <AuthContext.Provider value={{ user: null, setUser: vi.fn(), loading: false }}>
        <PatientAuthForm initialPurpose="REGISTER" />
      </AuthContext.Provider>
    );

    // Initial screen headers
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Create your account');
    expect(screen.getByText(/enter your details to get started/i)).toBeInTheDocument();

    // Fill First Name and Email
    const firstNameInput = screen.getByPlaceholderText('Jane');
    const emailInput = screen.getByPlaceholderText('you@example.com');

    fireEvent.change(firstNameInput, { target: { value: 'John' } });
    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /continue with email otp/i });
    fireEvent.click(submitBtn);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText(/an account with this email already exists/i)).toBeInTheDocument();
    });

    // Check CTA link
    const ctaLink = screen.getByRole('link', { name: /account already exists\. log in instead →/i });
    expect(ctaLink).toBeInTheDocument();
    expect(ctaLink).toHaveAttribute('href', '/login?email=existing%40example.com');

    // Confirm form did NOT advance to Step 2
    expect(screen.queryByPlaceholderText('123456')).not.toBeInTheDocument();
    // Confirm authService was called once with REGISTER purpose
    expect(authService.requestPatientOTP).toHaveBeenCalledWith('existing@example.com', 'REGISTER');
    expect(authService.requestPatientOTP).toHaveBeenCalledTimes(1);
  });

  it('(c) REGISTER Step 1 requires first_name before allowing submission', async () => {
    render(
      <AuthContext.Provider value={{ user: null, setUser: vi.fn(), loading: false }}>
        <PatientAuthForm initialPurpose="REGISTER" />
      </AuthContext.Provider>
    );

    const emailInput = screen.getByPlaceholderText('you@example.com');
    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /continue with email otp/i });
    const form = submitBtn.closest('form')!;
    fireEvent.submit(form);

    // First name validation error
    await waitFor(() => {
      expect(screen.getByText(/please enter your first name/i)).toBeInTheDocument();
    });

    expect(authService.requestPatientOTP).not.toHaveBeenCalled();
  });

  it('(d) Prefills email from query parameter on initial load', () => {
    mockSearchParams = new URLSearchParams('email=prefilled%40example.com');

    render(
      <AuthContext.Provider value={{ user: null, setUser: vi.fn(), loading: false }}>
        <PatientAuthForm initialPurpose="LOGIN" />
      </AuthContext.Provider>
    );

    const emailInput = screen.getByPlaceholderText('you@example.com') as HTMLInputElement;
    expect(emailInput.value).toBe('prefilled@example.com');
  });

  it('(e) Step 2 OTP verification screen is code-entry only and submits first and last name from Step 1', async () => {
    vi.mocked(authService.requestPatientOTP).mockResolvedValueOnce({
      success: true,
      message: 'OTP sent',
    });

    vi.mocked(authService.verifyPatientOTP).mockResolvedValueOnce({
      success: true,
      access: 'mock-access-token',
    });

    vi.mocked(authService.getCurrentUser).mockResolvedValueOnce({
      data: { id: 1, email: 'patient@example.com', role: 'PATIENT' },
    });

    render(
      <AuthContext.Provider value={{ user: null, setUser: vi.fn(), loading: false }}>
        <PatientAuthForm initialPurpose="REGISTER" />
      </AuthContext.Provider>
    );

    // Step 1: Enter details
    fireEvent.change(screen.getByPlaceholderText('Jane'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByPlaceholderText('Doe'), { target: { value: 'Smith' } });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'alice@example.com' } });

    fireEvent.click(screen.getByRole('button', { name: /continue with email otp/i }));

    // Step 2: Code entry
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Enter verification code');
    });

    // Step 2 must NOT have First Name or Last Name inputs
    expect(screen.queryByPlaceholderText('Jane')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Doe')).not.toBeInTheDocument();

    const codeInput = screen.getByPlaceholderText('123456');
    fireEvent.change(codeInput, { target: { value: '123456' } });

    fireEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));

    await waitFor(() => {
      expect(authService.verifyPatientOTP).toHaveBeenCalledWith({
        email: 'alice@example.com',
        code: '123456',
        purpose: 'REGISTER',
        first_name: 'Alice',
        last_name: 'Smith',
      });
    });
  });
});
