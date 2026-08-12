import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from apps.core.factories import ClinicFactory, ClinicAdminFactory, DoctorProfileFactory
from apps.doctors.models import DoctorClinic, DoctorSchedule, DoctorLeave

@pytest.mark.django_db
class DoctorPaginationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.clinic = ClinicFactory()
        self.admin = ClinicAdminFactory(clinic=self.clinic)

        # Create 27 doctor clinic associations, schedules, and leaves
        for i in range(27):
            doc = DoctorProfileFactory()
            dc = DoctorClinic.objects.create(doctor=doc, clinic=self.clinic, consultation_fee=500)
            DoctorSchedule.objects.create(
                doctor_clinic=dc,
                day_of_week=0,
                start_time="09:00",
                end_time="17:00",
                slot_duration=30,
            )
            DoctorLeave.objects.create(
                doctor_clinic=dc,
                start_date="2026-09-01",
                end_date="2026-09-05",
                reason="Vacation",
            )

    def test_doctors_list_pagination(self):
        self.client.force_authenticate(user=self.admin)

        res1 = self.client.get("/api/doctors/?page=1")
        self.assertEqual(res1.status_code, 200)
        self.assertIn("count", res1.data)
        self.assertIn("next", res1.data)
        self.assertIn("previous", res1.data)
        self.assertIn("results", res1.data)
        self.assertEqual(res1.data["count"], 27)
        self.assertEqual(len(res1.data["results"]), 25)

        res2 = self.client.get("/api/doctors/?page=2")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(len(res2.data["results"]), 2)

        page1_ids = [item["id"] for item in res1.data["results"]]
        page2_ids = [item["id"] for item in res2.data["results"]]
        self.assertTrue(set(page1_ids).isdisjoint(set(page2_ids)))

    def test_doctor_schedules_pagination(self):
        self.client.force_authenticate(user=self.admin)

        res1 = self.client.get("/api/doctors/schedules/?page=1")
        self.assertEqual(res1.status_code, 200)
        self.assertIn("count", res1.data)
        self.assertEqual(res1.data["count"], 27)
        self.assertEqual(len(res1.data["results"]), 25)

        res2 = self.client.get("/api/doctors/schedules/?page=2")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(len(res2.data["results"]), 2)

    def test_doctor_leaves_pagination(self):
        self.client.force_authenticate(user=self.admin)

        res1 = self.client.get("/api/doctors/leaves/?page=1")
        self.assertEqual(res1.status_code, 200)
        self.assertIn("count", res1.data)
        self.assertEqual(res1.data["count"], 27)
        self.assertEqual(len(res1.data["results"]), 25)

        res2 = self.client.get("/api/doctors/leaves/?page=2")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(len(res2.data["results"]), 2)
