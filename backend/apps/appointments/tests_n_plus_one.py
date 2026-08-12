import pytest
from datetime import date, time, timedelta
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.db import connection
from rest_framework.test import APIClient

from apps.core.factories import (
    ClinicFactory,
    ClinicAdminFactory,
    PatientProfileFactory,
    DoctorClinicFactory,
    AppointmentFactory,
)
from apps.patients.models import Patient


@pytest.mark.django_db
class NPlusOneQueryTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.clinic = ClinicFactory()
        self.admin_user = ClinicAdminFactory(clinic=self.clinic)

    def test_appointment_list_view_n_plus_one(self):
        """
        Verify AppointmentListView query count does not scale linearly with row count.
        Creating 10 appointments.
        """
        doctor_clinic = DoctorClinicFactory(clinic=self.clinic)
        for i in range(10):
            patient = PatientProfileFactory()
            patient.user.clinic = self.clinic
            patient.user.save()
            AppointmentFactory(
                clinic=self.clinic,
                doctor_clinic=doctor_clinic,
                patient=patient,
                appointment_date=date.today() + timedelta(days=i + 1),
                start_time=time(10, 0),
                end_time=time(10, 30),
            )

        self.client.force_authenticate(user=self.admin_user)

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get("/api/appointments/")

        self.assertEqual(response.status_code, 200)
        # Record query count for reporting
        print(f"\n[BENCHMARK] AppointmentListView query count (10 rows): {len(ctx.captured_queries)}")
        # Constant query count expected after fix: <= 10 queries regardless of row count
        self.assertLessEqual(len(ctx.captured_queries), 8)

    def test_patient_list_view_n_plus_one(self):
        """
        Verify PatientListView query count does not scale linearly with row count.
        Creating 10 patients.
        """
        for i in range(10):
            p = PatientProfileFactory()
            p.user.clinic = self.clinic
            p.user.save()

        self.client.force_authenticate(user=self.admin_user)

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get("/api/patients/")

        self.assertEqual(response.status_code, 200)
        print(f"\n[BENCHMARK] PatientListView query count (10 rows): {len(ctx.captured_queries)}")
        # Constant query count expected after fix: <= 8 queries
        self.assertLessEqual(len(ctx.captured_queries), 8)

    def test_patient_history_view_n_plus_one(self):
        """
        Verify PatientHistoryView query count does not scale linearly with row count.
        Creating 10 appointments for a single patient.
        """
        patient = PatientProfileFactory()
        patient.user.clinic = self.clinic
        patient.user.save()
        doctor_clinic = DoctorClinicFactory(clinic=self.clinic)

        for i in range(10):
            AppointmentFactory(
                clinic=self.clinic,
                doctor_clinic=doctor_clinic,
                patient=patient,
                appointment_date=date.today() + timedelta(days=i + 1),
                start_time=time(10, 0),
                end_time=time(10, 30),
            )

        self.client.force_authenticate(user=self.admin_user)

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(f"/api/patients/{patient.id}/history/")

        self.assertEqual(response.status_code, 200)
        print(f"\n[BENCHMARK] PatientHistoryView query count (10 rows): {len(ctx.captured_queries)}")
        # Constant query count expected after fix: <= 10 queries
        self.assertLessEqual(len(ctx.captured_queries), 8)
