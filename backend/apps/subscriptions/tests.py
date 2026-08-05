from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from apps.core.factories import ClinicFactory, ClinicAdminFactory
from apps.subscriptions.models import Subscription

class SubscriptionMiddlewareTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.clinic_a = ClinicFactory()
        self.admin_a = ClinicAdminFactory(clinic=self.clinic_a)

    def test_cancelled_subscription_blocks_mutations_but_allows_reads(self):
        """
        If a clinic's subscription is CANCELLED, the middleware should:
        - Block POST, PATCH, DELETE (return 403).
        - Allow GET (return 200).
        """
        # Set subscription to cancelled
        sub = self.clinic_a.subscription
        sub.status = "cancelled"
        sub.save()

        refresh = RefreshToken.for_user(self.admin_a)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        # GET request (allowed)
        response_get = self.client.get("/api/patients/")
        self.assertEqual(response_get.status_code, 200)

        # POST request (blocked by subscription middleware)
        payload = {
            "email": "new_doctor@test.com",
            "specialization": "General"
        }
        response_post = self.client.post("/api/doctors/invitations/", payload)
        self.assertEqual(response_post.status_code, 403)
        self.assertIn("error", response_post.json())


class TestSubscriptionTransition(TestCase):
    def setUp(self):
        self.clinic = ClinicFactory()
        self.sub = self.clinic.subscription

    def test_valid_transition_updates_status_and_extra_fields(self):
        from django.utils import timezone
        now = timezone.now()
        
        # trialing -> active
        updated = self.sub.transition_status(
            'active',
            source_event='test_verification',
            extra_fields={'current_period_end': now}
        )
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.status, 'active')
        self.assertEqual(updated.status, 'active')
        self.assertEqual(self.sub.current_period_end, now)

    def test_valid_transition_past_due(self):
        from django.utils import timezone
        from datetime import timedelta
        
        self.sub.status = 'active'
        self.sub.save()

        now = timezone.now()
        grace_end = now + timedelta(days=10)

        self.sub.transition_status(
            'past_due',
            source_event='test_payment_failed',
            extra_fields={'payment_failed_at': now, 'grace_period_end': grace_end}
        )
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.status, 'past_due')
        self.assertEqual(self.sub.payment_failed_at, now)
        self.assertEqual(self.sub.grace_period_end, grace_end)

    def test_invalid_transition_raises_exception(self):
        from apps.subscriptions.models import InvalidSubscriptionTransition
        
        self.sub.status = 'cancelled'
        self.sub.save()

        with self.assertRaises(InvalidSubscriptionTransition) as cm:
            self.sub.transition_status('halted', source_event='test_invalid')
        
        self.assertIn("cancelled -> halted not allowed", str(cm.exception))
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.status, 'cancelled')

