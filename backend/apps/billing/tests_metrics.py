import pytest
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.test import TestCase
from apps.billing.models import PaymentMetricSnapshot, PaymentLedgerEntry, Invoice
from apps.billing.tasks import compute_daily_payment_metrics
from apps.core.factories import ClinicFactory, PatientFactory, UserFactory
from apps.patients.models import Patient


@pytest.mark.django_db
class TestDailyPaymentMetrics(TestCase):

    def setUp(self):
        self.clinic = ClinicFactory()
        self.patient_user = PatientFactory()
        self.patient = getattr(self.patient_user, 'patient_profile', None) or Patient.objects.create(user=self.patient_user, phone="9991112223")

    def test_compute_daily_payment_metrics_task(self):
        now = timezone.now()
        yesterday_mid = now - timedelta(days=1)

        inv1 = Invoice.objects.create(
            clinic=self.clinic,
            patient=self.patient,
            amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            status="paid"
        )
        Invoice.objects.filter(pk=inv1.pk).update(created_at=yesterday_mid - timedelta(minutes=10))

        entry1 = PaymentLedgerEntry.objects.create(
            invoice=inv1,
            entry_type="debit",
            amount=Decimal("500.00"),
            resulting_status="paid",
            source_event="webhook:payment_link.paid"
        )
        PaymentLedgerEntry.objects.filter(pk=entry1.pk).update(created_at=yesterday_mid)

        inv2 = Invoice.objects.create(
            clinic=self.clinic,
            patient=self.patient,
            amount=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            status="paid"
        )
        Invoice.objects.filter(pk=inv2.pk).update(created_at=yesterday_mid - timedelta(minutes=20))

        entry2 = PaymentLedgerEntry.objects.create(
            invoice=inv2,
            entry_type="debit",
            amount=Decimal("1000.00"),
            resulting_status="paid",
            source_event="reconciliation:payment_link_paid"
        )
        PaymentLedgerEntry.objects.filter(pk=entry2.pk).update(created_at=yesterday_mid)

        refund_entry = PaymentLedgerEntry.objects.create(
            invoice=inv1,
            entry_type="credit",
            amount=Decimal("200.00"),
            resulting_status="paid",
            source_event="webhook:refund.processed"
        )
        PaymentLedgerEntry.objects.filter(pk=refund_entry.pk).update(created_at=yesterday_mid)

        res = compute_daily_payment_metrics()
        assert "Computed metrics for" in res

        yesterday_date = (now - timedelta(days=1)).date()
        snapshot = PaymentMetricSnapshot.objects.get(date=yesterday_date)

        assert snapshot.successful_payments == 2
        assert snapshot.reconciliation_catches == 1
        assert snapshot.refunds_processed == 1
        assert snapshot.refund_total_amount == Decimal("200.00")
        assert snapshot.avg_time_to_payment_seconds is not None
        assert snapshot.avg_time_to_payment_seconds > 0
