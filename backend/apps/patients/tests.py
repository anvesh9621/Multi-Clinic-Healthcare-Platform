from django.test import TestCase
from rest_framework.test import APIClient
from apps.core.test_utils import setup_test_environment
from apps.appointments.models import Appointment
from apps.patients.models import PatientHistory

class PatientIsolationTests(TestCase):
    def setUp(self):
        self.env = setup_test_environment()
        self.client = APIClient()
        self.patient_1 = self.env["patient_1"]
        self.patient_2 = self.env["patient_2"]
        
        # Create Patient History for patient 1
        PatientHistory.objects.create(
            patient=self.patient_1,
            blood_group="O+",
            allergies="Peanuts",
            chronic_diseases="None",
            past_surgeries="None",
            family_history="None"
        )

        # Create appointments
        self.appointment_1 = Appointment.objects.create(
            clinic=self.env["clinic_a"],
            doctor_clinic=self.env["doctor_a"],
            patient=self.patient_1,
            appointment_date="2030-01-01",
            start_time="10:00:00",
            end_time="10:30:00"
        )
        self.appointment_2 = Appointment.objects.create(
            clinic=self.env["clinic_a"],
            doctor_clinic=self.env["doctor_a"],
            patient=self.patient_2,
            appointment_date="2030-01-01",
            start_time="11:00:00",
            end_time="11:30:00"
        )

    def test_patient_cannot_read_other_patient_intake_form(self):
        """
        Patient A tries to access Patient B's intake form via appointment ID.
        """
        # Authenticate as patient 1
        self.client.force_authenticate(user=self.patient_1.user)

        # Access own intake form (might be 404 if not created, but NOT 403)
        response_own = self.client.get(f"/api/patients/appointments/{self.appointment_1.id}/intake/")
        self.assertIn(response_own.status_code, [200, 404])

        # Access patient 2's intake form
        response_other = self.client.get(f"/api/patients/appointments/{self.appointment_2.id}/intake/")
        self.assertEqual(response_other.status_code, 403)

    def test_patient_history_endpoint_returns_200(self):
        """
        Ensure the patient history endpoint does not throw a 500 attribute error.
        """
        self.client.force_authenticate(user=self.patient_1.user)
        response = self.client.get("/api/patients/history/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["blood_group"], "O+")
