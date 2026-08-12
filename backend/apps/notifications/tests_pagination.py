import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from apps.core.factories import ClinicAdminFactory
from apps.notifications.models import Notification

@pytest.mark.django_db
class NotificationPaginationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = ClinicAdminFactory()

        for i in range(27):
            Notification.objects.create(
                recipient=self.admin,
                title=f"Notification {i}",
                message=f"Test notification message {i}",
            )

    def test_notifications_list_pagination(self):
        self.client.force_authenticate(user=self.admin)

        res1 = self.client.get("/api/notifications/?page=1")
        self.assertEqual(res1.status_code, 200)
        self.assertIn("count", res1.data)
        self.assertIn("next", res1.data)
        self.assertIn("previous", res1.data)
        self.assertIn("results", res1.data)
        self.assertEqual(res1.data["count"], 27)
        self.assertEqual(len(res1.data["results"]), 25)

        res2 = self.client.get("/api/notifications/?page=2")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(len(res2.data["results"]), 2)

        page1_ids = [item["id"] for item in res1.data["results"]]
        page2_ids = [item["id"] for item in res2.data["results"]]
        self.assertTrue(set(page1_ids).isdisjoint(set(page2_ids)))
