from datetime import timedelta
from django.utils import timezone
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework import status

from apps.clinics.models import Clinic
from apps.subscriptions.models import Subscription
from apps.accounts.models import User
from apps.core.factories import ClinicFactory, UserFactory


class SubscriptionEnforcementTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.clinic = ClinicFactory()
        self.admin_user = UserFactory(
            clinic=self.clinic,
            role=User.RoleChoices.CLINIC_ADMIN,
            email="admin_enforcement@example.com"
        )
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(self.admin_user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        self.write_url = "/api/doctors/invitations/create/"
        self.read_url = "/api/patients/"
        self.write_payload = {
            "emails": ["doc_enforcement@example.com"],
            "specialization": "General"
        }

    def test_new_clinic_creation_auto_creates_trialing_subscription(self):
        """New clinic creation automatically gets a Subscription with status='trialing' via signal."""
        new_clinic = Clinic.objects.create(
            name="Auto Sub Clinic",
            address="123 Medical Way"
        )
        sub = getattr(new_clinic, "subscription", None)
        self.assertIsNotNone(sub)
        self.assertEqual(sub.status, "trialing")
        self.assertEqual(sub.plan, "starter")

    def test_clinic_model_changes_do_not_affect_middleware_enforcement(self):
        """Modifying Clinic model fields has zero effect on middleware enforcement; only Subscription.status/plan governs access."""
        sub = self.clinic.subscription
        sub.status = "cancelled"
        sub.save()

        # Modify clinic model attributes
        self.clinic.name = "Renamed Clinic"
        self.clinic.address = "New Address St"
        self.clinic.save()

        # Middleware must still block write requests because Subscription.status='cancelled'
        res = self.client.post(self.write_url, self.write_payload)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Account suspended or inactive", str(res.json()))

        # Activating subscription allows write requests
        sub.status = "active"
        sub.save()
        res_active = self.client.post(self.write_url, self.write_payload)
        self.assertNotEqual(res_active.status_code, status.HTTP_403_FORBIDDEN)

    def test_trialing_or_active_subscription_allows_writes(self):
        """Clinic with status='trialing' or 'active' allows mutating write requests."""
        # 1. trialing status
        sub = self.clinic.subscription
        sub.status = "trialing"
        sub.save()

        res_trialing = self.client.post(self.write_url, self.write_payload)
        self.assertNotEqual(res_trialing.status_code, status.HTTP_403_FORBIDDEN)

        # 2. active status
        sub.status = "active"
        sub.save()

        res_active = self.client.post(self.write_url, self.write_payload)
        self.assertNotEqual(res_active.status_code, status.HTTP_403_FORBIDDEN)

    def test_cancelled_halted_or_no_subscription_blocks_writes(self):
        """Clinic with status='cancelled', 'halted', or no Subscription record at all blocks write requests."""
        sub = self.clinic.subscription

        # 1. status = 'cancelled'
        sub.status = "cancelled"
        sub.save()
        res_cancelled = self.client.post(self.write_url, self.write_payload)
        self.assertEqual(res_cancelled.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Account suspended or inactive", str(res_cancelled.json()))

        # 2. status = 'halted'
        sub.status = "halted"
        sub.save()
        res_halted = self.client.post(self.write_url, self.write_payload)
        self.assertEqual(res_halted.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Account suspended or inactive", str(res_halted.json()))

        # 3. No Subscription record at all (fail-closed check)
        sub.delete()
        self.clinic.refresh_from_db()
        res_no_sub = self.client.post(self.write_url, self.write_payload)
        self.assertEqual(res_no_sub.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Account suspended or inactive", str(res_no_sub.json()))

    def test_past_due_grace_period_enforcement(self):
        """Clinic with status='past_due' within grace_period_end succeeds; past grace_period_end is blocked."""
        sub = self.clinic.subscription
        sub.status = "past_due"

        # 1. Within grace_period_end -> writes allowed
        sub.grace_period_end = timezone.now() + timedelta(days=2)
        sub.save()
        res_in_grace = self.client.post(self.write_url, self.write_payload)
        self.assertNotEqual(res_in_grace.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Past grace_period_end -> writes blocked
        sub.grace_period_end = timezone.now() - timedelta(days=1)
        sub.save()
        res_past_grace = self.client.post(self.write_url, self.write_payload)
        self.assertEqual(res_past_grace.status_code, status.HTTP_403_FORBIDDEN)

    def test_read_requests_never_blocked(self):
        """Read requests (GET) are never blocked regardless of subscription state."""
        sub = self.clinic.subscription

        for bad_status in ["cancelled", "halted", "expired", "past_due"]:
            sub.status = bad_status
            sub.grace_period_end = timezone.now() - timedelta(days=10)
            sub.save()

            res_get = self.client.get(self.read_url)
            self.assertEqual(res_get.status_code, status.HTTP_200_OK)

        # Confirm read requests allowed even with no subscription record
        sub.delete()
        res_get_no_sub = self.client.get(self.read_url)
        self.assertEqual(res_get_no_sub.status_code, status.HTTP_200_OK)
