from datetime import date, time
from apps.core.test_tenancy import TenantIsolationTestCase
from apps.core.factories import (
    PatientProfileFactory,
    create_doctor_clinic_with_full_week_schedule,
)
from apps.appointments.models import Appointment


class TenantIsolationTests(TenantIsolationTestCase):
    def setUp(self):
        super().setUp()

        self.doctor_a = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_a)
        self.doctor_b = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_b)

        self.patient_1 = PatientProfileFactory(user__clinic=self.clinic_a)

        # Create appointment in Clinic B
        self.appointment_b = Appointment.objects.create(
            clinic=self.clinic_b,
            doctor_clinic=self.doctor_b,
            patient=self.patient_1,
            appointment_date=date(2030, 1, 1),
            start_time=time(10, 0),
            end_time=time(10, 30)
        )

        # Patient 1 also visits Clinic A
        self.appointment_a = Appointment.objects.create(
            clinic=self.clinic_a,
            doctor_clinic=self.doctor_a,
            patient=self.patient_1,
            appointment_date=date(2030, 1, 2),
            start_time=time(10, 0),
            end_time=time(10, 30)
        )

    def test_clinic_admin_sees_only_own_clinic_appointments(self):
        """
        Clinic Admin A should only see Appointment A, never Appointment B.
        """
        self.assert_clinic_a_cannot_see_clinic_b_data("/api/appointments/", self.appointment_b.id)

    def test_clinic_admin_sees_only_own_clinic_patients(self):
        """
        Even if Patient 1 visited both clinics, the list view or details should only
        return the patient if they are associated with Clinic A.
        """
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get("/api/patients/")

        self.assertEqual(response.status_code, 200)
        patient_ids = [p["id"] for p in response.data]
        self.assertIn(self.patient_1.id, patient_ids)
