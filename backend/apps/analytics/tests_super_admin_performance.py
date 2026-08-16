import pytest
from unittest.mock import patch
from datetime import date, timedelta
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.core.factories import (
    SuperAdminFactory,
    ClinicFactory,
    DoctorClinicFactory,
    PatientProfileFactory,
    AppointmentFactory,
)
from apps.billing.models import Invoice


@pytest.mark.django_db
class SuperAdminPerformanceTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.super_admin = SuperAdminFactory()
        self.client.force_authenticate(user=self.super_admin)

        # Create 10 active clinics with doctors, patients, and appointments
        today = date.today()
        self.clinics = []
        for i in range(10):
            clinic = ClinicFactory(is_active=True, name=f"Performance Clinic {i+1:02d}")
            self.clinics.append(clinic)
            doc_clinic = DoctorClinicFactory(clinic=clinic, is_active=True)
            
            for j in range(2):
                patient = PatientProfileFactory()
                patient.user.clinic = clinic
                patient.user.save()

                AppointmentFactory(
                    clinic=clinic,
                    doctor_clinic=doc_clinic,
                    patient=patient,
                    appointment_date=today,
                )
                AppointmentFactory(
                    clinic=clinic,
                    doctor_clinic=doc_clinic,
                    patient=patient,
                    appointment_date=today - timedelta(days=1),
                )

            Invoice.objects.create(
                clinic=clinic,
                patient=patient,
                amount=1500,
                total_amount=1500,
                status="PAID",
            )

    def test_super_admin_stats_overview_query_count_ceiling(self):
        """
        Verify that SuperAdminStatsView (Overview) executes in a small, fixed number of queries (<= 12)
        on a cold cache and does NOT scale with clinic count (10 clinics = fixed queries, not 10*5 + 14 = 64+ queries).
        """
        cache.clear()
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get("/api/analytics/super-admin/")

        self.assertEqual(response.status_code, 200)
        query_count = len(ctx.captured_queries)
        print(f"\n[BENCHMARK] SuperAdminStatsView query count (10 clinics): {query_count}")

        # Fixed ceiling: 1 clinics count, 1 active clinics count, 1 users count,
        # 1 appointments count, 1 appointments_today count, 1 revenue sum,
        # 2 trend queries (invoices + appts), 1 recent logs = 9 queries total.
        # Strict ceiling: <= 12 queries.
        self.assertLessEqual(query_count, 12)

    def test_super_admin_clinics_view_query_count_ceiling(self):
        """
        Verify that SuperAdminClinicsView executes in <= 4 queries for paginated annotated clinic breakdown.
        """
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get("/api/analytics/super-admin/clinics/")

        self.assertEqual(response.status_code, 200)
        query_count = len(ctx.captured_queries)
        print(f"\n[BENCHMARK] SuperAdminClinicsView query count (10 clinics): {query_count}")
        self.assertLessEqual(query_count, 4)

        data = response.data
        self.assertIn("results", data)
        self.assertEqual(data["count"], 10)
        self.assertEqual(len(data["results"]), 10)
        first = data["results"][0]
        self.assertIn("total_appointments", first)
        self.assertIn("appointments_today", first)
        self.assertIn("total_doctors", first)
        self.assertIn("total_patients", first)

    def test_super_admin_overview_caching_and_invalidation(self):
        """
        Verify that SuperAdminStatsView caches response in Redis:
        - 1st call: Cold cache (database queries executed)
        - 2nd call: Warm cache hit (0 database queries executed)
        - Cache clear: Cache miss (database queries re-executed)
        """
        cache.clear()
        
        # Cold cache request
        res1 = self.client.get("/api/analytics/super-admin/")
        self.assertEqual(res1.status_code, 200)

        # Warm cache request: 0 database queries!
        with CaptureQueriesContext(connection) as ctx:
            res2 = self.client.get("/api/analytics/super-admin/")

        self.assertEqual(res2.status_code, 200)
        self.assertEqual(len(ctx.captured_queries), 0)
        self.assertEqual(res1.data, res2.data)

        # Invalidate cache
        cache.clear()
        with CaptureQueriesContext(connection) as ctx:
            res3 = self.client.get("/api/analytics/super-admin/")

        self.assertEqual(res3.status_code, 200)
        self.assertGreater(len(ctx.captured_queries), 0)

    def test_super_admin_overview_cache_outage_resilience(self):
        """
        Verify that if Redis cache raises an exception, SuperAdminStatsView fails open
        gracefully and returns 200 with live DB data instead of throwing a 500 error.
        """
        cache.clear()
        with patch("django.core.cache.cache.get", side_effect=Exception("Redis connection refused")):
            response = self.client.get("/api/analytics/super-admin/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get("success"))
        self.assertIn("total_clinics", response.data.get("data", {}))
