from django.test import TestCase
from rest_framework.test import APIClient
from apps.core.test_utils import setup_test_environment, create_user
from apps.doctors.models import DoctorInvitation, Doctor, DoctorClinic

class DoctorInviteTests(TestCase):
    def setUp(self):
        self.env = setup_test_environment()
        self.client = APIClient()
        self.clinic_a = self.env["clinic_a"]
        self.clinic_b = self.env["clinic_b"]

    def test_invite_acceptance_already_patient(self):
        """
        If a user is already registered as a PATIENT, they cannot accept a DOCTOR invite.
        """
        # Create an invite for the patient's email
        invite = DoctorInvitation.objects.create(
            clinic=self.clinic_b,
            email=self.env["patient_1"].user.email,
            specialization="Dermatology"
        )

        payload = {
            "token": invite.token,
            "first_name": "Test",
            "last_name": "Doctor",
            "password": "newpassword123",
            "gender": "MALE",
            "qualifications": "MD"
        }

        response = self.client.post("/api/doctors/invitations/accept/", payload)
        self.assertEqual(response.status_code, 400)
        # Verify the custom validation error is raised
        self.assertIn("This email is already registered with a different role.", str(response.data))

    def test_invite_acceptance_already_doctor_elsewhere(self):
        """
        If a user is already a DOCTOR at Clinic A, accepting an invite to Clinic B
        should NOT create a new User or Doctor profile, but SHOULD create a new DoctorClinic.
        """
        existing_doc_email = self.env["doctor_a"].doctor.user.email
        initial_user_count = Doctor.objects.count()

        # Create invite for clinic B using doctor A's email
        invite = DoctorInvitation.objects.create(
            clinic=self.clinic_b,
            email=existing_doc_email,
            specialization="Cardiology"
        )

        payload = {
            "token": invite.token,
            "first_name": "Update First",
            "last_name": "Update Last",
            "password": "newpassword123",
            "gender": "MALE",
            "qualifications": "MD"
        }

        response = self.client.post("/api/doctors/invitations/accept/", payload)
        self.assertEqual(response.status_code, 201)

        # Assert no new Doctor profile was created
        self.assertEqual(Doctor.objects.count(), initial_user_count)

        # Assert Doctor is now linked to Clinic B
        doc_profile = Doctor.objects.get(user__email=existing_doc_email)
        is_in_clinic_b = DoctorClinic.objects.filter(doctor=doc_profile, clinic=self.clinic_b).exists()
        self.assertTrue(is_in_clinic_b)
