import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import timedelta, time

from apps.core.factories import ClinicFactory, ClinicAdminFactory, PatientProfileFactory, create_doctor_clinic_with_full_week_schedule
from apps.appointments.models import Appointment

@pytest.mark.django_db
class AppointmentPaginationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.clinic = ClinicFactory()
        self.admin = ClinicAdminFactory(clinic=self.clinic)
        self.doctor_clinic = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic)
        self.patient = PatientProfileFactory()
        
        today = timezone.localdate()
        for i in range(27):
            Appointment.objects.create(
                clinic=self.clinic,
                doctor_clinic=self.doctor_clinic,
                patient=self.patient,
                appointment_date=today + timedelta(days=i),
                start_time=time(10, 0),
                end_time=time(10, 30),
                status=Appointment.StatusChoices.CONFIRMED,
            )

    def test_appointments_list_pagination(self):
        self.client.force_authenticate(user=self.admin)

        res1 = self.client.get("/api/appointments/?page=1")
        self.assertEqual(res1.status_code, 200)
        self.assertIn("count", res1.data)
        self.assertIn("next", res1.data)
        self.assertIn("previous", res1.data)
        self.assertIn("results", res1.data)
        self.assertEqual(res1.data["count"], 27)
        self.assertEqual(len(res1.data["results"]), 25)

        res2 = self.client.get("/api/appointments/?page=2")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(len(res2.data["results"]), 2)
        
        page1_ids = [item["id"] for item in res1.data["results"]]
        page2_ids = [item["id"] for item in res2.data["results"]]
        self.assertTrue(set(page1_ids).isdisjoint(set(page2_ids)))
