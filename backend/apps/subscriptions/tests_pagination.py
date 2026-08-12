import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from apps.core.factories import ClinicFactory, ClinicAdminFactory, SubscriptionFactory
from apps.billing.models import SubscriptionInvoice
from django.utils import timezone
from datetime import timedelta

@pytest.mark.django_db
class SubscriptionPaginationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.clinic = ClinicFactory()
        self.admin = ClinicAdminFactory(clinic=self.clinic)
        self.subscription = SubscriptionFactory(clinic=self.clinic)

        now = timezone.now()
        for i in range(27):
            SubscriptionInvoice.objects.create(
                subscription=self.subscription,
                clinic=self.clinic,
                invoice_number=f"SUB-INV-{i:03d}",
                amount_before_gst=2541.53,
                cgst=228.73,
                sgst=228.73,
                total_amount=2999.00,
                period_start=now - timedelta(days=30),
                period_end=now,
            )

    def test_subscription_invoices_pagination(self):
        self.client.force_authenticate(user=self.admin)

        res1 = self.client.get("/api/subscriptions/invoices/?page=1")
        self.assertEqual(res1.status_code, 200)
        self.assertIn("count", res1.data)
        self.assertIn("next", res1.data)
        self.assertIn("previous", res1.data)
        self.assertIn("results", res1.data)
        self.assertEqual(res1.data["count"], 27)
        self.assertEqual(len(res1.data["results"]), 25)

        res2 = self.client.get("/api/subscriptions/invoices/?page=2")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(len(res2.data["results"]), 2)

        page1_ids = [item["id"] for item in res1.data["results"]]
        page2_ids = [item["id"] for item in res2.data["results"]]
        self.assertTrue(set(page1_ids).isdisjoint(set(page2_ids)))
