from django.test import TestCase
from rest_framework.test import APIClient
from apps.core.test_utils import setup_test_environment
from apps.subscriptions.models import Subscription

class SubscriptionMiddlewareTests(TestCase):
    def setUp(self):
        self.env = setup_test_environment()
        self.client = APIClient()
        self.clinic_a = self.env["clinic_a"]
        self.admin_a = self.env["admin_a"]

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

        self.client.force_authenticate(user=self.admin_a)

        # GET request (allowed)
        response_get = self.client.get("/api/patients/")
        self.assertEqual(response_get.status_code, 200)

        # POST request (blocked)
        payload = {
            "email": "new_patient@test.com",
            "first_name": "Test",
            "last_name": "Patient",
            "phone": "0000000000"
        }
        response_post = self.client.post("/api/patients/", payload)
        self.assertEqual(response_post.status_code, 403)
        self.assertIn("error", response_post.data)
