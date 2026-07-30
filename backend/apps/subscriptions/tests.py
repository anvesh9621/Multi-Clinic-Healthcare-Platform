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
