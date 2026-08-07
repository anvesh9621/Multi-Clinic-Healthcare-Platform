import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import TestCase
from rest_framework.test import APIClient
from apps.billing.models import Invoice, RefundRequest
from apps.core.factories import ClinicFactory, PatientFactory, UserFactory
from apps.patients.models import Patient


@pytest.mark.django_db
class TestRefundViews(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.clinic1 = ClinicFactory()
        self.clinic2 = ClinicFactory()

        self.receptionist1 = UserFactory(clinic=self.clinic1, role='RECEPTIONIST')
        self.admin1 = UserFactory(clinic=self.clinic1, role='CLINIC_ADMIN')
        self.admin2 = UserFactory(clinic=self.clinic2, role='CLINIC_ADMIN')
        self.patient_user = PatientFactory()
        self.patient = getattr(self.patient_user, 'patient_profile', None) or Patient.objects.create(user=self.patient_user, phone="1234567890")

        self.invoice1 = Invoice.objects.create(
            clinic=self.clinic1,
            patient=self.patient,
            amount=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            status="paid",
            razorpay_payment_id="pay_c1_1000"
        )

        self.invoice2 = Invoice.objects.create(
            clinic=self.clinic2,
            patient=self.patient,
            amount=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            status="paid",
            razorpay_payment_id="pay_c2_1000"
        )

    @patch("apps.billing.services.get_razorpay_client")
    def test_initiate_refund_receptionist_auto_approve(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.payment.refund.return_value = {"id": "rfnd_view_1"}
        mock_get_client.return_value = mock_client

        self.client.force_authenticate(user=self.receptionist1)
        res = self.client.post("/api/billing/refunds/initiate/", {
            "invoice_id": self.invoice1.id,
            "amount": "200.00",
            "reason": "Test receptionist initiate"
        })

        assert res.status_code == 201
        assert res.data["status"] == "processing"
        assert res.data["razorpay_refund_id"] == "rfnd_view_1"

    def test_initiate_refund_receptionist_pending_approval(self):
        self.client.force_authenticate(user=self.receptionist1)
        res = self.client.post("/api/billing/refunds/initiate/", {
            "invoice_id": self.invoice1.id,
            "amount": "700.00",
            "reason": "Large refund"
        })

        assert res.status_code == 201
        assert res.data["status"] == "pending_approval"

    def test_initiate_refund_tenant_isolation(self):
        # Receptionist 1 trying to refund Invoice 2 (Clinic 2) -> 404
        self.client.force_authenticate(user=self.receptionist1)
        res = self.client.post("/api/billing/refunds/initiate/", {
            "invoice_id": self.invoice2.id,
            "amount": "100.00",
            "reason": "Cross tenant attempt"
        })

        assert res.status_code == 404

    def test_initiate_refund_patient_forbidden(self):
        self.client.force_authenticate(user=self.patient_user)
        res = self.client.post("/api/billing/refunds/initiate/", {
            "invoice_id": self.invoice1.id,
            "amount": "100.00",
            "reason": "Patient attempt"
        })

        assert res.status_code == 403

    def test_pending_refund_approvals_list_scoped(self):
        req1 = RefundRequest.objects.create(
            invoice=self.invoice1,
            requested_by=self.receptionist1,
            amount=Decimal("600.00"),
            reason="Clinic 1 pending",
            status="pending_approval"
        )
        req2 = RefundRequest.objects.create(
            invoice=self.invoice2,
            requested_by=self.admin2,
            amount=Decimal("600.00"),
            reason="Clinic 2 pending",
            status="pending_approval"
        )

        self.client.force_authenticate(user=self.admin1)
        res = self.client.get("/api/billing/refunds/pending/")

        assert res.status_code == 200
        assert len(res.data) == 1
        assert res.data[0]["id"] == req1.id

    @patch("apps.billing.services.get_razorpay_client")
    def test_approve_refund_view_success_and_cross_tenant_block(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.payment.refund.return_value = {"id": "rfnd_appr_view_123"}
        mock_get_client.return_value = mock_client

        req = RefundRequest.objects.create(
            invoice=self.invoice1,
            requested_by=self.receptionist1,
            amount=Decimal("600.00"),
            reason="Needs admin approval",
            status="pending_approval"
        )

        # Admin 2 (Clinic 2) tries to approve req (Clinic 1) -> 403 Forbidden
        self.client.force_authenticate(user=self.admin2)
        res_cross = self.client.post(f"/api/billing/refunds/{req.id}/approve/")
        assert res_cross.status_code == 403

        # Admin 1 (Clinic 1) approves -> 200 OK
        self.client.force_authenticate(user=self.admin1)
        res = self.client.post(f"/api/billing/refunds/{req.id}/approve/")
        assert res.status_code == 200
        assert res.data["status"] == "processing"
        assert res.data["razorpay_refund_id"] == "rfnd_appr_view_123"

    def test_reject_refund_view_success_and_cross_tenant_block(self):
        req = RefundRequest.objects.create(
            invoice=self.invoice1,
            requested_by=self.receptionist1,
            amount=Decimal("600.00"),
            reason="Needs admin approval",
            status="pending_approval"
        )

        # Admin 2 (Clinic 2) tries to reject req (Clinic 1) -> 403 Forbidden
        self.client.force_authenticate(user=self.admin2)
        res_cross = self.client.post(f"/api/billing/refunds/{req.id}/reject/", {"rejection_reason": "Not allowed"})
        assert res_cross.status_code == 403

        # Admin 1 (Clinic 1) rejects -> 200 OK
        self.client.force_authenticate(user=self.admin1)
        res = self.client.post(f"/api/billing/refunds/{req.id}/reject/", {"rejection_reason": "Policy violation"})
        assert res.status_code == 200
        assert res.data["status"] == "rejected"
