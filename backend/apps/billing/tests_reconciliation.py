import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.utils import timezone
from apps.billing.models import Invoice, SubscriptionInvoice, PaymentLedgerEntry
from apps.billing.services import reconcile_invoice_with_razorpay, reconcile_subscription_invoice_with_razorpay, confirm_appointment_for_invoice
from apps.core.factories import ClinicFactory, PatientFactory, UserFactory, DoctorFactory
from apps.patients.models import Patient
from apps.appointments.models import Appointment
from apps.doctors.models import Doctor, DoctorClinic
from apps.subscriptions.models import Subscription


@pytest.mark.django_db
class TestReconciliationService:

    def test_reconcile_invoice_non_pending_returns_false(self):
        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            status="paid",
            razorpay_payment_link_id="pl_reconcile_paid"
        )
        assert reconcile_invoice_with_razorpay(invoice) is False

    @patch("apps.billing.services.get_razorpay_client")
    def test_reconcile_invoice_razorpay_unpaid_returns_false(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.payment_link.fetch.return_value = {
            "id": "pl_reconcile_unpaid",
            "status": "created",
            "payments": []
        }
        mock_get_client.return_value = mock_client

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            status="pending",
            razorpay_payment_link_id="pl_reconcile_unpaid"
        )

        result = reconcile_invoice_with_razorpay(invoice)
        assert result is False
        invoice.refresh_from_db()
        assert invoice.status == "pending"

    @patch("apps.billing.services.get_razorpay_client")
    def test_reconcile_invoice_razorpay_api_exception_handled_gracefully(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.payment_link.fetch.side_effect = Exception("Razorpay API Outage")
        mock_get_client.return_value = mock_client

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")
        invoice = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            status="pending",
            razorpay_payment_link_id="pl_reconcile_err"
        )

        # Should handle exception gracefully without crashing, return False, leave invoice pending
        result = reconcile_invoice_with_razorpay(invoice)
        assert result is False
        invoice.refresh_from_db()
        assert invoice.status == "pending"


    @patch("apps.billing.services.get_razorpay_client")
    def test_reconcile_invoice_razorpay_paid_reconciles_and_confirms_appointment(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.payment_link.fetch.return_value = {
            "id": "pl_reconcile_ok",
            "status": "paid",
            "payments": [
                {
                    "id": "pay_reconciled_999",
                    "method": "card",
                    "created_at": 1700000000
                }
            ]
        }
        mock_get_client.return_value = mock_client

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")

        doctor_user = DoctorFactory()
        doctor = getattr(doctor_user, 'doctor_profile', None) or Doctor.objects.create(user=doctor_user)
        doctor_clinic = DoctorClinic.objects.create(doctor=doctor, clinic=clinic, consultation_fee=Decimal("500.00"))

        import datetime
        appt = Appointment.objects.create(
            patient=patient,
            doctor_clinic=doctor_clinic,
            clinic=clinic,
            appointment_date=datetime.date(2026, 8, 12),
            start_time=datetime.time(14, 0),
            end_time=datetime.time(14, 30),
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
            razorpay_payment_link_id="pl_reconcile_ok"
        )

        initial_ledger_count = PaymentLedgerEntry.objects.count()

        result = reconcile_invoice_with_razorpay(invoice)
        assert result is True

        invoice.refresh_from_db()
        appt.refresh_from_db()

        assert invoice.status == "paid"
        assert invoice.payment_method == "card"
        assert invoice.razorpay_payment_id == "pay_reconciled_999"
        assert appt.status == "CONFIRMED"
        assert PaymentLedgerEntry.objects.count() == initial_ledger_count + 1

    @patch("apps.billing.tasks.generate_b2b_invoice_pdf.delay")
    @patch("apps.billing.services.get_razorpay_client")
    def test_reconcile_subscription_invoice_paid(self, mock_get_client, mock_pdf_delay):
        mock_client = MagicMock()
        mock_client.payment.fetch.return_value = {
            "id": "pay_sub_reconciled_123",
            "status": "captured"
        }
        mock_get_client.return_value = mock_client

        clinic = ClinicFactory()
        sub = clinic.subscription
        sub_invoice = SubscriptionInvoice.objects.create(
            subscription=sub,
            clinic=clinic,
            invoice_number="INV-SUB-REC-01",
            amount_before_gst=Decimal("1000.00"),
            cgst=Decimal("90.00"),
            sgst=Decimal("90.00"),
            total_amount=Decimal("1180.00"),
            status="pending",
            razorpay_payment_id="pay_sub_reconciled_123",
            period_start=timezone.now(),
            period_end=timezone.now()
        )

        result = reconcile_subscription_invoice_with_razorpay(sub_invoice)
        assert result is True

        sub_invoice.refresh_from_db()
        sub.refresh_from_db()

        assert sub_invoice.status == "paid"
        assert sub.status == "active"
        mock_pdf_delay.assert_called_once_with(sub_invoice.id)

    @patch("apps.billing.services.get_razorpay_client")
    def test_reconcile_pending_payments_task(self, mock_get_client):
        from datetime import timedelta
        from apps.billing.tasks import reconcile_pending_payments

        mock_client = MagicMock()
        mock_client.payment_link.fetch.return_value = {
            "id": "pl_stale_paid",
            "status": "paid",
            "payments": [{"id": "pay_stale_123", "method": "upi", "created_at": 1700000000}]
        }
        mock_get_client.return_value = mock_client

        clinic = ClinicFactory()
        user = PatientFactory()
        patient = getattr(user, 'patient_profile', None) or Patient.objects.create(user=user, phone="1234567890")

        # Fresh pending invoice (< 3 mins old) — should NOT be reconciled yet
        fresh_inv = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("300.00"),
            total_amount=Decimal("300.00"),
            status="pending",
            razorpay_payment_link_id="pl_fresh_123"
        )

        # Stale pending invoice (> 3 mins old) — SHOULD be reconciled
        stale_inv = Invoice.objects.create(
            clinic=clinic,
            patient=patient,
            amount=Decimal("400.00"),
            total_amount=Decimal("400.00"),
            status="pending",
            razorpay_payment_link_id="pl_stale_paid"
        )
        stale_inv.created_at = timezone.now() - timedelta(minutes=5)
        stale_inv.save(update_fields=['created_at'])

        caught = reconcile_pending_payments()

        assert caught == 1
        fresh_inv.refresh_from_db()
        stale_inv.refresh_from_db()

        assert fresh_inv.status == "pending"
        assert stale_inv.status == "paid"

    @patch("apps.billing.services.get_razorpay_client")
    def test_expiry_sweep_defensive_reconciliation_prevents_cancellation(self, mock_get_client):
        from datetime import timedelta
        import datetime
        from apps.appointments.tasks import cancel_unpaid_appointments

        mock_client = MagicMock()
        mock_client.payment_link.fetch.return_value = {
            "id": "pl_expiry_race_123",
            "status": "paid",
            "payments": [{"id": "pay_expiry_race_999", "method": "card", "created_at": 1700000000}]
        }
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
            appointment_date=datetime.date(2026, 8, 15),
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
            razorpay_payment_link_id="pl_expiry_race_123",
            payment_link_expires_at=timezone.now() - timedelta(minutes=5)
        )

        cancel_unpaid_appointments()

        invoice.refresh_from_db()
        appt.refresh_from_db()

        # Defensive check caught that payment link was actually paid — prevented auto-cancellation!
        assert invoice.status == "paid"
        assert appt.status == "CONFIRMED"


