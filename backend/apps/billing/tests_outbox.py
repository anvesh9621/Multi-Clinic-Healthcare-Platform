import pytest
from decimal import Decimal
from unittest.mock import patch
from django.utils import timezone
from datetime import timedelta
from apps.billing.models import Invoice, SubscriptionInvoice, PaymentOutboxEvent
from apps.billing.tasks import process_payment_outbox
from apps.core.factories import ClinicFactory, PatientFactory, SubscriptionFactory
from apps.patients.models import Patient


@pytest.mark.django_db
class TestPaymentOutbox:
    def test_apply_ledger_entry_paid_creates_outbox_event(self):
        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            status="pending"
        )

        initial_count = PaymentOutboxEvent.objects.count()

        invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("500.00"),
            resulting_status="paid",
            source_event="webhook:payment_link.paid"
        )

        assert PaymentOutboxEvent.objects.count() == initial_count + 1
        event = PaymentOutboxEvent.objects.latest('created_at')
        assert event.event_type == "send_invoice_email"
        assert event.payload == {
            "invoice_id": str(invoice.id),
            "invoice_type": "appointment"
        }
        assert event.status == "pending"

    def test_apply_ledger_entry_non_paid_creates_no_outbox_event(self):
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

        initial_count = PaymentOutboxEvent.objects.count()

        # draft -> pending
        invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("500.00"),
            resulting_status="pending",
            source_event="view:generate_link"
        )
        assert PaymentOutboxEvent.objects.count() == initial_count

        # pending -> cancelled
        invoice.apply_ledger_entry(
            entry_type="credit",
            amount=Decimal("500.00"),
            resulting_status="cancelled",
            source_event="task:expiry_sweep"
        )
        assert PaymentOutboxEvent.objects.count() == initial_count

    @patch("django.core.mail.EmailMessage.send")
    def test_relay_task_processes_pending_event_successfully(self, mock_send):
        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            status="pending"
        )
        invoice.apply_ledger_entry(
            entry_type="debit",
            amount=Decimal("500.00"),
            resulting_status="paid",
            source_event="test_success"
        )

        event = PaymentOutboxEvent.objects.latest('created_at')
        assert event.status == "pending"

        process_payment_outbox()

        event.refresh_from_db()
        assert event.status == "completed"
        assert event.processed_at is not None
        assert mock_send.called

    @patch("django.core.mail.EmailMessage.send")
    def test_relay_task_retries_and_fails_after_5_attempts(self, mock_send):
        mock_send.side_effect = Exception("SMTP Connection Failed")

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

        event = PaymentOutboxEvent.objects.create(
            event_type="send_invoice_email",
            payload={"invoice_id": str(invoice.id), "invoice_type": "appointment"},
            status="pending"
        )

        # Loop calling task 5 times repeatedly
        for attempt_num in range(1, 6):
            process_payment_outbox()
            event.refresh_from_db()
            assert event.attempts == attempt_num
            assert "SMTP Connection Failed" in event.last_error

            if attempt_num < 5:
                assert event.status == "pending"
            else:
                assert event.status == "failed"

    @patch("apps.billing.tasks._handle_send_invoice_email")
    def test_relay_task_processes_events_in_created_at_order(self, mock_handler):
        now = timezone.now()
        event1 = PaymentOutboxEvent.objects.create(
            event_type="send_invoice_email",
            payload={"invoice_id": "1", "invoice_type": "appointment"},
            status="pending"
        )
        event2 = PaymentOutboxEvent.objects.create(
            event_type="send_invoice_email",
            payload={"invoice_id": "2", "invoice_type": "appointment"},
            status="pending"
        )
        event3 = PaymentOutboxEvent.objects.create(
            event_type="send_invoice_email",
            payload={"invoice_id": "3", "invoice_type": "appointment"},
            status="pending"
        )

        # Manually alter created_at to simulate out-of-order creation
        PaymentOutboxEvent.objects.filter(id=event1.id).update(created_at=now - timedelta(minutes=10))
        PaymentOutboxEvent.objects.filter(id=event2.id).update(created_at=now - timedelta(minutes=30))
        PaymentOutboxEvent.objects.filter(id=event3.id).update(created_at=now - timedelta(minutes=20))

        # Expected processing order by oldest created_at: event2 (30m ago), event3 (20m ago), event1 (10m ago)
        process_payment_outbox()

        processed_ids = [call.args[0]["invoice_id"] for call in mock_handler.call_args_list]
        assert processed_ids == ["2", "3", "1"]
