from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal
from apps.accounts.permissions import IsClinicAdminOrReceptionist, IsClinicAdmin, IsPatient
from apps.core.tenancy import get_user_clinic
from .models import Invoice, RefundRequest
from .serializers import RefundRequestSerializer
from .services import initiate_refund, approve_refund, reject_refund
from apps.billing.razorpay_client import get_razorpay_client
from apps.notifications.models import Notification
from apps.audit.services import log_action
from apps.audit.models import AuditLog
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
import time
import requests
import logging

logger = logging.getLogger(__name__)


def _notify_patient(invoice, title, message):
    """Helper: create an in-app notification for the invoice's patient."""
    try:
        if invoice.patient and invoice.patient.user:
            Notification.objects.create(
                recipient=invoice.patient.user,
                notification_type='SYSTEM',
                title=title,
                message=message,
            )
    except Exception as e:
        logger.error(f"Failed to send notification for invoice {invoice.id}: {e}")


class InvoiceListView(APIView):
    """
    GET /api/billing/invoices/
    Role-scoped:
      CLINIC_ADMIN / RECEPTIONIST → own clinic invoices
      PATIENT                    → own invoices only
      SUPER_ADMIN                → all
      DOCTOR                     → empty (403 by permission matrix enforced via empty qs)
    Supports ?status=, ?date_from=YYYY-MM-DD, ?date_to=YYYY-MM-DD
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self, request):
        user = request.user
        qs = Invoice.objects.none()

        if user.role == 'PATIENT':
            qs = Invoice.objects.filter(patient__user=user)
        elif user.role in ('CLINIC_ADMIN', 'RECEPTIONIST'):
            clinic = get_user_clinic(user)
            if not clinic:
                return qs
            qs = Invoice.objects.filter(clinic=clinic)
        elif user.role == 'SUPER_ADMIN':
            qs = Invoice.objects.all()
        # DOCTOR → stays empty

        # Filters
        status_filter = request.query_params.get('status')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        return qs.order_by('-created_at').select_related('patient__user', 'clinic', 'appointment')

    def get(self, request):
        user = request.user
        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        if user.role == 'DOCTOR':
            return paginator.get_paginated_response([])

        invoices_qs = self.get_queryset(request)
        page = paginator.paginate_queryset(invoices_qs, request)
        invoices = page if page is not None else invoices_qs

        data = []
        for inv in invoices:
            patient_name = ''
            patient_email = ''
            if inv.patient and inv.patient.user:
                patient_name = inv.patient.user.get_full_name() or inv.patient.user.email
                patient_email = inv.patient.user.email

            minutes_remaining = None
            if inv.razorpay_payment_link_id and inv.payment_link_expires_at:
                remaining = inv.payment_link_expires_at - timezone.now()
                if remaining.total_seconds() > 0:
                    minutes_remaining = int(remaining.total_seconds() / 60)

            data.append({
                'id': inv.id,
                'patient_name': patient_name,
                'patient_email': patient_email,
                'amount': str(inv.amount),
                'total_amount': str(inv.total_amount),
                'status': inv.status,
                'payment_method': inv.payment_method,
                'created_at': inv.created_at,
                'paid_at': inv.paid_at,
                'payment_link_url': inv.razorpay_payment_link_url,
                'razorpay_payment_link_short_url': inv.razorpay_payment_link_short_url,
                'payment_link_expires_at': inv.payment_link_expires_at,
                'minutes_remaining': minutes_remaining,
                'appointment_id': inv.appointment_id,
            })

        if page is not None:
            return paginator.get_paginated_response(data)
        return Response(data)


class GeneratePaymentLinkView(APIView):
    """
    POST /api/billing/invoices/{id}/generate-payment-link/
    Allowed: CLINIC_ADMIN, RECEPTIONIST, SUPER_ADMIN
    Blocked: PATIENT (use /pay/ instead), DOCTOR
    """
    permission_classes = [IsAuthenticated, IsClinicAdminOrReceptionist]

    def post(self, request, pk):
        clinic = getattr(request.user, 'clinic', None)
        if not clinic and request.user.role != 'SUPER_ADMIN':
            return Response({'error': 'No clinic associated'}, status=status.HTTP_403_FORBIDDEN)

        try:
            if request.user.role == 'SUPER_ADMIN':
                invoice = Invoice.objects.get(id=pk)
            else:
                invoice = Invoice.objects.get(id=pk, clinic=clinic)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=status.HTTP_404_NOT_FOUND)

        # --- Validation checks ---
        if invoice.status == 'paid':
            return Response({'error': 'This invoice is already paid.'}, status=status.HTTP_400_BAD_REQUEST)

        if invoice.status == 'cancelled':
            return Response({'error': 'Cannot generate a payment link for a cancelled invoice.'}, status=status.HTTP_400_BAD_REQUEST)

        if invoice.payment_method == 'cash':
            return Response({'error': 'This invoice was already settled in cash.'}, status=status.HTTP_400_BAD_REQUEST)

        # Return existing valid link if still within expiry
        if invoice.razorpay_payment_link_id and invoice.payment_link_expires_at:
            if invoice.payment_link_expires_at > timezone.now():
                remaining = invoice.payment_link_expires_at - timezone.now()
                minutes_remaining = int(remaining.total_seconds() / 60)
                return Response({
                    'payment_link_url': invoice.razorpay_payment_link_url,
                    'short_url': invoice.razorpay_payment_link_short_url,
                    'expires_at': invoice.payment_link_expires_at,
                    'minutes_remaining': minutes_remaining,
                    'reused': True,
                    'qr_instructions': f'Show this QR to the patient. They scan with any UPI app to pay ₹{invoice.total_amount}.'
                })

        if not invoice.clinic.razorpay_linked_account_id:
            return Response(
                {'error': 'Clinic bank account not linked. Please complete bank onboarding first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        client = get_razorpay_client()
        amount_paise = int(invoice.total_amount * 100)
        expires_at = timezone.now() + timedelta(hours=24)

        payload = {
            "amount": amount_paise,
            "currency": "INR",
            "accept_partial": False,
            "description": f"Invoice for Appointment at {invoice.clinic.name}",
            "customer": {
                "name": invoice.patient.user.get_full_name() if invoice.patient and invoice.patient.user else "",
                "email": invoice.patient.user.email if invoice.patient and invoice.patient.user else "",
                "contact": getattr(invoice.patient.user, 'phone_number', '') if invoice.patient and invoice.patient.user else "",
            },
            "notify": {"sms": True, "email": True},
            "reminder_enable": True,
            "expire_by": int(expires_at.timestamp()),
            "notes": {
                "invoice_id": str(invoice.id),
                "clinic_id": str(invoice.clinic.id),
            },
            "options": {
                "order": {
                    "transfers": [{
                        "account": invoice.clinic.razorpay_linked_account_id,
                        "amount": amount_paise,
                        "currency": "INR",
                        "on_hold": 0,
                    }]
                }
            }
        }

        try:
            pl = client.payment_link.create(data=payload)
            invoice.razorpay_payment_link_id = pl['id']
            invoice.razorpay_payment_link_url = pl.get('long_url', pl.get('short_url', ''))
            invoice.razorpay_payment_link_short_url = pl.get('short_url', '')
            invoice.payment_link_status = pl['status']
            invoice.payment_link_expires_at = expires_at
            invoice.save(update_fields=[
                'razorpay_payment_link_id', 'razorpay_payment_link_url',
                'razorpay_payment_link_short_url', 'payment_link_status',
                'payment_link_expires_at'
            ])

            if invoice.status != 'pending':
                invoice.apply_ledger_entry(
                    entry_type='debit',
                    amount=invoice.total_amount,
                    resulting_status='pending',
                    source_event='view:generate_payment_link',
                    user=request.user,
                )

            return Response({
                'payment_link_url': invoice.razorpay_payment_link_url,
                'short_url': invoice.razorpay_payment_link_short_url,
                'expires_at': expires_at,
                'minutes_remaining': 1440,  # 24h
                'reused': False,
                'qr_instructions': f'Show this QR to the patient. They scan with any UPI app to pay ₹{invoice.total_amount}.'
            })
        except Exception as e:
            logger.error(f"Razorpay payment link creation failed: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MarkCashPaidView(APIView):
    """
    POST /api/billing/invoices/{id}/mark-cash-paid/
    Allowed: CLINIC_ADMIN, RECEPTIONIST (own clinic)
    """
    permission_classes = [IsAuthenticated, IsClinicAdminOrReceptionist]

    def post(self, request, pk):
        clinic = getattr(request.user, 'clinic', None)
        if not clinic:
            return Response({'error': 'No clinic associated'}, status=status.HTTP_403_FORBIDDEN)

        try:
            invoice = Invoice.objects.get(id=pk, clinic=clinic)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=status.HTTP_404_NOT_FOUND)

        # Validate state
        if invoice.status not in ('pending', 'pending_at_clinic', 'draft'):
            return Response(
                {'error': f'Invoice cannot be marked as paid. Current status: {invoice.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if invoice.payment_method == 'cash':
            return Response({'error': 'Already recorded as cash payment.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Cancel any outstanding Razorpay payment link to prevent double-payment
            if invoice.razorpay_payment_link_id:
                try:
                    client = get_razorpay_client()
                    client.payment_link.cancel(invoice.razorpay_payment_link_id)
                except Exception as e:
                    logger.error(f"Failed to cancel payment link {invoice.razorpay_payment_link_id}: {e}")
                    # Do NOT block cash recording if cancel fails

            invoice.payment_method = 'cash'
            invoice.paid_at = timezone.now()
            invoice.save(update_fields=['payment_method', 'paid_at'])

            if invoice.status == 'draft':
                invoice.apply_ledger_entry(
                    entry_type='debit',
                    amount=invoice.total_amount,
                    resulting_status='pending',
                    source_event='view:mark_cash_paid',
                    user=request.user,
                )

            invoice.apply_ledger_entry(
                entry_type='debit',
                amount=invoice.total_amount,
                resulting_status='paid',
                source_event='view:mark_cash_paid',
                user=request.user,
            )

            if invoice.appointment and invoice.appointment.status == 'SCHEDULED':
                invoice.appointment.status = 'CONFIRMED'
                invoice.appointment.save(update_fields=['status'])

            log_action(
                user=request.user,
                clinic=clinic,
                action_type=AuditLog.ActionChoices.UPDATE,
                object_type='Invoice',
                object_id=invoice.id,
                description=f'INVOICE_PAID_CASH: ₹{invoice.total_amount} collected in cash',
            )

        _notify_patient(
            invoice,
            title="Payment received",
            message=f"Cash payment of ₹{invoice.total_amount} received at {invoice.clinic.name}."
        )

        return Response({
            'id': invoice.id,
            'status': invoice.status,
            'payment_method': invoice.payment_method,
            'paid_at': invoice.paid_at,
            'total_amount': str(invoice.total_amount),
        })


class PatientPayInvoiceView(APIView):
    """
    POST /api/billing/invoices/{id}/pay/
    PATIENT only — scoped to their own invoices.
    Generates (or reuses) a 30-minute Razorpay payment link.
    """
    permission_classes = [IsAuthenticated, IsPatient]

    def post(self, request, pk):
        try:
            invoice = Invoice.objects.get(id=pk, patient__user=request.user)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=status.HTTP_404_NOT_FOUND)

        if invoice.status == 'paid':
            return Response({'error': 'This invoice is already paid.'}, status=status.HTTP_400_BAD_REQUEST)

        if invoice.status not in ('pending', 'pending_at_clinic'):
            return Response(
                {'error': f'Cannot pay invoice with status: {invoice.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Return existing valid link if unexpired
        if (invoice.razorpay_payment_link_id and
                invoice.payment_link_expires_at and
                invoice.payment_link_expires_at > timezone.now()):
            return Response({
                'payment_link_url': invoice.razorpay_payment_link_url,
                'short_url': invoice.razorpay_payment_link_short_url,
                'expires_at': invoice.payment_link_expires_at,
                'reused': True,
            })

        clinic = invoice.clinic
        if not clinic.razorpay_linked_account_id:
            return Response(
                {'error': 'This clinic has not yet set up online payments. Please pay at the clinic.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        expires_at = timezone.now() + timedelta(minutes=30)
        client = get_razorpay_client()

        try:
            payment_link = client.payment_link.create({
                'amount': int(invoice.total_amount * 100),
                'currency': 'INR',
                'description': f'Invoice #{invoice.id} — {clinic.name}',
                'expire_by': int(expires_at.timestamp()),
                'options': {
                    'order': {
                        'transfers': [{
                            'account': clinic.razorpay_linked_account_id,
                            'amount': int(invoice.total_amount * 100),
                            'currency': 'INR',
                        }]
                    }
                }
            })

            invoice.razorpay_payment_link_id = payment_link['id']
            invoice.razorpay_payment_link_url = payment_link.get('long_url', payment_link.get('short_url', ''))
            invoice.razorpay_payment_link_short_url = payment_link.get('short_url', '')
            invoice.payment_link_expires_at = expires_at
            invoice.save(update_fields=[
                'razorpay_payment_link_id', 'razorpay_payment_link_url',
                'razorpay_payment_link_short_url', 'payment_link_expires_at'
            ])

            if invoice.status != 'pending':
                invoice.apply_ledger_entry(
                    entry_type='debit',
                    amount=invoice.total_amount,
                    resulting_status='pending',
                    source_event='view:patient_pay',
                    user=request.user,
                )

            return Response({
                'payment_link_url': invoice.razorpay_payment_link_url,
                'short_url': invoice.razorpay_payment_link_short_url,
                'expires_at': expires_at.isoformat(),
                'reused': False,
            })
        except Exception as e:
            logger.error(f'Patient pay link generation failed: {e}')
            return Response(
                {'error': 'Could not generate payment link. Please try again.'},
                status=status.HTTP_502_BAD_GATEWAY
            )


class RefundInvoiceView(APIView):
    """
    POST /api/billing/invoices/{id}/refund/
    Allowed: CLINIC_ADMIN (own clinic), SUPER_ADMIN
    """
    permission_classes = [IsAuthenticated, IsClinicAdmin]

    def post(self, request, pk):
        clinic = getattr(request.user, 'clinic', None)
        if not clinic and request.user.role != 'SUPER_ADMIN':
            return Response({'error': 'No clinic associated'}, status=status.HTTP_403_FORBIDDEN)

        try:
            if request.user.role == 'SUPER_ADMIN':
                invoice = Invoice.objects.get(id=pk)
            else:
                invoice = Invoice.objects.get(id=pk, clinic=clinic)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=status.HTTP_404_NOT_FOUND)

        if invoice.status != 'paid':
            return Response({'error': 'Only paid invoices can be refunded.'}, status=status.HTTP_400_BAD_REQUEST)

        if invoice.payment_method == 'cash':
            return Response({'error': 'Cash payments cannot be refunded via this system.'}, status=status.HTTP_400_BAD_REQUEST)

        if not invoice.razorpay_payment_id:
            return Response({'error': 'No Razorpay payment ID found for this invoice.'}, status=status.HTTP_400_BAD_REQUEST)

        client = get_razorpay_client()
        try:
            refund = client.payment.refund(invoice.razorpay_payment_id, {
                'amount': int(invoice.total_amount * 100),
                'speed': 'normal',
            })
            with transaction.atomic():
                invoice.refund_id = refund['id']
                invoice.refunded_at = timezone.now()
                invoice.refund_reason = request.data.get('reason', '')
                invoice.save(update_fields=['refund_id', 'refunded_at', 'refund_reason'])

                invoice.apply_ledger_entry(
                    entry_type='credit',
                    amount=invoice.total_amount,
                    resulting_status='refunded',
                    source_event='view:refund_invoice',
                    user=request.user,
                    razorpay_reference=refund['id'],
                )

                log_action(
                    user=request.user,
                    clinic=invoice.clinic,
                    action_type=AuditLog.ActionChoices.UPDATE,
                    object_type='Invoice',
                    object_id=invoice.id,
                    description=f'INVOICE_REFUNDED: ₹{invoice.total_amount} refunded via Razorpay',
                )

            _notify_patient(
                invoice,
                title="Refund initiated",
                message=f"A refund of ₹{invoice.total_amount} has been initiated for your payment at {invoice.clinic.name}."
            )

            return Response({'message': 'Refund initiated successfully.', 'refund_id': refund['id']})
        except Exception as e:
            logger.error(f"Refund failed for invoice {invoice.id}: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OnboardBankView(APIView):
    permission_classes = [IsAuthenticated, IsClinicAdmin]

    def get(self, request):
        clinic = getattr(request.user, 'clinic', None)
        if not clinic:
            return Response({'error': 'No clinic associated'}, status=status.HTTP_403_FORBIDDEN)
        
        return Response({
            'is_onboarded': bool(clinic.razorpay_linked_account_id),
            'account_id': clinic.razorpay_linked_account_id
        })

    def post(self, request):
        clinic = getattr(request.user, 'clinic', None)
        if not clinic:
            return Response({'error': 'No clinic associated'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        bank_account_name = data.get('bank_account_name')
        bank_account_number = data.get('bank_account_number')
        bank_ifsc = data.get('bank_ifsc')
        business_pan = data.get('business_pan')
        gstin = data.get('gstin', '')

        if not all([bank_account_name, bank_account_number, bank_ifsc, business_pan]):
            return Response({'error': 'Bank account name, number, IFSC, and PAN are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = {
                "name": bank_account_name,
                "email": request.user.email,
                "tnc_accepted": True,
                "account_details": {
                    "business_name": clinic.name,
                    "business_type": "individual"
                },
                "bank_account": {
                    "ifsc_code": bank_ifsc,
                    "beneficiary_name": bank_account_name,
                    "account_type": "current",
                    "account_number": bank_account_number
                }
            }

            response = requests.post(
                'https://api.razorpay.com/beta/accounts',
                json=payload,
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
                headers={'Content-Type': 'application/json'}
            )

            if response.status_code >= 400:
                if response.status_code == 404:
                    response = requests.post(
                        'https://api.razorpay.com/v2/accounts',
                        json=payload,
                        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
                        headers={'Content-Type': 'application/json'}
                    )

                if response.status_code >= 400:
                    err_msg = response.json().get('error', {}).get('description', 'Failed to link account via Razorpay Route.')
                    return Response({'error': err_msg}, status=status.HTTP_400_BAD_REQUEST)

            resp_data = response.json()
            linked_account_id = resp_data.get('id')

            if not linked_account_id:
                return Response({'error': 'Invalid response from Razorpay. Missing account ID.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            clinic.bank_account_name = bank_account_name
            clinic.bank_account_number = bank_account_number
            clinic.bank_ifsc = bank_ifsc
            clinic.business_pan = business_pan
            clinic.gstin = gstin
            clinic.razorpay_linked_account_id = linked_account_id
            clinic.linked_account_status = 'created'
            clinic.save()

            return Response({
                'message': 'Bank account successfully linked for B2C payouts.',
                'account_id': linked_account_id
            })
        except Exception as e:
            logger.error(f"Bank onboarding failed: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PlatformSettingsView(APIView):
    from apps.accounts.permissions import IsSuperAdmin
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        from apps.billing.models import PlatformSettings
        settings_obj = PlatformSettings.objects.first()
        if not settings_obj:
            return Response({'razorpay_key_id': '', 'razorpay_key_secret': ''})

        # Return a masked secret for security
        secret = settings_obj.razorpay_key_secret
        masked_secret = secret[:5] + '*' * (len(secret) - 5) if secret else ''

        return Response({
            'razorpay_key_id': settings_obj.razorpay_key_id or '',
            'razorpay_key_secret': masked_secret,
        })

    def post(self, request):
        from apps.billing.models import PlatformSettings
        data = request.data

        settings_obj, _ = PlatformSettings.objects.get_or_create(id=1)

        if 'razorpay_key_id' in data:
            settings_obj.razorpay_key_id = data['razorpay_key_id']

        if 'razorpay_key_secret' in data and data['razorpay_key_secret']:
            # Ignore if it's the masked version sent back
            if '*' not in data['razorpay_key_secret']:
                settings_obj.razorpay_key_secret = data['razorpay_key_secret']

        settings_obj.save()
        return Response({'success': True, 'message': 'Platform settings updated successfully.'})


class SuperAdminGenerateSubscriptionLinkView(APIView):
    """
    POST /api/billing/super-admin/generate-subscription-link/
    Super Admin only — generates a one-time Razorpay Payment Link for a 
    specific clinic's subscription amount as a fallback when e-mandate fails.
    Body: { "clinic_id": 5, "plan": "professional" }
    """
    from apps.accounts.permissions import IsSuperAdmin
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    PLAN_AMOUNTS = {
        'professional': 99900,   # ₹999 in paise
        'enterprise': 299900,    # ₹2999 in paise
    }

    def post(self, request):
        from apps.clinics.models import Clinic
        plan = request.data.get('plan', '').lower()
        clinic_id = request.data.get('clinic_id')

        if plan not in self.PLAN_AMOUNTS:
            return Response(
                {'error': 'Invalid plan. Must be "professional" or "enterprise".'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not clinic_id:
            return Response({'error': 'clinic_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            clinic = Clinic.objects.get(id=clinic_id)
        except Clinic.DoesNotExist:
            return Response({'error': 'Clinic not found.'}, status=status.HTTP_404_NOT_FOUND)

        amount = self.PLAN_AMOUNTS[plan]
        plan_label = plan.capitalize()

        try:
            client = get_razorpay_client()
            link_data = {
                'amount': amount,
                'currency': 'INR',
                'accept_partial': False,
                'description': f'MediClinic {plan_label} Plan — Manual Activation for {clinic.name}',
                'notes': {
                    'clinic_id': str(clinic.id),
                    'clinic_name': clinic.name,
                    'plan': plan,
                    'type': 'manual_subscription_fallback',
                },
                'notify': {'sms': False, 'email': False},
                'reminder_enable': False,
            }
            payment_link = client.payment_link.create(link_data)
            return Response({
                'payment_link_url': payment_link['short_url'],
                'amount': amount / 100,
                'plan': plan,
                'clinic': clinic.name,
            })
        except Exception as e:
            logger.error(f"Failed to create subscription payment link: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class InitiateRefundView(APIView):
    """
    POST /api/billing/refunds/initiate/
    Allowed: RECEPTIONIST, CLINIC_ADMIN (own clinic), SUPER_ADMIN
    Body: { "invoice_id": 12, "amount": "300.00", "reason": "Patient requested cancellation" }
    """
    permission_classes = [IsAuthenticated, IsClinicAdminOrReceptionist]

    def post(self, request):
        invoice_id = request.data.get('invoice_id')
        amount_raw = request.data.get('amount')
        reason = request.data.get('reason', '')

        if not invoice_id or not amount_raw:
            return Response(
                {'error': 'invoice_id and amount are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            amount = Decimal(str(amount_raw))
            if amount <= 0:
                raise ValueError("Amount must be positive.")
        except Exception:
            return Response(
                {'error': 'Invalid amount provided.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        clinic = get_user_clinic(request.user)
        if not clinic and request.user.role != 'SUPER_ADMIN':
            return Response({'error': 'No clinic associated'}, status=status.HTTP_403_FORBIDDEN)

        try:
            if request.user.role == 'SUPER_ADMIN':
                invoice = Invoice.objects.get(id=invoice_id)
            else:
                invoice = Invoice.objects.get(id=invoice_id, clinic=clinic)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            refund_request = initiate_refund(
                invoice,
                amount=amount,
                reason=reason,
                requested_by=request.user
            )
            return Response(
                RefundRequestSerializer(refund_request).data,
                status=status.HTTP_201_CREATED
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Initiate refund view failed: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PendingRefundApprovalsListView(APIView):
    """
    GET /api/billing/refunds/pending/
    Allowed: CLINIC_ADMIN (own clinic), SUPER_ADMIN
    Lists all pending_approval RefundRequests for the clinic.
    """
    permission_classes = [IsAuthenticated, IsClinicAdmin]

    def get(self, request):
        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        clinic = get_user_clinic(request.user)
        if not clinic and request.user.role != 'SUPER_ADMIN':
            return paginator.get_paginated_response([])

        if request.user.role == 'SUPER_ADMIN':
            qs = RefundRequest.objects.filter(status='pending_approval')
        else:
            qs = RefundRequest.objects.filter(invoice__clinic=clinic, status='pending_approval')

        qs = qs.order_by('-created_at').select_related('invoice', 'requested_by', 'approved_by')
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            serializer = RefundRequestSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = RefundRequestSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ApproveRefundView(APIView):
    """
    POST /api/billing/refunds/{pk}/approve/
    Allowed: CLINIC_ADMIN (own clinic explicit check), SUPER_ADMIN
    """
    permission_classes = [IsAuthenticated, IsClinicAdmin]

    def post(self, request, pk):
        try:
            refund_request = RefundRequest.objects.select_related('invoice__clinic').get(id=pk)
        except RefundRequest.DoesNotExist:
            return Response({'error': 'Refund request not found.'}, status=status.HTTP_404_NOT_FOUND)

        clinic = get_user_clinic(request.user)
        if request.user.role != 'SUPER_ADMIN':
            if not clinic or refund_request.invoice.clinic_id != clinic.id:
                return Response(
                    {'error': 'You do not have permission to approve refund requests for this clinic.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        try:
            refund_request = approve_refund(refund_request, approved_by=request.user)
            return Response(
                RefundRequestSerializer(refund_request).data,
                status=status.HTTP_200_OK
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Approve refund view failed: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RejectRefundView(APIView):
    """
    POST /api/billing/refunds/{pk}/reject/
    Allowed: CLINIC_ADMIN (own clinic explicit check), SUPER_ADMIN
    Body: { "rejection_reason": "Policy limit exceeded" }
    """
    permission_classes = [IsAuthenticated, IsClinicAdmin]

    def post(self, request, pk):
        try:
            refund_request = RefundRequest.objects.select_related('invoice__clinic').get(id=pk)
        except RefundRequest.DoesNotExist:
            return Response({'error': 'Refund request not found.'}, status=status.HTTP_404_NOT_FOUND)

        clinic = get_user_clinic(request.user)
        if request.user.role != 'SUPER_ADMIN':
            if not clinic or refund_request.invoice.clinic_id != clinic.id:
                return Response(
                    {'error': 'You do not have permission to reject refund requests for this clinic.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        rejection_reason = request.data.get('rejection_reason', '')
        try:
            reject_refund(refund_request, rejected_by=request.user, rejection_reason=rejection_reason)
            refund_request.refresh_from_db()
            return Response(
                RefundRequestSerializer(refund_request).data,
                status=status.HTTP_200_OK
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Reject refund view failed: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


import hmac
import hashlib
import uuid
from rest_framework.permissions import AllowAny


class CreateOrderView(APIView):
    """
    POST /api/billing/create-order/ (and /api/create-order/)
    Creates a Razorpay Standard Web Checkout Order.
    Request body:
      - amount: int (amount in paise, minimum 100 paise)
      - currency: str (default 'INR')
      - receipt: str (optional receipt string)
      - notes: dict (optional metadata)
      - invoice_id: int/str (optional invoice ID)
    Response:
      - success: bool
      - order_id: str (Razorpay order ID)
      - amount: int (amount in paise)
      - currency: str
      - key_id: str (Razorpay Public Key ID)
      - receipt: str
    """
    permission_classes = [AllowAny]

    def post(self, request):
        raw_amount = request.data.get("amount")
        if raw_amount is None:
            return Response(
                {"success": False, "error": "Amount is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            amount_paise = int(float(raw_amount))
        except (ValueError, TypeError):
            return Response(
                {"success": False, "error": "Invalid amount provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if amount_paise < 100:
            return Response(
                {"success": False, "error": "Amount must be at least 100 paise (₹1.00)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        currency = (request.data.get("currency") or "INR").upper()
        receipt = request.data.get("receipt") or f"rcpt_{uuid.uuid4().hex[:12]}"
        notes = request.data.get("notes") or {}
        if not isinstance(notes, dict):
            notes = {}

        invoice_id = request.data.get("invoice_id")
        if invoice_id:
            notes["invoice_id"] = str(invoice_id)

        try:
            client = get_razorpay_client()
            order_data = {
                "amount": amount_paise,
                "currency": currency,
                "receipt": str(receipt)[:40],
                "notes": notes,
            }
            order = client.order.create(data=order_data)

            from apps.billing.models import PlatformSettings
            settings_obj = PlatformSettings.objects.first()
            key_id = (
                getattr(settings_obj, "razorpay_key_id", None)
                or getattr(settings, "RAZORPAY_KEY_ID", "")
                or getattr(client, "auth", (None, None))[0]
            )

            return Response(
                {
                    "success": True,
                    "order_id": order["id"],
                    "amount": order["amount"],
                    "currency": order["currency"],
                    "receipt": order.get("receipt", receipt),
                    "key_id": key_id,
                    "notes": order.get("notes", notes),
                },
                status=status.HTTP_200_OK,
            )
        except ValueError as val_err:
            logger.error(f"Razorpay configuration error: {val_err}")
            return Response(
                {"success": False, "error": str(val_err)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except Exception as e:
            logger.error(f"Razorpay order creation failed: {e}", exc_info=True)
            return Response(
                {"success": False, "error": f"Failed to create Razorpay order: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class VerifyPaymentView(APIView):
    """
    POST /api/billing/verify-payment/ (and /api/verify-payment/)
    Verifies Razorpay payment signature using HMAC-SHA256.
    Request body:
      - razorpay_order_id: str
      - razorpay_payment_id: str
      - razorpay_signature: str
      - invoice_id: int/str (optional)
    Response:
      - success: bool
      - message: str
      - order_id: str
      - payment_id: str
      - invoice_id: int (optional)
    """
    permission_classes = [AllowAny]

    def post(self, request):
        order_id = request.data.get("razorpay_order_id") or request.data.get("order_id")
        payment_id = request.data.get("razorpay_payment_id") or request.data.get("payment_id")
        signature = request.data.get("razorpay_signature") or request.data.get("signature")

        if not order_id or not payment_id or not signature:
            return Response(
                {
                    "success": False,
                    "error": "Missing required fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.billing.models import PlatformSettings
        settings_obj = PlatformSettings.objects.first()
        key_secret = (
            (settings_obj and settings_obj.razorpay_key_secret)
            or getattr(settings, "RAZORPAY_KEY_SECRET", None)
            or ""
        )

        if not key_secret:
            try:
                client = get_razorpay_client()
                key_secret = getattr(client, "auth", (None, None))[1]
            except Exception:
                pass

        if not key_secret:
            logger.error("Razorpay verification failed: secret key is not configured.")
            return Response(
                {"success": False, "error": "Razorpay secret key is not configured."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Signature verification: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
        message = f"{order_id}|{payment_id}".encode("utf-8")
        generated_signature = hmac.new(
            str(key_secret).encode("utf-8"),
            message,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(generated_signature, str(signature)):
            logger.warning(
                f"Razorpay signature verification failed for order {order_id}, payment {payment_id}."
            )
            return Response(
                {
                    "success": False,
                    "error": "Payment signature verification failed. Signatures do not match.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        invoice_id = request.data.get("invoice_id")
        invoice = None
        if invoice_id:
            try:
                invoice = Invoice.objects.get(pk=invoice_id)
            except (Invoice.DoesNotExist, ValueError):
                pass

        if invoice:
            try:
                with transaction.atomic():
                    invoice.razorpay_payment_id = payment_id
                    invoice.payment_method = "card"
                    invoice.paid_at = timezone.now()
                    invoice.save(update_fields=["razorpay_payment_id", "payment_method", "paid_at"])

                    if invoice.status in ("pending", "pending_at_clinic", "draft"):
                        invoice.apply_ledger_entry(
                            entry_type="debit",
                            amount=invoice.total_amount,
                            resulting_status="paid",
                            source_event="view:verify_payment",
                            razorpay_reference=payment_id,
                            payment_method="online",
                            user=request.user if request.user and request.user.is_authenticated else None,
                        )

                    if invoice.appointment and invoice.appointment.status == "SCHEDULED":
                        invoice.appointment.status = "CONFIRMED"
                        invoice.appointment.save(update_fields=["status"])

                try:
                    _notify_patient(
                        invoice,
                        title="Payment Confirmed",
                        message=f"Online payment of ₹{invoice.total_amount} was successfully verified.",
                    )
                except Exception as notify_err:
                    logger.warning(f"Failed to notify patient after payment verification: {notify_err}")
            except Exception as inv_err:
                logger.error(f"Error updating invoice {invoice_id} after verification: {inv_err}", exc_info=True)

        return Response(
            {
                "success": True,
                "message": "Payment verified successfully.",
                "order_id": order_id,
                "payment_id": payment_id,
                "invoice_id": invoice.id if invoice else None,
            },
            status=status.HTTP_200_OK,
        )


