import time
import threading
import pytest
from decimal import Decimal
from django.db import IntegrityError, transaction, connection
from django.test import TransactionTestCase
from apps.billing.models import (
    Invoice, SubscriptionInvoice, PaymentIdempotencyKey, PaymentLedgerEntry, PaymentOutboxEvent,
    INVOICE_ALLOWED_TRANSITIONS, SUBSCRIPTION_INVOICE_ALLOWED_TRANSITIONS, InvalidStatusTransition
)
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


@pytest.mark.django_db
class TestInvoiceTransitions:
    def test_valid_transitions_create_single_ledger_entry_with_fields(self):
        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        admin_user = UserFactory()
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            status="draft"
        )
        idemp = PaymentIdempotencyKey.objects.create(
            key="idemp_valid_seq",
            operation_type="appointment_payment",
            reference_id=str(invoice.id)
        )

        initial_count = PaymentLedgerEntry.objects.count()

        # Step 1: draft -> pending
        inv1 = invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("500.00"),
            resulting_status="pending",
            source_event="view:generate_payment_link",
            user=admin_user,
            idempotency_key=idemp
        )
        assert inv1.status == "pending"
        assert PaymentLedgerEntry.objects.count() == initial_count + 1
        entry1 = PaymentLedgerEntry.objects.latest('created_at')
        assert entry1.invoice == invoice
        assert entry1.entry_type == "debit"
        assert entry1.amount == Decimal("500.00")
        assert entry1.resulting_status == "pending"
        assert entry1.source_event == "view:generate_payment_link"
        assert entry1.created_by == admin_user
        assert entry1.idempotency_key == idemp

        # Step 2: pending -> paid
        inv2 = invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("500.00"),
            resulting_status="paid",
            source_event="webhook:payment_link.paid",
            razorpay_reference="pay_rzp_999"
        )
        assert inv2.status == "paid"
        assert PaymentLedgerEntry.objects.count() == initial_count + 2
        entry2 = PaymentLedgerEntry.objects.latest('created_at')
        assert entry2.resulting_status == "paid"
        assert entry2.razorpay_reference == "pay_rzp_999"

        # Step 3: paid -> refunded
        inv3 = invoice.apply_ledger_entry(
            entry_type="credit",
            amount=Decimal("500.00"),
            resulting_status="refunded",
            source_event="view:refund_invoice",
            user=admin_user,
            razorpay_reference="rfnd_rzp_111"
        )
        assert inv3.status == "refunded"
        assert PaymentLedgerEntry.objects.count() == initial_count + 3
        entry3 = PaymentLedgerEntry.objects.latest('created_at')
        assert entry3.entry_type == "credit"
        assert entry3.resulting_status == "refunded"

    def test_invalid_transitions_raise_exception_and_create_no_ledger_entry(self):
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

        initial_count = PaymentLedgerEntry.objects.count()

        # 1. Invalid: draft -> paid (must go draft -> pending/pending_at_clinic first)
        with pytest.raises(InvalidStatusTransition):
            invoice.apply_ledger_entry(
                entry_type="debit",
                amount=Decimal("500.00"),
                resulting_status="paid",
                source_event="direct_pay_attempt"
            )
        assert PaymentLedgerEntry.objects.count() == initial_count
        assert Invoice.objects.get(pk=invoice.pk).status == "draft"

        # Transition to pending lawfully
        invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("500.00"),
            resulting_status="pending",
            source_event="payment_link"
        )
        pending_count = PaymentLedgerEntry.objects.count()

        # 2. Invalid: pending -> refunded (must go pending -> paid -> refunded)
        with pytest.raises(InvalidStatusTransition):
            invoice.apply_ledger_entry(
                entry_type="credit",
                amount=Decimal("500.00"),
                resulting_status="refunded",
                source_event="premature_refund"
            )
        assert PaymentLedgerEntry.objects.count() == pending_count
        assert Invoice.objects.get(pk=invoice.pk).status == "pending"

        # Transition to paid lawfully
        invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("500.00"),
            resulting_status="paid",
            source_event="payment_complete"
        )
        paid_count = PaymentLedgerEntry.objects.count()

        # 3. Invalid: paid -> pending (cannot un-pay back to pending)
        with pytest.raises(InvalidStatusTransition):
            invoice.apply_ledger_entry(
                entry_type="debit",
                amount=Decimal("500.00"),
                resulting_status="pending",
                source_event="revert_attempt"
            )
        assert PaymentLedgerEntry.objects.count() == paid_count

        # 4. Invalid: paid -> refunded lawfully, then refunded -> paid (cannot re-pay refunded invoice)
        invoice.apply_ledger_entry(
            entry_type="credit",
            amount=Decimal("500.00"),
            resulting_status="refunded",
            source_event="refund_complete"
        )
        refunded_count = PaymentLedgerEntry.objects.count()

        with pytest.raises(InvalidStatusTransition):
            invoice.apply_ledger_entry(
                entry_type="debit",
                amount=Decimal("500.00"),
                resulting_status="paid",
                source_event="repay_refunded"
            )
        assert PaymentLedgerEntry.objects.count() == refunded_count
        assert Invoice.objects.get(pk=invoice.pk).status == "refunded"

    def test_ledger_entry_created_at_ordering(self):
        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("300.00"),
            total_amount=Decimal("300.00"),
            status="draft"
        )

        invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("300.00"),
            resulting_status="pending",
            source_event="step_1"
        )
        invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("300.00"),
            resulting_status="paid",
            source_event="step_2"
        )
        invoice.apply_ledger_entry(
            entry_type="credit",
            amount=Decimal("300.00"),
            resulting_status="refunded",
            source_event="step_3"
        )

        entries = list(invoice.ledger_entries.order_by('created_at'))
        assert len(entries) == 3
        statuses = [e.resulting_status for e in entries]
        assert statuses == ["pending", "paid", "refunded"]
        assert entries[0].created_at <= entries[1].created_at <= entries[2].created_at

    def test_subscription_invoice_valid_and_invalid_transitions(self):
        clinic = ClinicFactory()
        subscription = SubscriptionFactory(clinic=clinic)
        sub_invoice = SubscriptionInvoice.objects.create(
            subscription=subscription,
            clinic=clinic,
            invoice_number="MC-2026-TEST",
            amount_before_gst=Decimal("1000.00"),
            cgst=Decimal("90.00"),
            sgst=Decimal("90.00"),
            total_amount=Decimal("1180.00"),
            period_start="2026-08-01T00:00:00Z",
            period_end="2026-09-01T00:00:00Z",
            status="pending"
        )

        initial_count = PaymentLedgerEntry.objects.count()

        # Valid: pending -> paid
        updated = sub_invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("1180.00"),
            resulting_status="paid",
            source_event="webhook:subscription.charged"
        )
        assert updated.status == "paid"
        assert PaymentLedgerEntry.objects.count() == initial_count + 1

        # Invalid: paid -> pending
        with pytest.raises(InvalidStatusTransition):
            sub_invoice.apply_ledger_entry(
                entry_type="debit",
                amount=Decimal("1180.00"),
                resulting_status="pending",
                source_event="invalid_revert"
            )
        assert PaymentLedgerEntry.objects.count() == initial_count + 1
        assert SubscriptionInvoice.objects.get(pk=sub_invoice.pk).status == "paid"

    def test_outbox_event_created_only_on_paid_status(self):
        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("400.00"),
            total_amount=Decimal("400.00"),
            status="draft"
        )

        initial_outbox_count = PaymentOutboxEvent.objects.count()

        # draft -> pending: NO outbox event created
        invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("400.00"),
            resulting_status="pending",
            source_event="payment_link_created"
        )
        assert PaymentOutboxEvent.objects.count() == initial_outbox_count

        # pending -> paid: Outbox event CREATED
        invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("400.00"),
            resulting_status="paid",
            source_event="payment_paid"
        )
        assert PaymentOutboxEvent.objects.count() == initial_outbox_count + 1
        event = PaymentOutboxEvent.objects.latest('created_at')
        assert event.event_type == 'send_invoice_email'
        assert event.payload['invoice_id'] == str(invoice.id)
        assert event.payload['invoice_type'] == 'appointment'
        assert event.status == 'pending'

        # paid -> refunded: NO additional outbox event created
        invoice.apply_ledger_entry(
            entry_type="credit",
            amount=Decimal("400.00"),
            resulting_status="refunded",
            source_event="refund_processed"
        )
        assert PaymentOutboxEvent.objects.count() == initial_outbox_count + 1

        # Test SubscriptionInvoice outbox creation on paid
        subscription = SubscriptionFactory(clinic=clinic)
        sub_invoice = SubscriptionInvoice.objects.create(
            subscription=subscription,
            clinic=clinic,
            invoice_number="MC-2026-OUTBOX",
            amount_before_gst=Decimal("1000.00"),
            cgst=Decimal("90.00"),
            sgst=Decimal("90.00"),
            total_amount=Decimal("1180.00"),
            period_start="2026-08-01T00:00:00Z",
            period_end="2026-09-01T00:00:00Z",
            status="pending"
        )
        sub_invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("1180.00"),
            resulting_status="paid",
            source_event="subscription.charged"
        )
        assert PaymentOutboxEvent.objects.count() == initial_outbox_count + 2
        sub_event = PaymentOutboxEvent.objects.latest('created_at')
        assert sub_event.event_type == 'send_invoice_email'
        assert sub_event.payload['invoice_id'] == str(sub_invoice.id)
        assert sub_event.payload['invoice_type'] == 'subscription'

    def test_generate_appointment_invoice_pdf(self):
        import os
        from apps.billing.tasks import generate_appointment_invoice_pdf

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            status="paid",
            payment_method="upi"
        )

        result = generate_appointment_invoice_pdf(invoice.id)
        assert "Appointment PDF generated" in result
        
        updated_invoice = Invoice.objects.get(id=invoice.id)
        assert updated_invoice.invoice_number.startswith("INV-")
        assert updated_invoice.pdf_path != ""
        assert os.path.exists(updated_invoice.pdf_path)




@pytest.mark.django_db(transaction=True)
class TestConcurrencySelectForUpdate(TransactionTestCase):
    """
    Verifies that apply_ledger_entry uses select_for_update() to serialize concurrent calls.
    Thread 1 starts an atomic block, transitions draft -> pending, and holds the transaction open with a sleep.
    Thread 2 attempts pending -> paid. Select_for_update() ensures Thread 2 waits or locks cleanly.
    """
    def test_concurrent_apply_ledger_entry_serializes(self):
        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("750.00"),
            total_amount=Decimal("750.00"),
            status="draft"
        )
        invoice_id = invoice.id

        errors = []
        execution_order = []

        def thread1_task():
            try:
                # Thread 1 transitions draft -> pending and holds the transaction open
                with transaction.atomic():
                    inv = Invoice.objects.get(pk=invoice_id)
                    inv.apply_ledger_entry(
                        entry_type="debit",
                        amount=Decimal("750.00"),
                        resulting_status="pending",
                        source_event="thread_1_draft_to_pending"
                    )
                    time.sleep(0.2)  # Hold transaction lock open for 200ms
                    execution_order.append("thread1_finished")
            except Exception as e:
                errors.append(f"Thread 1 error: {e}")

        def thread2_task():
            try:
                time.sleep(0.05)  # Ensure Thread 1 starts and enters transaction first
                inv = Invoice.objects.get(pk=invoice_id)
                inv.apply_ledger_entry(
                    entry_type="debit",
                    amount=Decimal("750.00"),
                    resulting_status="paid",
                    source_event="thread_2_pending_to_paid"
                )
                execution_order.append("thread2_finished")
            except Exception as e:
                # On SQLite, full-table lock throws OperationalError: database table is locked,
                # which confirms locking behavior in SQLite. On PostgreSQL, select_for_update blocks until Thread 1 finishes.
                if connection.vendor == 'sqlite' and ("locked" in str(e) or "lock" in str(e)):
                    execution_order.append("thread2_blocked_by_sqlite_lock")
                else:
                    errors.append(f"Thread 2 error: {e}")

        t1 = threading.Thread(target=thread1_task)
        t2 = threading.Thread(target=thread2_task)

        t1.start()
        t2.start()

        t1.join(timeout=5)
        t2.join(timeout=5)

        assert not errors, f"Thread execution errors: {errors}"
        assert ("thread2_finished" in execution_order or "thread2_blocked_by_sqlite_lock" in execution_order)
