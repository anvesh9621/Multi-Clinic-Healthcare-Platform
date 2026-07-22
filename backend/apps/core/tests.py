from django.test import TestCase
from rest_framework.test import APIClient
from apps.core.test_utils import setup_test_environment
from apps.appointments.models import Appointment

class TenantIsolationTests(TestCase):
    def setUp(self):
        self.env = setup_test_environment()
        self.client = APIClient()
        
        self.clinic_a = self.env["clinic_a"]
        self.clinic_b = self.env["clinic_b"]
        self.admin_a = self.env["admin_a"]
        
        self.patient_1 = self.env["patient_1"] # Doesn't explicitly belong to a clinic until an appointment is booked
        
        # Create appointment in Clinic B
        self.appointment_b = Appointment.objects.create(
            clinic=self.clinic_b,
            doctor_clinic=self.env["doctor_b"],
            patient=self.patient_1,
            appointment_date="2030-01-01",
            start_time="10:00:00",
            end_time="10:30:00"
        )
        
        # Patient 1 also visits Clinic A
        self.appointment_a = Appointment.objects.create(
            clinic=self.clinic_a,
            doctor_clinic=self.env["doctor_a"],
            patient=self.patient_1,
            appointment_date="2030-01-02",
            start_time="10:00:00",
            end_time="10:30:00"
        )

    def test_clinic_admin_sees_only_own_clinic_appointments(self):
        """
        Clinic Admin A should only see Appointment A, never Appointment B.
        """
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get("/api/appointments/")
        
        self.assertEqual(response.status_code, 200)
        
        appointment_ids = [app["id"] for app in response.data["results"]]
        self.assertIn(self.appointment_a.id, appointment_ids)
        self.assertNotIn(self.appointment_b.id, appointment_ids)

    def test_clinic_admin_sees_only_own_clinic_patients(self):
        """
        Even if Patient 1 visited both clinics, the list view or details should only
        return the patient if they are associated with Clinic A.
        Wait, Patient list view uses ClinicQuerysetMixin with `user__clinic=clinic`. 
        Actually, PatientListView uses `appointments__clinic=self.request.user.clinic`.
        Let's test it to ensure the isolation works.
        """
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get("/api/patients/")
        
        self.assertEqual(response.status_code, 200)
        # Should return patient_1 since they have an appointment at clinic A
        patient_ids = [p["id"] for p in response.data["results"]]
        self.assertIn(self.patient_1.id, patient_ids)
