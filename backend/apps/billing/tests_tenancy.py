from apps.core.test_tenancy import TenantIsolationTestCase
from apps.core.factories import PatientProfileFactory
from apps.billing.models import Invoice


class BillingTenancyTests(TenantIsolationTestCase):
    def setUp(self):
        super().setUp()
        self.patient_a = PatientProfileFactory(user__clinic=self.clinic_a)
        self.patient_b = PatientProfileFactory(user__clinic=self.clinic_b)

        self.invoice_a = Invoice.objects.create(
            clinic=self.clinic_a,
            patient=self.patient_a,
            amount=100.00,
            total_amount=100.00,
            status="pending"
        )
        self.invoice_b = Invoice.objects.create(
            clinic=self.clinic_b,
            patient=self.patient_b,
            amount=200.00,
            total_amount=200.00,
            status="pending"
        )

    def test_invoice_list_isolation(self):
        """InvoiceListView: Clinic A admin cannot see Clinic B invoices."""
        self.assert_clinic_a_cannot_see_clinic_b_data("/api/billing/invoices/", self.invoice_b.id)

    def test_invoice_detail_action_isolation(self):
        """MarkCashPaidView: Clinic A admin cannot mark Clinic B invoice as paid."""
        self.assert_direct_id_access_blocked(
            f"/api/billing/invoices/{self.invoice_b.id}/mark-cash-paid/",
            expected_status=(403, 404),
            method="post"
        )
