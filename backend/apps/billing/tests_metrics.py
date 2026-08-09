import pytest
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.test import TestCase
from apps.billing.models import PaymentMetricSnapshot, PaymentLedgerEntry, Invoice
from apps.billing.tasks import compute_daily_payment_metrics
from apps.core.factories import ClinicFactory, PatientFactory
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

    def test_day_boundary_exclusion(self):
        now = timezone.now()
        yesterday_date = (now - timedelta(days=1)).date()

        # 1. Entry inside yesterday
        yesterday_dt = now - timedelta(days=1)
        inv_yesterday = Invoice.objects.create(
            clinic=self.clinic, patient=self.patient, amount=Decimal("300.00"), total_amount=Decimal("300.00"), status="paid"
        )
        entry_yesterday = PaymentLedgerEntry.objects.create(
            invoice=inv_yesterday, entry_type="debit", amount=Decimal("300.00"), resulting_status="paid", source_event="webhook:paid"
        )
        PaymentLedgerEntry.objects.filter(pk=entry_yesterday.pk).update(created_at=yesterday_dt)

        # 2. Entry 2 days ago (outside yesterday)
        two_days_ago_dt = now - timedelta(days=2)
        inv_2days = Invoice.objects.create(
            clinic=self.clinic, patient=self.patient, amount=Decimal("400.00"), total_amount=Decimal("400.00"), status="paid"
        )
        entry_2days = PaymentLedgerEntry.objects.create(
            invoice=inv_2days, entry_type="debit", amount=Decimal("400.00"), resulting_status="paid", source_event="webhook:paid"
        )
        PaymentLedgerEntry.objects.filter(pk=entry_2days.pk).update(created_at=two_days_ago_dt)

        # 3. Entry today (outside yesterday)
        today_dt = now
        inv_today = Invoice.objects.create(
            clinic=self.clinic, patient=self.patient, amount=Decimal("500.00"), total_amount=Decimal("500.00"), status="paid"
        )
        entry_today = PaymentLedgerEntry.objects.create(
            invoice=inv_today, entry_type="debit", amount=Decimal("500.00"), resulting_status="paid", source_event="webhook:paid"
        )
        PaymentLedgerEntry.objects.filter(pk=entry_today.pk).update(created_at=today_dt)

        compute_daily_payment_metrics()
        snapshot = PaymentMetricSnapshot.objects.get(date=yesterday_date)

        # Confirms outside entries were excluded
        assert snapshot.successful_payments == 1

    def test_idempotent_task_execution(self):
        now = timezone.now()
        yesterday_date = (now - timedelta(days=1)).date()

        inv = Invoice.objects.create(
            clinic=self.clinic, patient=self.patient, amount=Decimal("100.00"), total_amount=Decimal("100.00"), status="paid"
        )
        entry = PaymentLedgerEntry.objects.create(
            invoice=inv, entry_type="debit", amount=Decimal("100.00"), resulting_status="paid", source_event="webhook:paid"
        )
        PaymentLedgerEntry.objects.filter(pk=entry.pk).update(created_at=now - timedelta(days=1))

        # Run first time
        compute_daily_payment_metrics()
        assert PaymentMetricSnapshot.objects.filter(date=yesterday_date).count() == 1

        # Run second time (simulating retry or manual rerun)
        compute_daily_payment_metrics()
        assert PaymentMetricSnapshot.objects.filter(date=yesterday_date).count() == 1

    def test_reconciliation_catches_distinguishes_source_event(self):
        now = timezone.now()
        yesterday_dt = now - timedelta(days=1)
        yesterday_date = yesterday_dt.date()

        inv1 = Invoice.objects.create(
            clinic=self.clinic, patient=self.patient, amount=Decimal("200.00"), total_amount=Decimal("200.00"), status="paid"
        )
        entry_webhook = PaymentLedgerEntry.objects.create(
            invoice=inv1, entry_type="debit", amount=Decimal("200.00"), resulting_status="paid", source_event="webhook:payment_link.paid"
        )
        PaymentLedgerEntry.objects.filter(pk=entry_webhook.pk).update(created_at=yesterday_dt)

        inv2 = Invoice.objects.create(
            clinic=self.clinic, patient=self.patient, amount=Decimal("200.00"), total_amount=Decimal("200.00"), status="paid"
        )
        entry_recon = PaymentLedgerEntry.objects.create(
            invoice=inv2, entry_type="debit", amount=Decimal("200.00"), resulting_status="paid", source_event="reconciliation:payment_link_paid"
        )
        PaymentLedgerEntry.objects.filter(pk=entry_recon.pk).update(created_at=yesterday_dt)

        compute_daily_payment_metrics()
        snapshot = PaymentMetricSnapshot.objects.get(date=yesterday_date)

        assert snapshot.successful_payments == 2
        assert snapshot.reconciliation_catches == 1
