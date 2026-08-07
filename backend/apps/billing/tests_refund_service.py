import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.conf import settings
from django.test import TestCase
from apps.billing.models import Invoice, RefundRequest, PaymentIdempotencyKey
from apps.billing.services import initiate_refund, approve_refund, reject_refund, _process_refund
from apps.core.factories import ClinicFactory, PatientFactory, UserFactory
from apps.patients.models import Patient
from apps.notifications.models import Notification


@pytest.mark.django_db
class TestRefundService(TestCase):

    def setUp(self):
        self.clinic = ClinicFactory()
        self.patient_user = PatientFactory()
        self.patient = getattr(self.patient_user, 'patient_profile', None) or Patient.objects.create(user=self.patient_user, phone="1234567890")
        
        self.receptionist = UserFactory(clinic=self.clinic, role='RECEPTIONIST')
        self.clinic_admin = UserFactory(clinic=self.clinic, role='CLINIC_ADMIN')

        self.paid_invoice = Invoice.objects.create(
            clinic=self.clinic,
            patient=self.patient,
            amount=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            status="paid",
            razorpay_payment_id="pay_refund_test_123"
        )

        self.pending_invoice = Invoice.objects.create(
            clinic=self.clinic,
            patient=self.patient,
            amount=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            status="pending"
        )

    def test_initiate_refund_unpaid_invoice_raises_error(self):
        with pytest.raises(ValueError) as exc_info:
            initiate_refund(self.pending_invoice, amount=Decimal("100.00"), reason="Cancelled", requested_by=self.receptionist)
        assert "Cannot refund invoice in status pending" in str(exc_info.value)

    def test_initiate_refund_exceeding_balance_raises_error(self):
        with pytest.raises(ValueError) as exc_info:
            initiate_refund(self.paid_invoice, amount=Decimal("1500.00"), reason="Too high", requested_by=self.receptionist)
        assert "would exceed remaining refundable balance" in str(exc_info.value)

    @patch("apps.billing.services.get_razorpay_client")
    def test_initiate_refund_auto_approves_below_threshold(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.payment.refund.return_value = {"id": "rfnd_auto_123"}
        mock_get_client.return_value = mock_client

        # Amount 300 <= threshold (500) -> auto approve for receptionist
        req = initiate_refund(self.paid_invoice, amount=Decimal("300.00"), reason="Partial refund", requested_by=self.receptionist)

        assert req.status == "processing"
        assert req.approved_by == self.receptionist
        assert req.razorpay_refund_id == "rfnd_auto_123"
        assert PaymentIdempotencyKey.objects.filter(key=f"refund-{req.id}", status="completed").exists()

    def test_initiate_refund_requires_approval_above_threshold(self):
        # Amount 700 > threshold (500) for receptionist -> pending_approval
        req = initiate_refund(self.paid_invoice, amount=Decimal("700.00"), reason="Large refund", requested_by=self.receptionist)

        assert req.status == "pending_approval"
        assert req.approved_by is None
        assert req.razorpay_refund_id == ""

    @patch("apps.billing.services.get_razorpay_client")
    def test_initiate_refund_clinic_admin_always_auto_approves(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.payment.refund.return_value = {"id": "rfnd_admin_123"}
        mock_get_client.return_value = mock_client

        # Amount 800 > threshold (500), but requested_by is CLINIC_ADMIN -> auto approve
        req = initiate_refund(self.paid_invoice, amount=Decimal("800.00"), reason="Admin refund", requested_by=self.clinic_admin)

        assert req.status == "processing"
        assert req.approved_by == self.clinic_admin
        assert req.razorpay_refund_id == "rfnd_admin_123"

    @patch("apps.billing.services.get_razorpay_client")
    def test_approve_refund_processes_payment(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.payment.refund.return_value = {"id": "rfnd_appr_456"}
        mock_get_client.return_value = mock_client

        req = RefundRequest.objects.create(
            invoice=self.paid_invoice,
            requested_by=self.receptionist,
            amount=Decimal("700.00"),
            reason="Waiting approval",
            status="pending_approval"
        )

        res = approve_refund(req, approved_by=self.clinic_admin)

        assert res.status == "processing"
        assert res.approved_by == self.clinic_admin
        assert res.razorpay_refund_id == "rfnd_appr_456"

    def test_reject_refund_notifies_requested_by(self):
        req = RefundRequest.objects.create(
            invoice=self.paid_invoice,
            requested_by=self.receptionist,
            amount=Decimal("700.00"),
            reason="Waiting approval",
            status="pending_approval"
        )

        reject_refund(req, rejected_by=self.clinic_admin, rejection_reason="Not eligible")

        req.refresh_from_db()
        assert req.status == "rejected"
        assert req.approved_by == self.clinic_admin
        assert Notification.objects.filter(recipient=self.receptionist, title="Refund Request Rejected").exists()

    @patch("apps.billing.services.get_razorpay_client")
    def test_process_refund_idempotency_prevents_duplicate_api_calls(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.payment.refund.return_value = {"id": "rfnd_idempotent_123"}
        mock_get_client.return_value = mock_client

        req = RefundRequest.objects.create(
            invoice=self.paid_invoice,
            requested_by=self.clinic_admin,
            amount=Decimal("200.00"),
            reason="Testing idempotency",
            status="processing"
        )

        # First execution -> calls Razorpay
        _process_refund(req)
        assert mock_client.payment.refund.call_count == 1

        # Second execution with completed idempotency key -> skips Razorpay call
        _process_refund(req)
        assert mock_client.payment.refund.call_count == 1
