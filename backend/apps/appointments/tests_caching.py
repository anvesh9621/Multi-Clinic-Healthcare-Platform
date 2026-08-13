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

    def test_public_clinic_list_view_caching(self):
        url = "/api/public/clinics/"
        response_1 = self.client.get(url)
        self.assertEqual(response_1.status_code, 200)

        # Verify key exists in cache
        cached_data = cache.get("public_clinics:")
        self.assertIsNotNone(cached_data)

        # Cache hit returns exact same cached content
        response_2 = self.client.get(url)
        self.assertEqual(response_2.status_code, 200)
        self.assertEqual(response_2.data, cached_data)

    def test_public_clinic_doctors_view_caching(self):
        url = f"/api/public/clinics/{self.clinic.id}/doctors/"
        response_1 = self.client.get(url)
        self.assertEqual(response_1.status_code, 200)

        cache_key = f"public_clinic_doctors:{self.clinic.id}:"
        cached_data = cache.get(cache_key)
        self.assertIsNotNone(cached_data)
        self.assertEqual(response_1.data, cached_data)

    def test_public_specialty_list_view_caching(self):
        url = "/api/public/specialties/"
        response_1 = self.client.get(url)
        self.assertEqual(response_1.status_code, 200)

        cached_data = cache.get("public_specialties:")
        self.assertIsNotNone(cached_data)
        self.assertIn("Cardiology", cached_data)

    def test_public_doctor_list_view_caching(self):
        url = "/api/public/doctors/"
        response_1 = self.client.get(url)
        self.assertEqual(response_1.status_code, 200)

        cached_data = cache.get("public_doctors:")
        self.assertIsNotNone(cached_data)

    def test_clinic_list_view_caching(self):
        url = "/api/doctors/clinics/"
        response_1 = self.client.get(url)
        self.assertEqual(response_1.status_code, 200)

        cached_data = cache.get("clinic_list:")
        self.assertIsNotNone(cached_data)

    def test_clinic_signal_invalidates_cache(self):
        # Warm cache
        self.client.get("/api/public/clinics/")
        self.client.get("/api/doctors/clinics/")
        self.assertIsNotNone(cache.get("public_clinics:"))
        self.assertIsNotNone(cache.get("clinic_list:"))

        # Save clinic -> triggers signal
        self.clinic.name = "Updated Clinic Name"
        self.clinic.save()

        # Caches should be invalidated
        self.assertIsNone(cache.get("public_clinics:"))
        self.assertIsNone(cache.get("clinic_list:"))

    def test_doctor_signal_invalidates_cache(self):
        # Warm cache
        self.client.get("/api/public/doctors/")
        self.client.get("/api/public/specialties/")
        self.assertIsNotNone(cache.get("public_doctors:"))
        self.assertIsNotNone(cache.get("public_specialties:"))

        # Save doctor -> triggers signal
        self.doctor.specialization = "Neurology"
        self.doctor.save()

        # Caches should be invalidated
        self.assertIsNone(cache.get("public_doctors:"))
        self.assertIsNone(cache.get("public_specialties:"))

    def test_doctor_clinic_signal_invalidates_cache(self):
        url = f"/api/public/clinics/{self.clinic.id}/doctors/"
        self.client.get(url)
        cache_key = f"public_clinic_doctors:{self.clinic.id}:"
        self.assertIsNotNone(cache.get(cache_key))

        # Save DoctorClinic -> triggers signal
        self.doctor_clinic.consultation_fee = 200.00
        self.doctor_clinic.save()

        # Cache should be invalidated
        self.assertIsNone(cache.get(cache_key))
