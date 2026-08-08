import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import TestCase, TransactionTestCase
from django.db import connection
from rest_framework.test import APIClient
from apps.billing.models import Invoice, RefundRequest, PaymentIdempotencyKey
from apps.billing.services import initiate_refund, approve_refund, reject_refund, _process_refund
from apps.billing.webhooks import handle_refund_processed
from apps.core.factories import ClinicFactory, PatientFactory, UserFactory
from apps.patients.models import Patient


@pytest.mark.django_db
class TestRefundsComprehensive(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.clinic_a = ClinicFactory()
        self.clinic_b = ClinicFactory()

        self.receptionist_a = UserFactory(clinic=self.clinic_a, role='RECEPTIONIST')
        self.admin_a = UserFactory(clinic=self.clinic_a, role='CLINIC_ADMIN')
        self.admin_b = UserFactory(clinic=self.clinic_b, role='CLINIC_ADMIN')

        self.patient_user = PatientFactory()
        self.patient = getattr(self.patient_user, 'patient_profile', None) or Patient.objects.create(user=self.patient_user, phone="1234567890")

        self.invoice_a = Invoice.objects.create(
            clinic=self.clinic_a,
            patient=self.patient,
            amount=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            status="paid",
            razorpay_payment_id="pay_clinic_a_1000"
        )

    @patch("apps.billing.services.get_razorpay_client")
    def test_admin_initiated_refund_auto_approves_large_amount(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.payment.refund.return_value = {"id": "rfnd_admin_large"}
        mock_get_client.return_value = mock_client

        req = initiate_refund(
            self.invoice_a,
            amount=Decimal("800.00"),  # > 500 threshold
            reason="Admin large refund",
            requested_by=self.admin_a
        )

        assert req.status == "processing"
        assert req.approved_by == self.admin_a
        assert req.razorpay_refund_id == "rfnd_admin_large"
        assert mock_client.payment.refund.call_count == 1

    @patch("apps.billing.services.get_razorpay_client")
    def test_receptionist_initiated_refund_under_threshold_auto_approves(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.payment.refund.return_value = {"id": "rfnd_recep_small"}
        mock_get_client.return_value = mock_client

        req = initiate_refund(
            self.invoice_a,
            amount=Decimal("300.00"),  # <= 500 threshold
            reason="Receptionist small refund",
            requested_by=self.receptionist_a
        )

        assert req.status == "processing"
        assert req.approved_by == self.receptionist_a
        assert req.razorpay_refund_id == "rfnd_recep_small"
        assert mock_client.payment.refund.call_count == 1

    @patch("apps.billing.services.get_razorpay_client")
    def test_receptionist_initiated_refund_over_threshold_pending_approval(self, mock_get_client):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        req = initiate_refund(
            self.invoice_a,
            amount=Decimal("700.00"),  # > 500 threshold
            reason="Receptionist large refund",
            requested_by=self.receptionist_a
        )

        assert req.status == "pending_approval"
        assert req.approved_by is None
        assert req.razorpay_refund_id == ""
        assert mock_client.payment.refund.call_count == 0

    @patch("apps.billing.services.get_razorpay_client")
    def test_admin_approving_pending_request_triggers_processing(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.payment.refund.return_value = {"id": "rfnd_approved_123"}
        mock_get_client.return_value = mock_client

        req = RefundRequest.objects.create(
            invoice=self.invoice_a,
            requested_by=self.receptionist_a,
            amount=Decimal("700.00"),
            reason="Waiting approval",
            status="pending_approval"
        )

        res = approve_refund(req, approved_by=self.admin_a)

        assert res.status == "processing"
        assert res.approved_by == self.admin_a
        assert res.razorpay_refund_id == "rfnd_approved_123"
        assert mock_client.payment.refund.call_count == 1

    @patch("apps.billing.services.get_razorpay_client")
    def test_admin_rejecting_pending_request(self, mock_get_client):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        req = RefundRequest.objects.create(
            invoice=self.invoice_a,
            requested_by=self.receptionist_a,
            amount=Decimal("700.00"),
            reason="Waiting approval",
            status="pending_approval"
        )

        reject_refund(req, rejected_by=self.admin_a, rejection_reason="Invalid policy")

        req.refresh_from_db()
        assert req.status == "rejected"
        assert req.approved_by == self.admin_a
        assert mock_client.payment.refund.call_count == 0

    def test_exceeding_refundable_balance_raises_error_no_side_effects(self):
        RefundRequest.objects.create(
            invoice=self.invoice_a,
            requested_by=self.receptionist_a,
            amount=Decimal("400.00"),
            reason="Prior refund",
            status="completed",
            razorpay_refund_id="rfnd_prior"
        )

        initial_count = RefundRequest.objects.count()

        with pytest.raises(ValueError) as exc_info:
            initiate_refund(
                self.invoice_a,
                amount=Decimal("700.00"),
                reason="Exceeding refund",
                requested_by=self.receptionist_a
            )

        assert "would exceed remaining refundable balance" in str(exc_info.value)
        assert RefundRequest.objects.count() == initial_count

    @patch("apps.billing.services.get_razorpay_client")
    def test_process_refund_idempotency_calls_razorpay_once(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.payment.refund.return_value = {"id": "rfnd_idem_555"}
        mock_get_client.return_value = mock_client

        req = RefundRequest.objects.create(
            invoice=self.invoice_a,
            requested_by=self.admin_a,
            amount=Decimal("200.00"),
            reason="Testing idempotency",
            status="processing"
        )

        _process_refund(req)
        assert mock_client.payment.refund.call_count == 1

        _process_refund(req)
        assert mock_client.payment.refund.call_count == 1

    def test_cumulative_partial_refunds_webhook_transitions(self):
        req1 = RefundRequest.objects.create(
            invoice=self.invoice_a,
            requested_by=self.receptionist_a,
            amount=Decimal("400.00"),
            reason="Partial 1",
            status="processing",
            razorpay_refund_id="rfnd_cum_1"
        )

        handle_refund_processed({"id": "rfnd_cum_1", "payment_id": "pay_clinic_a_1000"})

        req1.refresh_from_db()
        self.invoice_a.refresh_from_db()
        assert req1.status == "completed"
        assert self.invoice_a.status == "paid"

        req2 = RefundRequest.objects.create(
            invoice=self.invoice_a,
            requested_by=self.receptionist_a,
            amount=Decimal("600.00"),
            reason="Partial 2",
            status="processing",
            razorpay_refund_id="rfnd_cum_2"
        )

        handle_refund_processed({"id": "rfnd_cum_2", "payment_id": "pay_clinic_a_1000"})

        req2.refresh_from_db()
        self.invoice_a.refresh_from_db()
        assert req2.status == "completed"
        assert self.invoice_a.status == "refunded"

    def test_tenant_isolation_admin_b_cannot_approve_clinic_a_refund(self):
        req = RefundRequest.objects.create(
            invoice=self.invoice_a,
            requested_by=self.receptionist_a,
            amount=Decimal("700.00"),
            reason="Clinic A refund pending",
            status="pending_approval"
        )

        self.client.force_authenticate(user=self.admin_b)
        response = self.client.post(f"/api/billing/refunds/{req.id}/approve/")

        assert response.status_code == 403
        req.refresh_from_db()
        assert req.status == "pending_approval"


import time
import threading

@pytest.mark.django_db(transaction=True)
class TestRefundConcurrency(TransactionTestCase):
    """
    Verifies that initiate_refund uses select_for_update() inside transaction.atomic()
    to serialize concurrent balance checks and prevent over-refunding races.
    """

    @patch("apps.billing.services.get_razorpay_client")
    def test_concurrent_initiate_refund_prevents_over_refunding(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.payment.refund.return_value = {"id": "rfnd_concurrent_123"}
        mock_get_client.return_value = mock_client

        clinic = ClinicFactory()
        user = UserFactory(clinic=clinic, role='CLINIC_ADMIN')
        patient_user = PatientFactory()
        patient = getattr(patient_user, 'patient_profile', None) or Patient.objects.create(user=patient_user, phone="9998887776")

        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            status="paid",
            razorpay_payment_id="pay_race_1000"
        )

        results = []
        errors = []

        def thread_task(amount_val):
            try:
                req = initiate_refund(
                    invoice,
                    amount=Decimal(amount_val),
                    reason="Concurrent refund race test",
                    requested_by=user
                )
                results.append(req)
            except ValueError as ve:
                results.append(str(ve))
            except Exception as e:
                if connection.vendor == 'sqlite' and ("locked" in str(e) or "lock" in str(e)):
                    results.append("sqlite_locked")
                else:
                    errors.append(e)

        t1 = threading.Thread(target=thread_task, args=("600.00",))
        t2 = threading.Thread(target=thread_task, args=("600.00",))

        t1.start()
        t2.start()

        t1.join(timeout=5)
        t2.join(timeout=5)

        assert not errors, f"Unexpected errors in threads: {errors}"

        successes = [r for r in results if isinstance(r, RefundRequest)]
        value_errors = [r for r in results if isinstance(r, str) and "would exceed remaining refundable balance" in r]
        sqlite_locks = [r for r in results if r == "sqlite_locked"]

        assert len(successes) == 1, f"Expected exactly 1 successful refund, got {len(successes)}"
        assert len(value_errors) == 1 or len(sqlite_locks) == 1, f"Expected 1 balance error or SQLite lock, got {results}"

        refund_requests = RefundRequest.objects.filter(invoice=invoice)
        assert refund_requests.count() == 1
        assert refund_requests.first().amount == Decimal("600.00")

