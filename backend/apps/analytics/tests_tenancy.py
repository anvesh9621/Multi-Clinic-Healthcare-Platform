from django.utils import timezone
from datetime import time
from apps.core.test_tenancy import TenantIsolationTestCase
from apps.core.factories import (
    PatientProfileFactory,
    create_doctor_clinic_with_full_week_schedule,
)
from apps.appointments.models import Appointment


class AnalyticsTenancyTests(TenantIsolationTestCase):
    def setUp(self):
        super().setUp()
        self.doc_clinic_a = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_a)
        self.doc_clinic_b = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_b)

        self.patient_a = PatientProfileFactory(user__clinic=self.clinic_a)
        self.patient_b = PatientProfileFactory(user__clinic=self.clinic_b)

        today = timezone.now().date()

        # 3 appointments today in Clinic A, 1 today in Clinic B
        for i in range(3):
            Appointment.objects.create(
                clinic=self.clinic_a,
                doctor_clinic=self.doc_clinic_a,
                patient=self.patient_a,
                appointment_date=today,
                start_time=time(10 + i, 0),
                end_time=time(10 + i, 30),
                status="COMPLETED"
            )
        Appointment.objects.create(
            clinic=self.clinic_b,
            doctor_clinic=self.doc_clinic_b,
            patient=self.patient_b,
            appointment_date=today,
            start_time=time(10, 0),
            end_time=time(10, 30),
            status="COMPLETED"
        )

    def test_analytics_dashboard_isolation(self):
        """ClinicDashboardView: Admin A's stats only reflect Clinic A data."""
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get("/api/analytics/dashboard/")
        self.assertEqual(response.status_code, 200)
        data = response.data.get("data", {})
        # Today's appointments should be 3 for Clinic A (excluding Clinic B's 1 appointment)
        self.assertEqual(data.get("appointments_today"), 3)
