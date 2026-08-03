import pytest
from decimal import Decimal
from django.db import IntegrityError
from apps.billing.models import Invoice, SubscriptionInvoice, PaymentIdempotencyKey, PaymentLedgerEntry
from apps.core.factories import ClinicFactory, PatientFactory, SubscriptionFactory, UserFactory

from apps.patients.models import Patient

@pytest.mark.django_db
class TestPaymentLedgerEntry:
    def test_create_idempotency_key(self):
        key = PaymentIdempotencyKey.objects.create(
            key="test_idemp_key_123",
            operation_type="appointment_payment",
            reference_id="ref_999",
            status="completed"
        )
        assert key.key == "test_idemp_key_123"
        assert key.status == "completed"

    def test_ledger_entry_with_appointment_invoice(self):
        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            status="paid"
        )
        idemp = PaymentIdempotencyKey.objects.create(
            key="key_invoice_1",
            operation_type="appointment_payment",
            reference_id=str(invoice.id)
        )
        entry = PaymentLedgerEntry.objects.create(
            invoice=invoice,
            entry_type="debit",
            amount=Decimal("500.00"),
            currency="INR",
            resulting_status="paid",
            source_event="razorpay.payment_link.paid",
            razorpay_reference="pay_123456",
            idempotency_key=idemp
        )
        assert entry.invoice == invoice
        assert entry.subscription_invoice is None
        assert str(entry.amount) == "500.00"
        assert "debit 500.00 INR -> paid" in str(entry)

    def test_ledger_entry_with_subscription_invoice(self):
        clinic = ClinicFactory()
        subscription = SubscriptionFactory(clinic=clinic)
        sub_invoice = SubscriptionInvoice.objects.create(
            subscription=subscription,
            clinic=clinic,
            invoice_number="MC-2026-999",
            amount_before_gst=Decimal("1000.00"),
            cgst=Decimal("90.00"),
            sgst=Decimal("90.00"),
            total_amount=Decimal("1180.00"),
            period_start="2026-08-01T00:00:00Z",
            period_end="2026-09-01T00:00:00Z"
        )
        entry = PaymentLedgerEntry.objects.create(
            subscription_invoice=sub_invoice,
            entry_type="debit",
            amount=Decimal("1180.00"),
            currency="INR",
            resulting_status="paid",
            source_event="razorpay.subscription.charged"
        )
        assert entry.subscription_invoice == sub_invoice
        assert entry.invoice is None
        assert str(entry.amount) == "1180.00"

    def test_ledger_entry_constraint_neither_target_fails(self):
        with pytest.raises(IntegrityError):
            PaymentLedgerEntry.objects.create(
                entry_type="debit",
                amount=Decimal("100.00"),
                currency="INR",
                resulting_status="paid",
                source_event="invalid_event"
            )

    def test_ledger_entry_constraint_both_targets_fails(self):
        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("500.00"),
            total_amount=Decimal("500.00")
        )
        subscription = SubscriptionFactory(clinic=clinic)
        sub_invoice = SubscriptionInvoice.objects.create(
            subscription=subscription,
            clinic=clinic,
            invoice_number="MC-2026-888",
            amount_before_gst=Decimal("1000.00"),
            cgst=Decimal("90.00"),
            sgst=Decimal("90.00"),
            total_amount=Decimal("1180.00"),
            period_start="2026-08-01T00:00:00Z",
            period_end="2026-09-01T00:00:00Z"
        )
        with pytest.raises(IntegrityError):
            PaymentLedgerEntry.objects.create(
                invoice=invoice,
                subscription_invoice=sub_invoice,
                entry_type="debit",
                amount=Decimal("500.00"),
                currency="INR",
                resulting_status="paid",
                source_event="invalid_event"
            )

from apps.billing.models import (
    INVOICE_ALLOWED_TRANSITIONS, SUBSCRIPTION_INVOICE_ALLOWED_TRANSITIONS, InvalidStatusTransition
)

@pytest.mark.django_db
class TestInvoiceTransitions:
    def test_invoice_apply_ledger_entry_valid(self):
        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            status="draft"
        )
        
        # draft -> pending
        updated = invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("500.00"),
            resulting_status="pending",
            source_event="payment_link_created"
        )
        assert updated.status == "pending"
        assert PaymentLedgerEntry.objects.filter(invoice=invoice, resulting_status="pending").exists()

        # pending -> paid
        updated = invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("500.00"),
            resulting_status="paid",
            source_event="razorpay.payment_link.paid"
        )
        assert updated.status == "paid"
        assert PaymentLedgerEntry.objects.filter(invoice=invoice, resulting_status="paid").exists()

    def test_invoice_apply_ledger_entry_invalid_transition(self):
        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            status="draft"
        )
        
        # draft -> paid is invalid (must go draft -> pending -> paid)
        with pytest.raises(InvalidStatusTransition):
            invoice.apply_ledger_entry(
                entry_type="debit",
                amount=Decimal("500.00"),
                resulting_status="paid",
                source_event="direct_pay"
            )

    def test_subscription_invoice_apply_ledger_entry_valid_and_invalid(self):
        clinic = ClinicFactory()
        subscription = SubscriptionFactory(clinic=clinic)
        sub_invoice = SubscriptionInvoice.objects.create(
            subscription=subscription,
            clinic=clinic,
            invoice_number="MC-2026-777",
            amount_before_gst=Decimal("1000.00"),
            cgst=Decimal("90.00"),
            sgst=Decimal("90.00"),
            total_amount=Decimal("1180.00"),
            period_start="2026-08-01T00:00:00Z",
            period_end="2026-09-01T00:00:00Z",
            status="pending"
        )

        # pending -> paid
        updated = sub_invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("1180.00"),
            resulting_status="paid",
            source_event="subscription.charged"
        )
        assert updated.status == "paid"
        assert PaymentLedgerEntry.objects.filter(subscription_invoice=sub_invoice, resulting_status="paid").exists()

        # paid -> expired is invalid
        with pytest.raises(InvalidStatusTransition):
            sub_invoice.apply_ledger_entry(
                entry_type="debit",
                amount=Decimal("1180.00"),
                resulting_status="expired",
                source_event="manual_expire"
            )

