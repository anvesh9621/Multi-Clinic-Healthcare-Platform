from datetime import date, time
from django.test import TestCase
from rest_framework.test import APIClient
from apps.core.factories import (
    ClinicFactory,
    PatientProfileFactory,
    create_doctor_clinic_with_full_week_schedule,
)
from apps.appointments.models import Appointment

class PatientIsolationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.clinic_a = ClinicFactory(name="Clinic A")
        self.doctor_a = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_a)
        self.patient_1 = PatientProfileFactory()
        self.patient_2 = PatientProfileFactory()
        
        # Update Patient Medical Profile for patient 1
        self.patient_1.blood_group = "O+"
        self.patient_1.allergies = "Peanuts"
        self.patient_1.profile_completed = True
        self.patient_1.save()

        # Create appointments
        self.appointment_1 = Appointment.objects.create(
            clinic=self.clinic_a,
            doctor_clinic=self.doctor_a,
            patient=self.patient_1,
            appointment_date=date(2030, 1, 1),
            start_time=time(10, 0),
            end_time=time(10, 30)
        )
        self.appointment_2 = Appointment.objects.create(
            clinic=self.clinic_a,
            doctor_clinic=self.doctor_a,
            patient=self.patient_2,
            appointment_date=date(2030, 1, 1),
            start_time=time(11, 0),
            end_time=time(11, 30)
        )

    def test_patient_cannot_read_other_patient_intake_form(self):
        """
        Patient A tries to access Patient B's intake form via appointment ID.
        """
        # Authenticate as patient 1
        self.client.force_authenticate(user=self.patient_1.user)

        # Access own intake form (might be 404 if not created, but NOT 403)
        response_own = self.client.get(f"/api/patients/intake-form/{self.appointment_1.id}/")
        self.assertIn(response_own.status_code, [200, 404])

        # Access patient 2's intake form
        response_other = self.client.get(f"/api/patients/intake-form/{self.appointment_2.id}/")
        self.assertEqual(response_other.status_code, 403)

    def test_patient_history_endpoint_returns_200(self):
        """
        Ensure the patient profile/history endpoint does not throw a 500 attribute error.
        """
        self.client.force_authenticate(user=self.patient_1.user)
        response = self.client.get("/api/patients/profile/")
        self.assertEqual(response.status_code, 200)
        blood_group = response.data.get("blood_group") or response.data.get("data", {}).get("blood_group")
        self.assertEqual(blood_group, "O+")
