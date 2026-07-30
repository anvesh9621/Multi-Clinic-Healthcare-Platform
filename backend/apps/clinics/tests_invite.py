from datetime import timedelta
from django.utils import timezone
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import User
from apps.clinics.models import ReceptionistInvitation
from apps.core.factories import ClinicFactory, UserFactory, PatientFactory


class ReceptionistInviteTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.clinic_a = ClinicFactory()
        self.clinic_b = ClinicFactory()

        self.admin_a = UserFactory(
            clinic=self.clinic_a,
            role=User.RoleChoices.CLINIC_ADMIN,
            email="admin_a_receptionist@example.com"
        )

        self.create_url = "/api/clinics/receptionists/create/"
        self.accept_url = "/api/clinics/receptionists/invitations/accept/"

    def test_valid_invite_and_token_creates_receptionist_account(self):
        """Valid invite + valid token creates the Receptionist user correctly."""
        self.client.force_authenticate(user=self.admin_a)
        create_res = self.client.post(self.create_url, {"email": "newreceptionist@example.com"})
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)

        invite = ReceptionistInvitation.objects.get(email="newreceptionist@example.com", clinic=self.clinic_a)
        self.assertEqual(invite.status, "PENDING")

        payload = {
            "token": invite.token,
            "password": "Password123!",
            "first_name": "Receptionist",
            "last_name": "One"
        }
        accept_res = self.client.post(self.accept_url, payload)
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)

        user = User.objects.get(email="newreceptionist@example.com")
        self.assertEqual(user.role, User.RoleChoices.RECEPTIONIST)
        self.assertEqual(user.clinic, self.clinic_a)

        invite.refresh_from_db()
        self.assertEqual(invite.status, "ACCEPTED")

    def test_reusing_accepted_token_fails(self):
        """Re-using the same token after successful acceptance fails (single-use guarantee)."""
        self.client.force_authenticate(user=self.admin_a)
        self.client.post(self.create_url, {"email": "singleuserecept@example.com"})
        invite = ReceptionistInvitation.objects.get(email="singleuserecept@example.com")

        payload = {
            "token": invite.token,
            "password": "Password123!",
            "first_name": "Single"
        }
        res1 = self.client.post(self.accept_url, payload)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        res2 = self.client.post(self.accept_url, payload)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired or has already been used", str(res2.data))

    def test_expired_token_is_rejected(self):
        """Expired token is rejected even if status is PENDING."""
        invite = ReceptionistInvitation.objects.create(
            clinic=self.clinic_a,
            email="expiredrecept@example.com",
            expires_at=timezone.now() - timedelta(hours=1)
        )
        self.assertFalse(invite.is_valid)

        payload = {
            "token": invite.token,
            "password": "Password123!",
            "first_name": "Expired"
        }
        response = self.client.post(self.accept_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired or has already been used", str(response.data))

    def test_inviting_existing_user_email_is_rejected_cleanly(self):
        """Inviting an email that already belongs to an existing User is rejected cleanly (400, not 500)."""
        patient = PatientFactory(email="existing_patient_recept@example.com")

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post(self.create_url, {"email": patient.email})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already exists", str(response.data))

    def test_one_receptionist_per_clinic_enforcement(self):
        """Receptionist invite creation rejects when clinic already has a Receptionist assigned."""
        # Create existing receptionist for clinic A
        UserFactory(
            clinic=self.clinic_a,
            role=User.RoleChoices.RECEPTIONIST,
            email="receptionist1@example.com"
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post(self.create_url, {"email": "receptionist2@example.com"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already has a Receptionist assigned", str(response.data))
