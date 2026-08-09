import logging
from datetime import datetime, timezone as dt_timezone
from django.utils import timezone
from decimal import Decimal
from django.db import models
from apps.billing.razorpay_client import get_razorpay_client
from apps.billing.models import Invoice, SubscriptionInvoice, RefundRequest, PaymentIdempotencyKey

logger = logging.getLogger(__name__)


def confirm_appointment_for_invoice(invoice, payment_reference="", source_context=""):
    """
    Shared helper to confirm an appointment associated with a paid invoice,
    create patient notification, and write audit log.
    Used by payment_link.paid handler, payment.authorized handler, and reconciliation service.
    """
    if not invoice.appointment:
        return

    appt = invoice.appointment
    if appt.payment_flow == 'pay_now' and appt.status == 'SCHEDULED':
        appt.status = 'CONFIRMED'
        appt.save(update_fields=['status'])

        # Notify patient of appointment confirmation
        try:
            from apps.notifications.models import Notification
            if appt.patient and appt.patient.user:
                doctor_name = ''
                try:
                    doctor_name = appt.doctor_clinic.doctor.user.get_full_name()
                except Exception:
                    pass
                msg_suffix = f" via {source_context}" if source_context else ""
                Notification.objects.create(
                    recipient=appt.patient.user,
                    notification_type='APPOINTMENT',
                    title='Appointment Confirmed',
                    message=(
                        f'Your appointment with Dr. {doctor_name} on '
                        f'{appt.appointment_date} at {appt.start_time} '
                        f'has been confirmed{msg_suffix}. Payment of ₹{invoice.total_amount} received.'
                    )
                )
        except Exception as e:
            logger.error(f"Failed to send appointment confirmation notification: {e}")

        try:
            from apps.audit.services import log_action
            from apps.audit.models import AuditLog
            log_action(
                user=None,
                clinic=appt.clinic,
                action_type=AuditLog.ActionChoices.UPDATE,
                object_type='Appointment',
                object_id=appt.id,
                description=f'APPOINTMENT_CONFIRMED_VIA_{source_context.upper() if source_context else "PAYMENT"}: payment {payment_reference or invoice.razorpay_payment_id}'
            )
        except Exception as e:
            logger.error(f"Failed to log appointment confirmation audit: {e}")


def reconcile_invoice_with_razorpay(invoice):
    """
    Queries Razorpay directly for the real current status of a pending
    Invoice's payment link, and reconciles local state to match — this is
    the safety net for webhooks that were delayed or never arrived.
    Returns True if a state change was made, False if nothing needed to change.
    """
    if invoice.status != 'pending':
        return False  # nothing to reconcile, already resolved one way or another

    if not invoice.razorpay_payment_link_id:
        return False

    client = get_razorpay_client()
    try:
        link_status = client.payment_link.fetch(invoice.razorpay_payment_link_id)
    except Exception as e:
        import sentry_sdk
        sentry_sdk.set_context("payment", {
            "invoice_id": str(invoice.pk) if invoice else None,
            "source_event": "reconciliation:fetch_payment_link",
        })
        logger.error(f"Reconciliation: failed to fetch payment link for invoice {invoice.pk}: {e}")
        return False  # can't determine anything, leave as-is, don't guess

    razorpay_status = link_status.get('status')  # 'paid', 'created', 'cancelled', 'expired'

    if razorpay_status == 'paid':
        payments = link_status.get('payments', [])
        if not payments:
            logger.warning(f"Reconciliation: invoice {invoice.pk} shows paid but no payment details returned")
            return False
        payment_entity = payments[-1]  # most recent

        raw_method = payment_entity.get('method', 'other')
        payment_id = payment_entity.get('id', '')

        invoice.payment_link_status = 'paid'
        if payment_entity.get('created_at'):
            invoice.paid_at = datetime.fromtimestamp(payment_entity['created_at'], tz=dt_timezone.utc)
        else:
            invoice.paid_at = timezone.now()
        invoice.razorpay_payment_id = payment_id
        invoice.save(update_fields=['payment_link_status', 'paid_at', 'razorpay_payment_id'])

        invoice.apply_ledger_entry(
            entry_type='debit',
            amount=invoice.total_amount,
            resulting_status='paid',
            source_event='reconciliation:payment_link_paid',
            razorpay_reference=payment_id,
            payment_method=raw_method,
        )
        logger.info(f"RECONCILIATION CAUGHT: invoice {invoice.pk} was actually paid, webhook must have been missed/delayed")

        confirm_appointment_for_invoice(invoice, payment_reference=payment_id, source_context="reconciliation")
        return True

    return False


def reconcile_subscription_invoice_with_razorpay(sub_invoice):
    """
    Queries Razorpay directly for the real current status of a pending SubscriptionInvoice,
    reconciling local state to match missed or delayed webhooks.
    Returns True if state change made, False otherwise.
    """
    if sub_invoice.status != 'pending':
        return False

    client = get_razorpay_client()
    try:
        if sub_invoice.razorpay_payment_id:
            pay_details = client.payment.fetch(sub_invoice.razorpay_payment_id)
            pay_status = pay_details.get('status')
            if pay_status in ('captured', 'paid'):
                sub_invoice.apply_ledger_entry(
                    entry_type='debit',
                    amount=sub_invoice.total_amount,
                    resulting_status='paid',
                    source_event='reconciliation:subscription_charged',
                    razorpay_reference=sub_invoice.razorpay_payment_id,
                )
                logger.info(f"RECONCILIATION CAUGHT: SubscriptionInvoice {sub_invoice.pk} was actually paid")
                if sub_invoice.subscription:
                    sub_invoice.subscription.transition_status(
                        'active',
                        source_event='reconciliation:subscription_charged'
                    )
                from apps.billing.tasks import generate_b2b_invoice_pdf
                generate_b2b_invoice_pdf.delay(sub_invoice.id)
                return True
        elif sub_invoice.subscription and sub_invoice.subscription.razorpay_subscription_id:
            sub_details = client.subscription.fetch(sub_invoice.subscription.razorpay_subscription_id)
            sub_status = sub_details.get('status')
            if sub_status == 'active':
                sub_invoice.apply_ledger_entry(
                    entry_type='debit',
                    amount=sub_invoice.total_amount,
                    resulting_status='paid',
                    source_event='reconciliation:subscription_charged',
                    razorpay_reference=sub_details.get('id', ''),
                )
                logger.info(f"RECONCILIATION CAUGHT: SubscriptionInvoice {sub_invoice.pk} resolved via active subscription")
                sub_invoice.subscription.transition_status(
                    'active',
                    source_event='reconciliation:subscription_charged'
                )
                from apps.billing.tasks import generate_b2b_invoice_pdf
                generate_b2b_invoice_pdf.delay(sub_invoice.id)
                return True
    except Exception as e:
        import sentry_sdk
        sentry_sdk.set_context("payment", {
            "invoice_id": str(sub_invoice.pk) if sub_invoice else None,
            "source_event": "reconciliation:fetch_subscription_details",
        })
        logger.error(f"Reconciliation: failed to fetch subscription details for SubscriptionInvoice {sub_invoice.pk}: {e}")
        return False

    return False


def initiate_refund(invoice, *, amount, reason, requested_by):
    """
    Creates a RefundRequest and either auto-approves + processes it
    immediately, or leaves it pending_approval for a Clinic Admin.
    """
    from django.conf import settings
    from django.db import transaction

    if invoice.status not in ('paid',):
        raise ValueError(f"Cannot refund invoice in status {invoice.status}")

    with transaction.atomic():
        locked_invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)

        already_refunded = locked_invoice.refund_requests.filter(
            status__in=['completed', 'processing']
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0')

        if already_refunded + amount > locked_invoice.total_amount:
            raise ValueError(
                f"Refund amount {amount} would exceed remaining refundable "
                f"balance ({locked_invoice.total_amount - already_refunded})"
            )

        auto_approve = (
            getattr(requested_by, 'role', None) == 'CLINIC_ADMIN' or
            amount <= Decimal(str(settings.REFUND_AUTO_APPROVE_THRESHOLD))
        )

        refund_request = RefundRequest.objects.create(
            invoice=locked_invoice,
            requested_by=requested_by,
            amount=amount,
            reason=reason,
            status='processing' if auto_approve else 'pending_approval',
            approved_by=requested_by if auto_approve else None,
        )

    if auto_approve:
        _process_refund(refund_request)

    return refund_request


def approve_refund(refund_request, *, approved_by):
    if refund_request.status != 'pending_approval':
        raise ValueError(f"Refund request {refund_request.pk} is not pending approval")

    refund_request.status = 'processing'
    refund_request.approved_by = approved_by
    refund_request.save(update_fields=['status', 'approved_by'])
    _process_refund(refund_request)
    return refund_request


def reject_refund(refund_request, *, rejected_by, rejection_reason=''):
    if refund_request.status != 'pending_approval':
        raise ValueError(f"Refund request {refund_request.pk} is not pending approval")

    refund_request.status = 'rejected'
    refund_request.approved_by = rejected_by
    refund_request.save(update_fields=['status', 'approved_by'])

    try:
        from apps.notifications.models import Notification
        if refund_request.requested_by:
            reason_msg = f": {rejection_reason}" if rejection_reason else ""
            Notification.objects.create(
                recipient=refund_request.requested_by,
                notification_type='SYSTEM',
                title='Refund Request Rejected',
                message=(
                    f"Your refund request of ₹{refund_request.amount} for invoice "
                    f"{refund_request.invoice.invoice_number or refund_request.invoice.pk} "
                    f"was rejected{reason_msg}."
                ),
            )
    except Exception as e:
        logger.error(f"Failed to create refund rejection notification: {e}")


def _process_refund(refund_request):
    """
    Makes the actual outbound Razorpay refund call, protected by an
    idempotency key so a retry (network timeout, duplicate call) never
    creates two refunds for the same request.
    """
    idem_key, created = PaymentIdempotencyKey.objects.get_or_create(
        key=f"refund-{refund_request.id}",
        defaults={'operation_type': 'refund', 'reference_id': str(refund_request.id)},
    )
    refund_request.idempotency_key = idem_key
    refund_request.save(update_fields=['idempotency_key'])

    if idem_key.status == 'completed':
        # already processed under this key — don't call Razorpay again,
        # this handles the retry-after-timeout case directly
        return refund_request

    client = get_razorpay_client()
    try:
        response = client.payment.refund(
            refund_request.invoice.razorpay_payment_id,
            {
                'amount': int(refund_request.amount * 100),  # paise
                'notes': {'refund_request_id': str(refund_request.id)},
            },
        )
        refund_request.razorpay_refund_id = response.get('id', '')
        refund_request.save(update_fields=['razorpay_refund_id'])
        idem_key.status = 'completed'
        idem_key.razorpay_response = response
        idem_key.save(update_fields=['status', 'razorpay_response'])
    except Exception as e:
        import sentry_sdk
        sentry_sdk.set_context("payment", {
            "invoice_id": str(refund_request.invoice.pk) if refund_request and refund_request.invoice else None,
            "source_event": f"refund:_process_refund:{refund_request.pk}",
        })
        logger.error(f"Refund API call failed for RefundRequest {refund_request.pk}: {e}")
        refund_request.status = 'failed'
        refund_request.save(update_fields=['status'])
        idem_key.status = 'failed'
        idem_key.save(update_fields=['status'])
        raise

