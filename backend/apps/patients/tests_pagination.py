import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from apps.core.factories import ClinicFactory, ClinicAdminFactory, PatientProfileFactory

@pytest.mark.django_db
class PatientPaginationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.clinic = ClinicFactory()
        self.admin = ClinicAdminFactory(clinic=self.clinic)

        for i in range(27):
            p = PatientProfileFactory()
            p.user.clinic = self.clinic
            p.user.save()

    def test_patients_list_pagination(self):
        self.client.force_authenticate(user=self.admin)

        res1 = self.client.get("/api/patients/?page=1")
        self.assertEqual(res1.status_code, 200)
        self.assertIn("count", res1.data)
        self.assertIn("next", res1.data)
        self.assertIn("previous", res1.data)
        self.assertIn("results", res1.data)
        self.assertEqual(res1.data["count"], 27)
        self.assertEqual(len(res1.data["results"]), 25)

        res2 = self.client.get("/api/patients/?page=2")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(len(res2.data["results"]), 2)

        page1_ids = [item["id"] for item in res1.data["results"]]
        page2_ids = [item["id"] for item in res2.data["results"]]
        self.assertTrue(set(page1_ids).isdisjoint(set(page2_ids)))
