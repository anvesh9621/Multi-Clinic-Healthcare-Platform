from datetime import timedelta
from django.utils import timezone
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import User, ClinicAdminInvitation
from apps.core.factories import ClinicFactory, UserFactory, PatientFactory


class ClinicAdminInviteTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.clinic_a = ClinicFactory()
        self.clinic_b = ClinicFactory()

        self.super_admin = UserFactory(
            role=User.RoleChoices.SUPER_ADMIN,
            is_staff=True,
            is_superuser=True,
            email="superadmin_invite@example.com"
        )

        self.create_url = "/api/accounts/clinic-admins/create/"
        self.accept_url = "/api/accounts/clinic-admins/invitations/accept/"

    def test_valid_invite_and_token_creates_clinic_admin_account(self):
        """Valid invite + valid token creates the Clinic Admin user correctly."""
        self.client.force_authenticate(user=self.super_admin)
        create_res = self.client.post(self.create_url, {
            "email": "newadmin@example.com",
            "clinic_id": self.clinic_a.id
        })
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)

        invite = ClinicAdminInvitation.objects.get(email="newadmin@example.com", clinic=self.clinic_a)
        self.assertEqual(invite.status, "PENDING")

        payload = {
            "token": invite.token,
            "password": "Password123!",
            "first_name": "Clinic",
            "last_name": "Admin"
        }
        accept_res = self.client.post(self.accept_url, payload)
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)

        user = User.objects.get(email="newadmin@example.com")
        self.assertEqual(user.role, User.RoleChoices.CLINIC_ADMIN)
        self.assertEqual(user.clinic, self.clinic_a)

        invite.refresh_from_db()
        self.assertEqual(invite.status, "ACCEPTED")

    def test_reusing_accepted_token_fails(self):
        """Re-using the same token after successful acceptance fails (single-use guarantee)."""
        self.client.force_authenticate(user=self.super_admin)
        self.client.post(self.create_url, {
            "email": "singleuseadmin@example.com",
            "clinic_id": self.clinic_a.id
        })
        invite = ClinicAdminInvitation.objects.get(email="singleuseadmin@example.com")

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
        invite = ClinicAdminInvitation.objects.create(
            clinic=self.clinic_a,
            email="expiredadmin@example.com",
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
        patient = PatientFactory(email="existing_patient_admin@example.com")

        self.client.force_authenticate(user=self.super_admin)
        response = self.client.post(self.create_url, {
            "email": patient.email,
            "clinic_id": self.clinic_a.id
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already exists", str(response.data))

    def test_one_clinic_admin_per_clinic_enforcement(self):
        """Clinic Admin invite creation rejects when clinic already has a Clinic Admin assigned."""
        # Create existing clinic admin for clinic A
        UserFactory(
            clinic=self.clinic_a,
            role=User.RoleChoices.CLINIC_ADMIN,
            email="admin1@example.com"
        )

        self.client.force_authenticate(user=self.super_admin)
        response = self.client.post(self.create_url, {
            "email": "admin2@example.com",
            "clinic_id": self.clinic_a.id
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already has a Clinic Admin assigned", str(response.data))
