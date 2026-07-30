import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import timedelta, time
import datetime

from apps.core.factories import (
    ClinicFactory,
    ClinicAdminFactory,
    PatientProfileFactory,
    create_doctor_clinic_with_full_week_schedule,
)
from apps.appointments.models import Appointment

@pytest.mark.django_db
@pytest.mark.postgres_required
class AppointmentBookingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.clinic_a = ClinicFactory()
        self.admin_a = ClinicAdminFactory(clinic=self.clinic_a)
        self.doctor_a = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_a)
        self.patient_1 = PatientProfileFactory()

        # Date for the appointment (Next Monday to guarantee a schedule exists)
        today = timezone.localdate()
        days_ahead = 0 - today.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        self.appointment_date = today + timedelta(days=days_ahead)
        self.start_time = time(10, 0)
        self.end_time = time(10, 30)

    def test_booking_cancellation_rebooking_flow(self):
        """
        Tests the full flow:
        1. Patient books a slot.
        2. Patient tries to book same slot (fails due to overlap).
        3. Patient cancels the appointment.
        4. Patient rebooks the same slot (succeeds).
        """
        self.client.force_authenticate(user=self.patient_1.user)

        # 1. Book an appointment
        payload = {
            "doctor_clinic_id": self.doctor_a.id,
            "appointment_date": str(self.appointment_date),
            "start_time": self.start_time.strftime("%H:%M"),
            "end_time": self.end_time.strftime("%H:%M"),
            "reason": "Initial booking"
        }
        response = self.client.post("/api/appointments/book/", payload)
        self.assertEqual(response.status_code, 201)
        appointment_id = response.data.get("appointment_id") or response.data.get("id")

        # 2. Try to book the exact same slot again (should fail)
        response_overlap = self.client.post("/api/appointments/book/", payload)
        self.assertEqual(response_overlap.status_code, 400)
        self.assertIn("detail", response_overlap.data)

        # 3. Cancel the appointment
        cancel_payload = {
            "status": "CANCELLED"
        }
        response_cancel = self.client.patch(f"/api/appointments/{appointment_id}/status/", cancel_payload)
        self.assertEqual(response_cancel.status_code, 200)

        # Verify status is updated
        appointment = Appointment.objects.get(id=appointment_id)
        self.assertEqual(appointment.status, "CANCELLED")

        # 4. Rebook the same slot
        payload["reason"] = "Rebooking after cancellation"
        response_rebook = self.client.post("/api/appointments/book/", payload)
        self.assertEqual(response_rebook.status_code, 201)
        new_appointment_id = response_rebook.data.get("appointment_id") or response_rebook.data.get("id")
        self.assertNotEqual(new_appointment_id, appointment_id)
