from django.test import TestCase
from django.core.cache import cache
from rest_framework.test import APIClient
from apps.clinics.models import Clinic
from apps.doctors.models import Doctor, DoctorClinic
from apps.accounts.models import User
from apps.subscriptions.models import Subscription


class ViewCachingTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

        # Create active clinic
        self.clinic = Clinic.objects.create(
            name="Cache Test Clinic",
            address="127 Cache St",
            is_active=True
        )
        # Ensure subscription is active (signal creates default subscription)
        Subscription.objects.filter(clinic=self.clinic).update(status="active")

        # Create doctor associated with clinic
        self.user = User.objects.create_user(
            email="cache_doc@example.com",
            password="password123",
            first_name="Cached",
            last_name="Doctor",
            role="DOCTOR",
            clinic=self.clinic
        )
        self.doctor = Doctor.objects.create(
            user=self.user,
            specialization="Cardiology"
        )
        self.doctor_clinic = DoctorClinic.objects.create(
            doctor=self.doctor,
            clinic=self.clinic,
            consultation_fee=150.00,
            is_active=True
        )

    def tearDown(self):
        cache.clear()

    def test_public_clinic_list_view_caching_and_invalidation(self):
        url = "/api/public/clinics/"
        cache_key = "public_clinics:"

        # (a) First request: Cache miss -> runs DB queries
        with self.assertNumQueries(3):
            res_1 = self.client.get(url)
        self.assertEqual(res_1.status_code, 200)
        self.assertIsNotNone(cache.get(cache_key))

        # (b) Second request: Cache hit -> EXACTLY 0 DB queries
        with self.assertNumQueries(0):
            res_2 = self.client.get(url)
        self.assertEqual(res_2.status_code, 200)
        self.assertEqual(res_1.data, res_2.data)

        # (c) Save Clinic model -> signal invalidates cache -> key is empty
        self.clinic.name = "Renamed Clinic"
        self.clinic.save()
        self.assertIsNone(cache.get(cache_key))

        # Third request: Cache miss again -> runs DB queries
        with self.assertNumQueries(3):
            res_3 = self.client.get(url)
        self.assertEqual(res_3.data[0]["name"], "Renamed Clinic")

    def test_public_clinic_doctors_view_caching_and_invalidation(self):
        url = f"/api/public/clinics/{self.clinic.id}/doctors/"
        cache_key = f"public_clinic_doctors:{self.clinic.id}:"

        # (a) First request: Cache miss -> runs DB queries
        with self.assertNumQueries(4):
            res_1 = self.client.get(url)
        self.assertEqual(res_1.status_code, 200)
        self.assertIsNotNone(cache.get(cache_key))

        # (b) Second request: Cache hit -> EXACTLY 0 DB queries
        with self.assertNumQueries(0):
            res_2 = self.client.get(url)
        self.assertEqual(res_2.status_code, 200)
        self.assertEqual(res_1.data, res_2.data)

        # (c) Save DoctorClinic model -> signal invalidates cache -> key is empty
        self.doctor_clinic.consultation_fee = 250.00
        self.doctor_clinic.save()
        self.assertIsNone(cache.get(cache_key))

        # Third request: Cache miss again -> runs DB queries
        with self.assertNumQueries(4):
            res_3 = self.client.get(url)
        self.assertEqual(res_3.data["doctors"][0]["consultation_fee"], 250.00)

    def test_public_specialty_list_view_caching_and_invalidation(self):
        url = "/api/public/specialties/"
        cache_key = "public_specialties:"

        # (a) First request: Cache miss -> runs DB queries
        with self.assertNumQueries(1):
            res_1 = self.client.get(url)
        self.assertEqual(res_1.status_code, 200)
        self.assertIsNotNone(cache.get(cache_key))

        # (b) Second request: Cache hit -> EXACTLY 0 DB queries
        with self.assertNumQueries(0):
            res_2 = self.client.get(url)
        self.assertEqual(res_2.status_code, 200)
        self.assertEqual(res_1.data, res_2.data)

        # (c) Save Doctor model -> signal invalidates cache -> key is empty
        self.doctor.specialization = "Neurology"
        self.doctor.save()
        self.assertIsNone(cache.get(cache_key))

        # Third request: Cache miss again -> runs DB queries
        with self.assertNumQueries(1):
            res_3 = self.client.get(url)
        self.assertIn("Neurology", res_3.data)

    def test_public_doctor_list_view_caching_and_invalidation(self):
        url = "/api/public/doctors/"
        cache_key = "public_doctors:"

        # (a) First request: Cache miss -> runs DB queries
        with self.assertNumQueries(7):
            res_1 = self.client.get(url)
        self.assertEqual(res_1.status_code, 200)
        self.assertIsNotNone(cache.get(cache_key))

        # (b) Second request: Cache hit -> EXACTLY 0 DB queries
        with self.assertNumQueries(0):
            res_2 = self.client.get(url)
        self.assertEqual(res_2.status_code, 200)
        self.assertEqual(res_1.data, res_2.data)

        # (c) Delete Doctor model -> signal invalidates cache -> key is empty
        self.doctor.delete()
        self.assertIsNone(cache.get(cache_key))

        # Third request: Cache miss again -> runs DB queries
        with self.assertNumQueries(1):
            res_3 = self.client.get(url)
        self.assertEqual(res_3.data["count"], 0)

    def test_clinic_list_view_caching_and_invalidation(self):
        url = "/api/doctors/clinics/"
        cache_key = "clinic_list:"

        # (a) First request: Cache miss -> runs DB queries
        with self.assertNumQueries(3):
            res_1 = self.client.get(url)
        self.assertEqual(res_1.status_code, 200)
        self.assertIsNotNone(cache.get(cache_key))

        # (b) Second request: Cache hit -> EXACTLY 0 DB queries
        with self.assertNumQueries(0):
            res_2 = self.client.get(url)
        self.assertEqual(res_2.status_code, 200)
        self.assertEqual(res_1.data, res_2.data)

        # (c) Delete Clinic model -> signal invalidates cache -> key is empty
        self.clinic.delete()
        self.assertIsNone(cache.get(cache_key))

        # Third request: Cache miss again -> runs DB queries
        with self.assertNumQueries(1):
            res_3 = self.client.get(url)
        self.assertEqual(res_3.data["count"], 0)

    def test_clinic_save_succeeds_even_when_cache_invalidation_fails(self):
        from unittest.mock import patch, MagicMock
        import logging

        mock_delete = MagicMock(side_effect=Exception("Redis connection error"))
        mock_delete_pattern = MagicMock(side_effect=Exception("Redis connection error"))

        with patch.object(cache, "delete", mock_delete), \
             patch.object(cache, "delete_pattern", mock_delete_pattern, create=True), \
             self.assertLogs("apps.clinics.signals", level="WARNING") as cm:
            self.clinic.name = "Resilient Clinic"
            self.clinic.save()
            self.clinic.refresh_from_db()
            self.assertEqual(self.clinic.name, "Resilient Clinic")
            self.assertTrue(any("Cache invalidation failed" in record.getMessage() for record in cm.records))

