import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import React from 'react';
import SchedulePage from '@/app/dashboard/admin/schedules/page';
import { AuthContext } from '@/context/AuthContext';
import * as doctorsService from '@/services/doctors';
import * as schedulesService from '@/services/schedules';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/services/doctors', () => ({
  getDoctors: vi.fn(),
}));

vi.mock('@/services/schedules', () => ({
  getSchedules: vi.fn(),
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
}));

describe('Admin Doctor Schedules Workflow', () => {
  const mockUser = {
    id: 10,
    email: 'admin@clinic.com',
    role: 'CLINIC_ADMIN' as const,
    first_name: 'Clinic',
    last_name: 'Admin',
  };

  const mockDoctors = [
    {
      id: 101,
      doctor_email: 'doc.house@clinic.com',
      first_name: 'Gregory',
      last_name: 'House',
      specialization: 'Diagnostics',
      experience_years: 15,
      qualifications: 'MD',
      about: '',
      languages_spoken: ['English'],
      profile_photo: null,
      consultation_fee: 100,
      clinic_id: 1,
      clinic_name: 'Princeton Plainsboro',
    },
  ];

  const mockSchedules = [
    {
      id: 501,
      doctor_clinic_id: 101,
      day_of_week: 0, // Monday
      start_time: '09:00:00',
      end_time: '13:00:00',
      slot_duration: 30,
    },
    {
      id: 502,
      doctor_clinic_id: 101,
      day_of_week: 0, // Monday evening
      start_time: '14:00:00',
      end_time: '18:00:00',
      slot_duration: 30,
    },
    {
      id: 503,
      doctor_clinic_id: 101,
      day_of_week: 1, // Tuesday
      start_time: '10:00:00',
      end_time: '16:00:00',
      slot_duration: 45,
    },
  ];

  beforeAll(() => {
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
    vi.mocked(doctorsService.getDoctors).mockResolvedValue(mockDoctors as any);
    vi.mocked(schedulesService.getSchedules).mockResolvedValue(mockSchedules as any);
  });

  const renderComponent = () => {
    return render(
      <AuthContext.Provider
        value={{
          user: mockUser as any,
          token: 'fake-token',
          login: vi.fn(),
          logout: vi.fn(),
          register: vi.fn(),
          isAuthenticated: true,
          isLoading: false,
        }}
      >
        <SchedulePage />
      </AuthContext.Provider>
    );
  };

  it('fetches and renders an existing week of blocks across days', async () => {
    renderComponent();

    // Verify doctor list was loaded
    await waitFor(() => {
      expect(doctorsService.getDoctors).toHaveBeenCalled();
      expect(schedulesService.getSchedules).toHaveBeenCalledWith({ doctor_clinic_id: 101 });
    });

    // Monday should be active by default, showing 2 blocks
    await waitFor(() => {
      expect(screen.getByText('Monday Availability')).toBeInTheDocument();
      expect(screen.getByText('9:00 AM – 1:00 PM')).toBeInTheDocument();
      expect(screen.getByText('2:00 PM – 6:00 PM')).toBeInTheDocument();
    });

    // Switch to Tuesday tab
    const tueTab = screen.getByText('Tue').closest('button');
    expect(tueTab).toBeInTheDocument();
    fireEvent.click(tueTab!);

    await waitFor(() => {
      expect(screen.getByText('Tuesday Availability')).toBeInTheDocument();
      expect(screen.getByText('10:00 AM – 4:00 PM')).toBeInTheDocument();
    });
  });

  it('creates a new non-overlapping block on the active day', async () => {
    const newSchedule = {
      id: 504,
      doctor_clinic_id: 101,
      day_of_week: 0,
      start_time: '19:00:00',
      end_time: '21:00:00',
      slot_duration: 30,
    };
    vi.mocked(schedulesService.createSchedule).mockResolvedValue(newSchedule as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Monday Availability')).toBeInTheDocument();
    });

    // Fill form
    const startInputs = screen.getAllByLabelText(/Start Time/i);
    const endInputs = screen.getAllByLabelText(/End Time/i);

    fireEvent.change(startInputs[0], { target: { value: '19:00' } });
    fireEvent.change(endInputs[0], { target: { value: '21:00' } });

    // Submit
    const submitBtn = screen.getByText('Save Configuration');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(schedulesService.createSchedule).toHaveBeenCalledWith({
        doctor_clinic_id: 101,
        day_of_week: 0,
        start_time: '19:00:00',
        end_time: '21:00:00',
        slot_duration: 30,
      });
      expect(screen.getByText(/Added 1 schedule block/i)).toBeInTheDocument();
    });
  });

  it('rejects client-side when end time is before start time with inline error card', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Monday Availability')).toBeInTheDocument();
    });

    const startInputs = screen.getAllByLabelText(/Start Time/i);
    const endInputs = screen.getAllByLabelText(/End Time/i);

    fireEvent.change(startInputs[0], { target: { value: '15:00' } });
    fireEvent.change(endInputs[0], { target: { value: '11:00' } });

    const submitBtn = screen.getByText('Save Configuration');
    fireEvent.click(submitBtn);

    // Should show inline error and NOT call createSchedule
    await waitFor(() => {
      expect(screen.getByText(/End time must be after start time/i)).toBeInTheDocument();
      expect(schedulesService.createSchedule).not.toHaveBeenCalled();
    });
  });

  it('shows client-side overlap warning and blocks overlapping submission', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Monday Availability')).toBeInTheDocument();
      expect(screen.getByText('9:00 AM – 1:00 PM')).toBeInTheDocument();
    });

    const startInputs = screen.getAllByLabelText(/Start Time/i);
    const endInputs = screen.getAllByLabelText(/End Time/i);

    // Overlaps with 09:00 - 13:00
    fireEvent.change(startInputs[0], { target: { value: '10:00' } });
    fireEvent.change(endInputs[0], { target: { value: '12:00' } });

    // Overlap warning appears in UI
    await waitFor(() => {
      expect(screen.getByText(/Warning: Overlaps an existing schedule block!/i)).toBeInTheDocument();
    });

    const submitBtn = screen.getByText('Save Configuration');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/overlaps with an existing schedule on Monday/i)).toBeInTheDocument();
      expect(schedulesService.createSchedule).not.toHaveBeenCalled();
    });
  });

  it('edits an existing block via inline modal and updates list', async () => {
    const updatedBlock = {
      id: 501,
      doctor_clinic_id: 101,
      day_of_week: 0,
      start_time: '08:00:00',
      end_time: '12:00:00',
      slot_duration: 30,
    };
    vi.mocked(schedulesService.updateSchedule).mockResolvedValue(updatedBlock as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('9:00 AM – 1:00 PM')).toBeInTheDocument();
    });

    // Click edit button on first block
    const editBtns = screen.getAllByLabelText('Edit schedule block');
    fireEvent.click(editBtns[0]);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText('Edit Schedule Block')).toBeInTheDocument();
    });

    const updateBtn = screen.getByText('Update Block');
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(schedulesService.updateSchedule).toHaveBeenCalledWith(501, expect.any(Object));
      expect(screen.getByText('Schedule block updated successfully.')).toBeInTheDocument();
    });
  });

  it('deletes a block after confirmation and removes it from view', async () => {
    vi.mocked(schedulesService.deleteSchedule).mockResolvedValue(undefined);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('9:00 AM – 1:00 PM')).toBeInTheDocument();
    });

    // Click delete button on first block
    const deleteBtns = screen.getAllByLabelText('Delete schedule block');
    fireEvent.click(deleteBtns[0]);

    // Confirmation modal opens
    await waitFor(() => {
      expect(screen.getByText('Delete Schedule Block?')).toBeInTheDocument();
      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    });

    // Confirm delete
    fireEvent.click(screen.getByText('Confirm Delete'));

    await waitFor(() => {
      expect(schedulesService.deleteSchedule).toHaveBeenCalledWith(501);
      expect(screen.getByText('Schedule block deleted successfully.')).toBeInTheDocument();
    });
  });
});
