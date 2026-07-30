from django.utils import timezone
from datetime import timedelta
from apps.core.test_tenancy import TenantIsolationTestCase
from apps.subscriptions.models import Subscription
from apps.billing.models import SubscriptionInvoice


class SubscriptionsTenancyTests(TenantIsolationTestCase):
    def setUp(self):
        super().setUp()
        self.sub_a, _ = Subscription.objects.get_or_create(clinic=self.clinic_a, defaults={"plan": "professional", "status": "active"})
        self.sub_b, _ = Subscription.objects.get_or_create(clinic=self.clinic_b, defaults={"plan": "professional", "status": "active"})

        now = timezone.now()

        self.invoice_a = SubscriptionInvoice.objects.create(
            subscription=self.sub_a,
            clinic=self.clinic_a,
            invoice_number="INV-A-101",
            amount_before_gst=100.00,
            gst_rate=18.00,
            cgst=9.00,
            sgst=9.00,
            total_amount=118.00,
            period_start=now,
            period_end=now + timedelta(days=30)
        )
        self.invoice_b = SubscriptionInvoice.objects.create(
            subscription=self.sub_b,
            clinic=self.clinic_b,
            invoice_number="INV-B-101",
            amount_before_gst=100.00,
            gst_rate=18.00,
            cgst=9.00,
            sgst=9.00,
            total_amount=118.00,
            period_start=now,
            period_end=now + timedelta(days=30)
        )

    def test_subscription_invoice_list_isolation(self):
        """SubscriptionInvoiceListView: Clinic A admin cannot see Clinic B subscription invoices."""
        self.assert_clinic_a_cannot_see_clinic_b_data("/api/subscriptions/invoices/", self.invoice_b.id)

    def test_subscription_invoice_download_detail_isolation(self):
        """SubscriptionInvoiceDownloadView: Direct download of Clinic B invoice blocked for Clinic A admin."""
        self.assert_direct_id_access_blocked(
            f"/api/subscriptions/invoices/{self.invoice_b.id}/download/",
            expected_status=(403, 404)
        )
