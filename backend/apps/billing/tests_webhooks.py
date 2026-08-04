import json
import hmac
import hashlib
import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import Client
from django.conf import settings
from apps.billing.models import Invoice, WebhookEvent, PaymentOutboxEvent, PaymentLedgerEntry
from apps.core.factories import ClinicFactory, PatientFactory
from apps.patients.models import Patient


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
        # Mock Razorpay signature verification
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

        # First request: processed and creates WebhookEvent row
        response1 = client.post(
            "/api/billing/webhook/",
            data=body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=sig,
            HTTP_X_RAZORPAY_EVENT_ID=event_id
        )
        assert response1.status_code == 200
        assert WebhookEvent.objects.filter(event_id=event_id).count() == 1

        # Second request with SAME event_id: returns 200 with "Event already processed"
        response2 = client.post(
            "/api/billing/webhook/",
            data=body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=sig,
            HTTP_X_RAZORPAY_EVENT_ID=event_id
        )
        assert response2.status_code == 200
        assert "Event already processed" in response2.content.decode()
        # Ensure count remains 1
        assert WebhookEvent.objects.filter(event_id=event_id).count() == 1

    @patch("apps.billing.webhooks.handle_payment_failed")
    @patch("apps.billing.razorpay_client.get_razorpay_client")
    def test_webhook_handler_exception_returns_200_to_prevent_retry_storm(self, mock_get_client, mock_handler):
        mock_client = MagicMock()
        mock_client.utility.verify_webhook_signature.return_value = True
        mock_get_client.return_value = mock_client

        # Simulate handler crashing with an unexpected error
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

        # MUST return status 200 to acknowledge receipt and avoid Razorpay retry storm
        assert response.status_code == 200
        assert "Error processing event" in response.content.decode()
        assert "Unexpected Database Failure" in response.content.decode()

    @patch("apps.billing.razorpay_client.get_razorpay_client")
    def test_all_four_new_event_types_route_through_dedup_and_dispatch(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.utility.verify_webhook_signature.return_value = True
        mock_get_client.return_value = mock_client

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")

        # 1. payment.failed
        inv_failed = Invoice.objects.create(clinic=clinic, patient=patient, amount=Decimal("100"), total_amount=Decimal("100"), status="pending")
        body = json.dumps({
            "id": "evt_failed_01",
            "event": "payment.failed",
            "payload": {"payment": {"entity": {"id": "p1", "error_description": "Declined", "notes": {"invoice_id": str(inv_failed.id)}}}}
        }).encode('utf-8')
        sig = generate_webhook_signature(body)
        res = Client().post("/api/billing/webhook/", data=body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=sig, HTTP_X_RAZORPAY_EVENT_ID="evt_failed_01")
        assert res.status_code == 200
        inv_failed.refresh_from_db()
        assert inv_failed.last_failure_reason == "Declined"

        # 2. payment.authorized
        inv_auth = Invoice.objects.create(clinic=clinic, patient=patient, amount=Decimal("200"), total_amount=Decimal("200"), status="pending")
        body = json.dumps({
            "id": "evt_auth_01",
            "event": "payment.authorized",
            "payload": {"payment": {"entity": {"id": "p2", "method": "upi", "notes": {"invoice_id": str(inv_auth.id)}}}}
        }).encode('utf-8')
        sig = generate_webhook_signature(body)
        res = Client().post("/api/billing/webhook/", data=body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=sig, HTTP_X_RAZORPAY_EVENT_ID="evt_auth_01")
        assert res.status_code == 200
        inv_auth.refresh_from_db()
        assert inv_auth.status == "paid"

        # 3. refund.processed
        inv_rfnd = Invoice.objects.create(clinic=clinic, patient=patient, amount=Decimal("300"), total_amount=Decimal("300"), status="paid", razorpay_payment_id="p3")
        body = json.dumps({
            "id": "evt_rfnd_01",
            "event": "refund.processed",
            "payload": {"refund": {"entity": {"id": "rf_1", "payment_id": "p3", "amount": 30000}}}
        }).encode('utf-8')
        sig = generate_webhook_signature(body)
        res = Client().post("/api/billing/webhook/", data=body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=sig, HTTP_X_RAZORPAY_EVENT_ID="evt_rfnd_01")
        assert res.status_code == 200
        inv_rfnd.refresh_from_db()
        assert inv_rfnd.status == "refunded"

        # 4. refund.failed
        inv_rfnd_fail = Invoice.objects.create(clinic=clinic, patient=patient, amount=Decimal("400"), total_amount=Decimal("400"), status="paid", razorpay_payment_id="p4")
        body = json.dumps({
            "id": "evt_rfnd_fail_01",
            "event": "refund.failed",
            "payload": {"refund": {"entity": {"id": "rf_fail_1", "payment_id": "p4", "error_description": "Bank system down"}}}
        }).encode('utf-8')
        sig = generate_webhook_signature(body)
        res = Client().post("/api/billing/webhook/", data=body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=sig, HTTP_X_RAZORPAY_EVENT_ID="evt_rfnd_fail_01")
        assert res.status_code == 200
        inv_rfnd_fail.refresh_from_db()
        assert inv_rfnd_fail.status == "paid"
        assert "Bank system down" in inv_rfnd_fail.last_failure_reason
