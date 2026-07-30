import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from django.utils import timezone
from django.utils.timezone import make_aware
from datetime import datetime, timedelta, time
from django.db import transaction, IntegrityError

from apps.core.test_utils import setup_test_environment
from apps.appointments.models import Appointment


@pytest.mark.django_db
@pytest.mark.postgres_required
class AppointmentBookingPostgresTests(TestCase):
    def setUp(self):
        self.env = setup_test_environment()
        self.client = APIClient()
        self.clinic_a = self.env["clinic_a"]
        self.doctor_a = self.env["doctor_a"]
        self.patient_1 = self.env["patient_1"]
        self.admin_a = self.env["admin_a"]

        today = timezone.localdate()
        days_ahead = 0 - today.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        self.appointment_date = today + timedelta(days=days_ahead)
        self.start_time = time(10, 0)
        self.end_time = time(10, 30)

        dt_start = datetime.combine(self.appointment_date, self.start_time)
        dt_end = datetime.combine(self.appointment_date, self.end_time)
        self.time_range = (make_aware(dt_start), make_aware(dt_end))

    def test_exclusion_constraint_double_booking_and_cancelled_rebooking(self):
        """
        Verifies database-level ExclusionConstraint behavior:
        1. Active appointment prevents overlapping active appointment (IntegrityError).
        2. Cancelling the appointment allows rebooking the same slot (succeeds).
        """
        # 1. Create active appointment
        appt1 = Appointment.objects.create(
            clinic=self.clinic_a,
            doctor_clinic=self.doctor_a,
            patient=self.patient_1,
            appointment_date=self.appointment_date,
            start_time=self.start_time,
            end_time=self.end_time,
            time_range=self.time_range,
            status="SCHEDULED"
        )

        # 2. Attempting double-booking must raise PostgreSQL IntegrityError
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Appointment.objects.create(
                    clinic=self.clinic_a,
                    doctor_clinic=self.doctor_a,
                    patient=self.patient_1,
                    appointment_date=self.appointment_date,
                    start_time=self.start_time,
                    end_time=self.end_time,
                    time_range=self.time_range,
                    status="SCHEDULED"
                )

        # 3. Cancel first appointment
        appt1.status = "CANCELLED"
        appt1.save()

        # 4. Rebooking cancelled slot must succeed (if ExclusionConstraint condition excludes CANCELLED)
        appt2 = Appointment.objects.create(
            clinic=self.clinic_a,
            doctor_clinic=self.doctor_a,
            patient=self.patient_1,
            appointment_date=self.appointment_date,
            start_time=self.start_time,
            end_time=self.end_time,
            time_range=self.time_range,
            status="SCHEDULED"
        )
        self.assertIsNotNone(appt2.id)
        self.assertNotEqual(appt1.id, appt2.id)
