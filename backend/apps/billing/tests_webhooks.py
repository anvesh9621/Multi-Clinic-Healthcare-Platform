import json
import hmac
import hashlib
import pytest
import datetime
from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import Client
from django.conf import settings
from apps.billing.models import Invoice, WebhookEvent, PaymentOutboxEvent, PaymentLedgerEntry
from apps.core.factories import ClinicFactory, PatientFactory, DoctorFactory, UserFactory
from apps.patients.models import Patient
from apps.appointments.models import Appointment
from apps.doctors.models import Doctor, DoctorClinic


def generate_webhook_signature(body: bytes, secret: str = "test_webhook_secret") -> str:
    return hmac.new(secret.encode('utf-8'), body, hashlib.sha256).hexdigest()


@pytest.mark.django_db
class TestWebhookRoutingAndDedup:

    @pytest.fixture(autouse=True)
    def setup_secret(self, settings):
        settings.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret"
        settings.RAZORPAY_KEY_ID = "rzp_test_key"
        settings.RAZORPAY_KEY_SECRET = "rzp_test_secret"

    def test_webhook_requires_signature(self):
        client = Client()
        response = client.post("/api/billing/webhook/", data={}, content_type="application/json")
        assert response.status_code == 400
        assert "Missing signature" in response.content.decode()

    def test_webhook_rejects_invalid_signature(self):
        client = Client()
        payload = json.dumps({"event": "payment.failed", "id": "evt_invalid_sig"})
        response = client.post(
            "/api/billing/webhook/",
            data=payload,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE="invalid_signature_hash"
        )
        assert response.status_code == 400
        assert "Invalid signature" in response.content.decode()

    @patch("apps.billing.razorpay_client.get_razorpay_client")
    def test_webhook_deduplication_prevents_reprocessing(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.utility.verify_webhook_signature.return_value = True
        mock_get_client.return_value = mock_client

        client = Client()
        event_id = "evt_dedup_test_123"
        payload_data = {
            "id": event_id,
            "event": "payment.failed",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_dedup_1",
                        "error_description": "First attempt failed",
                        "notes": {"invoice_id": "9999"}
                    }
                }
            }
        }
        body = json.dumps(payload_data).encode('utf-8')
        sig = generate_webhook_signature(body)

        response1 = client.post(
            "/api/billing/webhook/",
            data=body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=sig,
            HTTP_X_RAZORPAY_EVENT_ID=event_id
        )
        assert response1.status_code == 200
        assert WebhookEvent.objects.filter(event_id=event_id).count() == 1

        response2 = client.post(
            "/api/billing/webhook/",
            data=body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=sig,
            HTTP_X_RAZORPAY_EVENT_ID=event_id
        )
        assert response2.status_code == 200
        assert "Event already processed" in response2.content.decode()
        assert WebhookEvent.objects.filter(event_id=event_id).count() == 1

    @patch("apps.billing.webhooks.handle_payment_failed")
    @patch("apps.billing.razorpay_client.get_razorpay_client")
    def test_webhook_handler_exception_returns_200_to_prevent_retry_storm(self, mock_get_client, mock_handler):
        mock_client = MagicMock()
        mock_client.utility.verify_webhook_signature.return_value = True
        mock_get_client.return_value = mock_client

        mock_handler.side_effect = Exception("Unexpected Database Failure")

        client = Client()
        event_id = "evt_exception_test_456"
        payload_data = {
            "id": event_id,
            "event": "payment.failed",
            "payload": {
                "payment": {
                    "entity": {"id": "pay_crash"}
                }
            }
        }
        body = json.dumps(payload_data).encode('utf-8')
        sig = generate_webhook_signature(body)

        response = client.post(
            "/api/billing/webhook/",
            data=body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=sig,
            HTTP_X_RAZORPAY_EVENT_ID=event_id
        )

        assert response.status_code == 200
        assert "Error processing event" in response.content.decode()
        assert "Unexpected Database Failure" in response.content.decode()

    # 1. payment.failed: last_failure_reason populated, status unchanged, no premature cancellation
    @patch("apps.billing.razorpay_client.get_razorpay_client")
    def test_payment_failed_populates_reason_status_unchanged_no_cancellation(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.utility.verify_webhook_signature.return_value = True
        mock_get_client.return_value = mock_client

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")

        doctor_user = DoctorFactory()
        doctor = getattr(doctor_user, 'doctor_profile', None) or Doctor.objects.create(user=doctor_user)
        doctor_clinic = DoctorClinic.objects.create(doctor=doctor, clinic=clinic, consultation_fee=Decimal("500.00"))

        appt = Appointment.objects.create(
            patient=patient,
            doctor_clinic=doctor_clinic,
            clinic=clinic,
            appointment_date=datetime.date(2026, 8, 10),
            start_time=datetime.time(10, 0),
            end_time=datetime.time(10, 30),
            status="SCHEDULED",
            payment_flow="pay_now"
        )
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            appointment=appt,
            amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            status="pending",
            razorpay_payment_link_id="pl_fail_test"
        )

        body = json.dumps({
            "id": "evt_pf_01",
            "event": "payment.failed",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_failed_11",
                        "payment_link_id": "pl_fail_test",
                        "error_description": "Card expired",
                        "notes": {"invoice_id": str(invoice.id)}
                    }
                }
            }
        }).encode('utf-8')
        sig = generate_webhook_signature(body)

        res = Client().post("/api/billing/webhook/", data=body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=sig, HTTP_X_RAZORPAY_EVENT_ID="evt_pf_01")
        assert res.status_code == 200

        invoice.refresh_from_db()
        appt.refresh_from_db()

        assert invoice.last_failure_reason == "Card expired"
        assert invoice.status == "pending"  # Unchanged
        assert appt.status == "SCHEDULED"  # NOT prematurely cancelled

    # 2. payment.authorized on a pending invoice: transitions to paid via apply_ledger_entry (exactly 1 ledger entry)
    @patch("apps.billing.razorpay_client.get_razorpay_client")
    def test_payment_authorized_on_pending_invoice_creates_single_ledger_entry(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.utility.verify_webhook_signature.return_value = True
        mock_get_client.return_value = mock_client

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("600.00"),
            total_amount=Decimal("600.00"),
            status="pending",
            razorpay_payment_link_id="pl_auth_single"
        )

        initial_ledger_count = PaymentLedgerEntry.objects.count()

        body = json.dumps({
            "id": "evt_pa_01",
            "event": "payment.authorized",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_auth_single_1",
                        "method": "upi",
                        "notes": {"invoice_id": str(invoice.id)}
                    }
                }
            }
        }).encode('utf-8')
        sig = generate_webhook_signature(body)

        res = Client().post("/api/billing/webhook/", data=body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=sig, HTTP_X_RAZORPAY_EVENT_ID="evt_pa_01")
        assert res.status_code == 200

        invoice.refresh_from_db()
        assert invoice.status == "paid"
        assert PaymentLedgerEntry.objects.filter(invoice=invoice).count() == 1
        assert PaymentLedgerEntry.objects.count() == initial_ledger_count + 1

    # 3. payment.authorized on an already-paid invoice: no duplicate ledger entry, no error
    @patch("apps.billing.razorpay_client.get_razorpay_client")
    def test_payment_authorized_on_already_paid_invoice_no_duplicate_ledger_entry(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.utility.verify_webhook_signature.return_value = True
        mock_get_client.return_value = mock_client

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("600.00"),
            total_amount=Decimal("600.00"),
            status="paid"
        )

        initial_ledger_count = PaymentLedgerEntry.objects.count()

        body = json.dumps({
            "id": "evt_pa_dup_01",
            "event": "payment.authorized",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_auth_dup_1",
                        "notes": {"invoice_id": str(invoice.id)}
                    }
                }
            }
        }).encode('utf-8')
        sig = generate_webhook_signature(body)

        res = Client().post("/api/billing/webhook/", data=body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=sig, HTTP_X_RAZORPAY_EVENT_ID="evt_pa_dup_01")
        assert res.status_code == 200

        invoice.refresh_from_db()
        assert invoice.status == "paid"
        assert PaymentLedgerEntry.objects.count() == initial_ledger_count

    # 4. payment.authorized on an expired/cancelled invoice: error logged, status NOT changed to paid
    @patch("apps.billing.razorpay_client.get_razorpay_client")
    def test_payment_authorized_on_cancelled_invoice_flags_reconciliation(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.utility.verify_webhook_signature.return_value = True
        mock_get_client.return_value = mock_client

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("600.00"),
            total_amount=Decimal("600.00"),
            status="cancelled"
        )

        initial_ledger_count = PaymentLedgerEntry.objects.count()

        body = json.dumps({
            "id": "evt_pa_canc_01",
            "event": "payment.authorized",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_auth_canc_1",
                        "notes": {"invoice_id": str(invoice.id)}
                    }
                }
            }
        }).encode('utf-8')
        sig = generate_webhook_signature(body)

        res = Client().post("/api/billing/webhook/", data=body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=sig, HTTP_X_RAZORPAY_EVENT_ID="evt_pa_canc_01")
        assert res.status_code == 200

        invoice.refresh_from_db()
        assert invoice.status == "cancelled"  # NOT silently marked paid
        assert PaymentLedgerEntry.objects.count() == initial_ledger_count
        assert "manual reconciliation" in invoice.last_failure_reason.lower()

    # 5. refund.processed: paid -> refunded, correct ledger entry with entry_type='credit'
    @patch("apps.billing.razorpay_client.get_razorpay_client")
    def test_refund_processed_paid_to_refunded_credit_ledger_entry(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.utility.verify_webhook_signature.return_value = True
        mock_get_client.return_value = mock_client

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("700.00"),
            total_amount=Decimal("700.00"),
            status="paid",
            razorpay_payment_id="pay_refund_proc_700"
        )

        body = json.dumps({
            "id": "evt_rf_proc_01",
            "event": "refund.processed",
            "payload": {
                "refund": {
                    "entity": {
                        "id": "rfnd_proc_100",
                        "payment_id": "pay_refund_proc_700",
                        "amount": 70000
                    }
                }
            }
        }).encode('utf-8')
        sig = generate_webhook_signature(body)

        res = Client().post("/api/billing/webhook/", data=body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=sig, HTTP_X_RAZORPAY_EVENT_ID="evt_rf_proc_01")
        assert res.status_code == 200

        invoice.refresh_from_db()
        assert invoice.status == "refunded"
        assert invoice.refund_id == "rfnd_proc_100"

        entry = PaymentLedgerEntry.objects.latest('created_at')
        assert entry.entry_type == "credit"
        assert entry.resulting_status == "refunded"
        assert entry.amount == Decimal("700.00")

    # 6. refund.processed received twice: no duplicate ledger entry, no exception
    @patch("apps.billing.razorpay_client.get_razorpay_client")
    def test_refund_processed_received_twice_no_duplicate_ledger_entry(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.utility.verify_webhook_signature.return_value = True
        mock_get_client.return_value = mock_client

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("800.00"),
            total_amount=Decimal("800.00"),
            status="refunded",
            razorpay_payment_id="pay_refund_dup_800"
        )

        initial_ledger_count = PaymentLedgerEntry.objects.count()

        body = json.dumps({
            "id": "evt_rf_dup_01",
            "event": "refund.processed",
            "payload": {
                "refund": {
                    "entity": {
                        "id": "rfnd_dup_200",
                        "payment_id": "pay_refund_dup_800",
                        "amount": 80000
                    }
                }
            }
        }).encode('utf-8')
        sig = generate_webhook_signature(body)

        res = Client().post("/api/billing/webhook/", data=body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=sig, HTTP_X_RAZORPAY_EVENT_ID="evt_rf_dup_01")
        assert res.status_code == 200

        invoice.refresh_from_db()
        assert invoice.status == "refunded"
        assert PaymentLedgerEntry.objects.count() == initial_ledger_count

    # 7. refund.failed: invoice status remains 'paid', no ledger entry created
    @patch("apps.billing.razorpay_client.get_razorpay_client")
    def test_refund_failed_keeps_paid_status_no_ledger_entry(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.utility.verify_webhook_signature.return_value = True
        mock_get_client.return_value = mock_client

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("900.00"),
            total_amount=Decimal("900.00"),
            status="paid",
            razorpay_payment_id="pay_refund_fail_900"
        )

        initial_ledger_count = PaymentLedgerEntry.objects.count()

        body = json.dumps({
            "id": "evt_rf_fail_01",
            "event": "refund.failed",
            "payload": {
                "refund": {
                    "entity": {
                        "id": "rfnd_fail_300",
                        "payment_id": "pay_refund_fail_900",
                        "error_description": "Insufficient merchant balance"
                    }
                }
            }
        }).encode('utf-8')
        sig = generate_webhook_signature(body)

        res = Client().post("/api/billing/webhook/", data=body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=sig, HTTP_X_RAZORPAY_EVENT_ID="evt_rf_fail_01")
        assert res.status_code == 200

        invoice.refresh_from_db()
        assert invoice.status == "paid"  # Unchanged
        assert PaymentLedgerEntry.objects.count() == initial_ledger_count
        assert "rfnd_fail_300" in invoice.last_failure_reason

    # 8. payment_method fix: simulate payment_link.paid webhook with method='card', confirm payment_method ends up 'card' not 'upi'
    @patch("apps.billing.razorpay_client.get_razorpay_client")
    def test_payment_link_paid_extracts_card_payment_method(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.utility.verify_webhook_signature.return_value = True
        mock_get_client.return_value = mock_client

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("1500.00"),
            total_amount=Decimal("1500.00"),
            status="pending",
            razorpay_payment_link_id="pl_card_test_999"
        )

        body = json.dumps({
            "id": "evt_pl_paid_card",
            "event": "payment_link.paid",
            "payload": {
                "payment_link": {
                    "entity": {
                        "id": "pl_card_test_999"
                    }
                },
                "payment": {
                    "entity": {
                        "id": "pay_card_real_555",
                        "method": "card",
                        "created_at": 1700000000
                    }
                }
            }
        }).encode('utf-8')
        sig = generate_webhook_signature(body)

        res = Client().post("/api/billing/webhook/", data=body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=sig, HTTP_X_RAZORPAY_EVENT_ID="evt_pl_paid_card")
        assert res.status_code == 200

        invoice.refresh_from_db()
        assert invoice.status == "paid"
        assert invoice.payment_method == "card"  # Must be 'card', NOT hardcoded 'upi'
        assert invoice.razorpay_payment_id == "pay_card_real_555"

    def test_refund_processed_webhook_partial_and_full_refund_request(self):
        from apps.billing.webhooks import handle_refund_processed
        from apps.billing.models import RefundRequest

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            status="paid",
            razorpay_payment_id="pay_mult_rfnd_1000"
        )

        req1 = RefundRequest.objects.create(
            invoice=invoice,
            requested_by=user,
            amount=Decimal("400.00"),
            reason="Partial 1",
            status="processing",
            razorpay_refund_id="rfnd_part_1"
        )

        # 1st partial refund webhook (400 / 1000)
        handle_refund_processed({"id": "rfnd_part_1", "payment_id": "pay_mult_rfnd_1000"})

        req1.refresh_from_db()
        invoice.refresh_from_db()
        assert req1.status == "completed"
        assert invoice.status == "paid"  # Remaining balance 600 > 0, status remains 'paid'

        req2 = RefundRequest.objects.create(
            invoice=invoice,
            requested_by=user,
            amount=Decimal("600.00"),
            reason="Partial 2",
            status="processing",
            razorpay_refund_id="rfnd_part_2"
        )

        # 2nd partial refund webhook (600 / 1000, cumulative 1000)
        handle_refund_processed({"id": "rfnd_part_2", "payment_id": "pay_mult_rfnd_1000"})

        req2.refresh_from_db()
        invoice.refresh_from_db()
        assert req2.status == "completed"
        assert invoice.status == "refunded"  # Full amount refunded, status transitions to 'refunded'

    def test_refund_failed_webhook_with_refund_request(self):
        from apps.billing.webhooks import handle_refund_failed
        from apps.billing.models import RefundRequest
        from apps.notifications.models import Notification

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            status="paid",
            razorpay_payment_id="pay_rfnd_fail_500"
        )

        req = RefundRequest.objects.create(
            invoice=invoice,
            requested_by=user,
            amount=Decimal("500.00"),
            reason="Refund failure test",
            status="processing",
            razorpay_refund_id="rfnd_fail_req_999"
        )

        handle_refund_failed({
            "id": "rfnd_fail_req_999",
            "payment_id": "pay_rfnd_fail_500",
            "error_description": "Bank network timeout"
        })

        req.refresh_from_db()
        invoice.refresh_from_db()
        assert req.status == "failed"
        assert invoice.status == "paid"
        assert Notification.objects.filter(recipient=user, title="Refund Failed Alert").exists()

