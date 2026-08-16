import hmac
import hashlib
from unittest.mock import patch, MagicMock
from decimal import Decimal
import pytest
from django.test import TestCase
from django.conf import settings
from rest_framework.test import APIClient
from apps.core.factories import ClinicFactory, PatientProfileFactory
from apps.billing.models import Invoice


@pytest.mark.django_db
class RazorpayStandardCheckoutTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.clinic = ClinicFactory()
        self.patient = PatientProfileFactory()
        self.patient.user.clinic = self.clinic
        self.patient.user.save()

        self.key_id = "rzp_test_TQ9TQdaGO2avyV"
        self.key_secret = "VsyUBiHt0b9KxVKnkf6gWpnc"

    @patch("apps.billing.views.get_razorpay_client")
    def test_create_order_success(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.order.create.return_value = {
            "id": "order_test_123456",
            "amount": 50000,
            "currency": "INR",
            "receipt": "rcpt_test_001",
            "status": "created",
        }
        mock_client.auth = (self.key_id, self.key_secret)
        mock_get_client.return_value = mock_client

        # Test both endpoint paths
        for path in ["/api/billing/create-order/", "/api/create-order/"]:
            response = self.client.post(path, {
                "amount": 50000,
                "currency": "INR",
                "receipt": "rcpt_test_001",
                "notes": {"clinic_id": self.clinic.id},
            }, format="json")

            self.assertEqual(response.status_code, 200)
            data = response.data
            self.assertTrue(data.get("success"))
            self.assertEqual(data.get("order_id"), "order_test_123456")
            self.assertEqual(data.get("amount"), 50000)
            self.assertEqual(data.get("currency"), "INR")
            self.assertEqual(data.get("key_id"), self.key_id)

    def test_create_order_missing_amount(self):
        response = self.client.post("/api/billing/create-order/", {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data.get("success"))
        self.assertIn("required", response.data.get("error", "").lower())

    def test_create_order_amount_below_minimum(self):
        response = self.client.post("/api/billing/create-order/", {"amount": 50}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data.get("success"))
        self.assertIn("100 paise", response.data.get("error", ""))

    @patch("apps.billing.views.get_razorpay_client")
    def test_create_order_api_error(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.order.create.side_effect = Exception("Razorpay gateway timeout")
        mock_get_client.return_value = mock_client

        response = self.client.post("/api/billing/create-order/", {"amount": 25000}, format="json")
        self.assertEqual(response.status_code, 500)
        self.assertFalse(response.data.get("success"))
        self.assertIn("Razorpay gateway timeout", response.data.get("error", ""))

    def test_verify_payment_missing_fields(self):
        # Missing signature
        response = self.client.post("/api/billing/verify-payment/", {
            "razorpay_order_id": "order_123",
            "razorpay_payment_id": "pay_123",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data.get("success"))
        self.assertIn("missing", response.data.get("error", "").lower())

    def test_verify_payment_invalid_signature(self):
        response = self.client.post("/api/billing/verify-payment/", {
            "razorpay_order_id": "order_valid_123",
            "razorpay_payment_id": "pay_valid_456",
            "razorpay_signature": "invalid_fake_signature_abc",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data.get("success"))
        self.assertIn("verification failed", response.data.get("error", "").lower())

    def test_verify_payment_valid_signature(self):
        order_id = "order_test_987654"
        payment_id = "pay_test_321098"

        # Generate valid HMAC-SHA256 signature
        message = f"{order_id}|{payment_id}".encode("utf-8")
        valid_signature = hmac.new(
            self.key_secret.encode("utf-8"),
            message,
            hashlib.sha256,
        ).hexdigest()

        # Test with associated invoice
        invoice = Invoice.objects.create(
            clinic=self.clinic,
            patient=self.patient,
            amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            status="pending",
        )

        for path in ["/api/billing/verify-payment/", "/api/verify-payment/"]:
            response = self.client.post(path, {
                "razorpay_order_id": order_id,
                "razorpay_payment_id": payment_id,
                "razorpay_signature": valid_signature,
                "invoice_id": invoice.id,
            }, format="json")

            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.data.get("success"))
            self.assertEqual(response.data.get("order_id"), order_id)
            self.assertEqual(response.data.get("payment_id"), payment_id)

            invoice.refresh_from_db()
            self.assertEqual(invoice.status, "paid")
            self.assertEqual(invoice.razorpay_payment_id, payment_id)
