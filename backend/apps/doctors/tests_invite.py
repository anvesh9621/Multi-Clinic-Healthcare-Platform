from datetime import timedelta
from django.utils import timezone
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import User
from apps.doctors.models import Doctor, DoctorClinic, DoctorInvitation
from apps.core.factories import ClinicFactory, UserFactory, PatientFactory


class DoctorInviteTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.clinic_a = ClinicFactory()
        self.clinic_b = ClinicFactory()

        self.admin_a = UserFactory(
            clinic=self.clinic_a,
            role=User.RoleChoices.CLINIC_ADMIN,
            email="admin_a@example.com"
        )
        self.admin_b = UserFactory(
            clinic=self.clinic_b,
            role=User.RoleChoices.CLINIC_ADMIN,
            email="admin_b@example.com"
        )

        self.create_url = "/api/doctors/invitations/create/"
        self.accept_url = "/api/doctors/invite/accept/"

    def test_valid_invite_and_token_creates_doctor_account(self):
        """Valid invite + valid token creates the Doctor user and links DoctorClinic correctly."""
        self.client.force_authenticate(user=self.admin_a)
        create_res = self.client.post(self.create_url, {
            "emails": ["newdoctor@example.com"],
            "specialization": "Cardiology"
        })
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)

        invite = DoctorInvitation.objects.get(email="newdoctor@example.com", clinic=self.clinic_a)
        self.assertEqual(invite.status, "PENDING")

        # Accept invite
        payload = {
            "token": invite.token,
            "password": "Password123!",
            "first_name": "Doctor",
            "last_name": "Who",
            "specialization": "Cardiology",
            "consultation_fee": 600
        }
        accept_res = self.client.post(self.accept_url, payload)
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)

        # Confirm account & link created
        user = User.objects.get(email="newdoctor@example.com")
        self.assertEqual(user.role, User.RoleChoices.DOCTOR)
        self.assertTrue(DoctorClinic.objects.filter(doctor__user=user, clinic=self.clinic_a).exists())

        invite.refresh_from_db()
        self.assertEqual(invite.status, "ACCEPTED")

    def test_reusing_accepted_token_fails(self):
        """Re-using the same token after successful acceptance fails (single-use guarantee)."""
        self.client.force_authenticate(user=self.admin_a)
        self.client.post(self.create_url, {
            "emails": ["singleusedoc@example.com"],
            "specialization": "Pediatrics"
        })
        invite = DoctorInvitation.objects.get(email="singleusedoc@example.com")

        payload = {
            "token": invite.token,
            "password": "Password123!",
            "first_name": "Single",
            "last_name": "Use",
            "specialization": "Pediatrics"
        }
        # First call succeeds
        res1 = self.client.post(self.accept_url, payload)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Second call fails
        res2 = self.client.post(self.accept_url, payload)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired or has already been used", str(res2.data))

    def test_expired_token_is_rejected(self):
        """Expired token is rejected even if status is PENDING."""
        invite = DoctorInvitation.objects.create(
            clinic=self.clinic_a,
            email="expireddoc@example.com",
            specialization="Dermatology",
            expires_at=timezone.now() - timedelta(hours=1)
        )
        self.assertFalse(invite.is_valid)

        payload = {
            "token": invite.token,
            "password": "Password123!",
            "first_name": "Expired",
            "specialization": "Dermatology"
        }
        response = self.client.post(self.accept_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired or has already been used", str(response.data))

    def test_accepting_invite_with_existing_non_doctor_user_rejected(self):
        """Accepting invite with email belonging to an existing non-Doctor User is rejected with 400 Bad Request."""
        patient = PatientFactory(email="patient_as_doc@example.com")
        invite = DoctorInvitation.objects.create(
            clinic=self.clinic_a,
            email=patient.email,
            specialization="General"
        )
        payload = {
            "token": invite.token,
            "password": "Password123!",
            "first_name": "Patient",
            "specialization": "General"
        }
        response = self.client.post(self.accept_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("registered with a different role", str(response.data))

    def test_multi_clinic_doctor_linking(self):
        """Existing doctor at Clinic A accepting invite to Clinic B links to Clinic B without creating a duplicate User."""
        # Step 1: Create Doctor at Clinic A via invite
        self.client.force_authenticate(user=self.admin_a)
        self.client.post(self.create_url, {
            "emails": ["multiclinic@example.com"],
            "specialization": "Neurology"
        })
        invite_a = DoctorInvitation.objects.get(email="multiclinic@example.com", clinic=self.clinic_a)

        self.client.post(self.accept_url, {
            "token": invite_a.token,
            "password": "Password123!",
            "first_name": "Multi",
            "specialization": "Neurology"
        })

        doctor_user = User.objects.get(email="multiclinic@example.com")

        # Step 2: Clinic Admin B invites same doctor to Clinic B
        self.client.force_authenticate(user=self.admin_b)
        self.client.post(self.create_url, {
            "emails": ["multiclinic@example.com"],
            "specialization": "Neurology"
        })
        invite_b = DoctorInvitation.objects.get(email="multiclinic@example.com", clinic=self.clinic_b)

        # Step 3: Doctor accepts invite B
        accept_b_res = self.client.post(self.accept_url, {
            "token": invite_b.token,
            "password": "Password123!",
            "first_name": "Multi",
            "specialization": "Neurology"
        })
        self.assertEqual(accept_b_res.status_code, status.HTTP_200_OK)

        # Confirm exact assertions: 1 User, 2 DoctorClinic links
        self.assertEqual(User.objects.filter(email="multiclinic@example.com").count(), 1)
        self.assertEqual(DoctorClinic.objects.filter(doctor__user=doctor_user).count(), 2)
