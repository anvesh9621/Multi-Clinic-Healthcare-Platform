import pytest
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from apps.billing.models import PaymentMetricSnapshot
from apps.core.factories import UserFactory


@pytest.mark.django_db
class TestPaymentMetricsView(APITestCase):

    def setUp(self):
        self.super_admin = UserFactory(role="SUPER_ADMIN")
        self.doctor = UserFactory(role="DOCTOR")

        # Create sample snapshot for yesterday
        yesterday = (timezone.now() - timedelta(days=1)).date()
        self.snapshot = PaymentMetricSnapshot.objects.create(
            date=yesterday,
            total_payment_attempts=10,
            successful_payments=9,
            failed_payments=1,
            reconciliation_catches=2,
            refunds_processed=1,
            refund_total_amount=Decimal("150.00"),
            avg_time_to_payment_seconds=45,
        )

    def test_payment_metrics_view_forbidden_for_non_super_admin(self):
        self.client.force_authenticate(user=self.doctor)
        response = self.client.get("/api/analytics/payment-metrics/")
        assert response.status_code == 403

    def test_payment_metrics_view_success_for_super_admin(self):
        self.client.force_authenticate(user=self.super_admin)
        response = self.client.get("/api/analytics/payment-metrics/")
        assert response.status_code == 200
        data = response.data.get("data", {})
        assert data.get("overall_success_rate") == 90.0
        assert data.get("total_reconciliation_catches") == 2
        snapshots = data.get("snapshots", [])
        assert len(snapshots) >= 1
        snap_item = snapshots[-1]
        assert snap_item["total_payment_attempts"] == 10
        assert snap_item["successful_payments"] == 9
        assert snap_item["reconciliation_catches"] == 2

    def test_super_admin_stats_view_overview_shape_and_endpoint_separation(self):
        self.client.force_authenticate(user=self.super_admin)
        response = self.client.get("/api/analytics/super-admin/")
        assert response.status_code == 200
        data = response.data.get("data", {})
        # Overview fields present
        assert "total_clinics" in data
        assert "active_clinics" in data
        assert "total_users" in data
        assert "total_appointments" in data
        assert "appointments_today" in data
        assert "total_revenue_paid" in data
        assert "trend_data" in data
        assert "recent_logs" in data
        # Monolithic fields removed from overview endpoint
        assert "payment_metrics" not in data
        assert "clinic_breakdown" not in data


from apps.core.factories import ClinicFactory
from apps.analytics.services import get_clinic_dashboard_stats


@pytest.mark.django_db
class TestClinicDashboardStatsQueryCount(APITestCase):

    def test_get_clinic_dashboard_stats_query_count(self):
        clinic = ClinicFactory()
        with self.assertNumQueries(3):
            stats = get_clinic_dashboard_stats(clinic)

        assert set(stats.keys()) == {
            "appointments_today",
            "appointments_this_week",
            "completed_today",
            "cancelled_today",
            "total_patients",
            "total_doctors",
        }
        assert stats["appointments_today"] == 0
        assert stats["appointments_this_week"] == 0
        assert stats["completed_today"] == 0
        assert stats["cancelled_today"] == 0
        assert stats["total_patients"] == 0
        assert stats["total_doctors"] == 0


