import json
import logging
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from apps.billing.razorpay_client import get_razorpay_client
from apps.billing.models import WebhookEvent, Invoice, SubscriptionInvoice
from apps.subscriptions.models import Subscription
from decimal import Decimal
from datetime import timedelta, datetime, timezone as dt_timezone
from django.utils import timezone

logger = logging.getLogger(__name__)

@csrf_exempt
@require_POST
def razorpay_webhook(request):
    """
    Razorpay Webhook endpoint.
    
    IMPORTANT: During local development, you must use ngrok to expose your
    local server to the internet so Razorpay can send POST requests here.
    Example: `ngrok http 8000` -> register the ngrok URL + /api/billing/webhook/
    in the Razorpay Dashboard.
    """
    payload = request.body.decode('utf-8')
    signature = request.headers.get('X-Razorpay-Signature')
    
    if not signature:
        return HttpResponse("Missing signature", status=400)
        
    client = get_razorpay_client()
    try:
        client.utility.verify_webhook_signature(
            payload,
            signature,
            settings.RAZORPAY_WEBHOOK_SECRET
        )
    except Exception as e:
        logger.error(f"Webhook signature verification failed: {e}")
        return HttpResponse("Invalid signature", status=400)
        
    data = json.loads(payload)
    # The event ID is generally at the root level 'id' in Razorpay payloads, or via header
    event_id = request.headers.get('X-Razorpay-Event-Id', data.get('id', ''))
    event_type = data.get('event')
    
    if not event_id:
        return HttpResponse("Missing event ID", status=400)
        
    # Idempotency check
    if WebhookEvent.objects.filter(event_id=event_id).exists():
        return HttpResponse("Event already processed", status=200)
        
    WebhookEvent.objects.create(event_id=event_id, event_type=event_type, raw_payload=data)
    
    try:
        if event_type == 'subscription.charged':
            handle_subscription_charged(data['payload']['subscription']['entity'], data['payload']['payment']['entity'])
        elif event_type == 'subscription.halted':
            handle_subscription_halted(data['payload']['subscription']['entity'])
        elif event_type == 'subscription.cancelled':
            handle_subscription_cancelled(data['payload']['subscription']['entity'])
        elif event_type == 'payment_link.paid':
            handle_payment_link_paid(data['payload']['payment_link']['entity'], data['payload']['payment']['entity'])
        elif event_type == 'payment.failed':
            handle_payment_failed(data['payload']['payment']['entity'])
        elif event_type == 'payment.authorized':
            handle_payment_authorized(data['payload']['payment']['entity'])
        elif event_type == 'refund.processed':
            handle_refund_processed(data['payload']['refund']['entity'])
        elif event_type == 'refund.failed':
            handle_refund_failed(data['payload']['refund']['entity'])
    except Exception as e:
        logger.error(f"Error processing webhook event {event_type}: {e}")
        # Return 200 to acknowledge receipt and avoid infinite retries
        return HttpResponse(f"Error processing event: {str(e)}", status=200)
        
    return HttpResponse("OK", status=200)

def handle_subscription_charged(sub_entity, payment_entity):
    rzp_sub_id = sub_entity['id']
    try:
        sub = Subscription.objects.get(razorpay_subscription_id=rzp_sub_id)
        sub.status = 'active'
        sub.current_period_end = datetime.fromtimestamp(sub_entity['current_end'], tz=dt_timezone.utc)
        sub.grace_period_end = None
        sub.payment_failed_at = None
        sub.save()
        
        # Calculate GST components (18% GST on total)
        total = payment_entity['amount'] / 100.0
        base = round(total / 1.18, 2)
        gst_each = round((total - base) / 2, 2)  # CGST + SGST split equally

        # Create SubscriptionInvoice using actual model fields
        inv = SubscriptionInvoice.objects.create(
            subscription=sub,
            clinic=sub.clinic,
            invoice_number=payment_entity.get('invoice_id', f"INV-{payment_entity['id']}"),
            amount_before_gst=base,
            cgst=gst_each,
            sgst=gst_each,
            total_amount=total,
            status='pending',
            razorpay_payment_id=payment_entity['id'],
            period_start=datetime.fromtimestamp(sub_entity['current_start'], tz=dt_timezone.utc),
            period_end=sub.current_period_end,
        )
        inv.apply_ledger_entry(
            entry_type='debit',
            amount=total,
            resulting_status='paid',
            source_event='webhook:subscription.charged',
            razorpay_reference=payment_entity['id'],
        )
        
        # Trigger Celery task to generate the PDF receipt
        from apps.billing.tasks import generate_b2b_invoice_pdf
        generate_b2b_invoice_pdf.delay(inv.id)
        
    except Subscription.DoesNotExist:
        logger.error(f"Subscription {rzp_sub_id} not found.")

def handle_subscription_halted(sub_entity):
    rzp_sub_id = sub_entity['id']
    try:
        sub = Subscription.objects.get(razorpay_subscription_id=rzp_sub_id)
        sub.status = 'past_due'
        sub.payment_failed_at = timezone.now()
        sub.grace_period_end = timezone.now() + timedelta(days=7)
        sub.save()
    except Subscription.DoesNotExist:
        logger.error(f"Subscription {rzp_sub_id} not found.")

def handle_subscription_cancelled(sub_entity):
    rzp_sub_id = sub_entity['id']
    try:
        sub = Subscription.objects.get(razorpay_subscription_id=rzp_sub_id)
        sub.status = 'cancelled'
        sub.save()
    except Subscription.DoesNotExist:
        logger.error(f"Subscription {rzp_sub_id} not found.")

def handle_payment_link_paid(pl_entity, payment_entity):
    pl_id = pl_entity['id']
    try:
        invoice = Invoice.objects.get(razorpay_payment_link_id=pl_id)
        raw_method = payment_entity.get('method', 'other')

        invoice.payment_link_status = 'paid'
        invoice.paid_at = datetime.fromtimestamp(payment_entity['created_at'], tz=dt_timezone.utc)
        invoice.razorpay_payment_id = payment_entity['id']
        invoice.save(update_fields=['payment_link_status', 'paid_at', 'razorpay_payment_id'])

        invoice.apply_ledger_entry(
            entry_type='debit',
            amount=invoice.total_amount,
            resulting_status='paid',
            source_event='webhook:payment_link.paid',
            razorpay_reference=payment_entity['id'],
            payment_method=raw_method,
        )

        # If this was a pay_now self-booking, confirm the appointment
        if invoice.appointment:
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
                        Notification.objects.create(
                            recipient=appt.patient.user,
                            notification_type='APPOINTMENT',
                            title='Appointment Confirmed',
                            message=(
                                f'Your appointment with Dr. {doctor_name} on '
                                f'{appt.appointment_date} at {appt.start_time} '
                                f'has been confirmed. Payment of ₹{invoice.total_amount} received.'
                            )
                        )
                except Exception as e:
                    logger.error(f"Failed to send appointment confirmation notification: {e}")

                from apps.audit.services import log_action
                from apps.audit.models import AuditLog
                log_action(
                    user=None,
                    clinic=appt.clinic,
                    action_type=AuditLog.ActionChoices.UPDATE,
                    object_type='Appointment',
                    object_id=appt.id,
                    description=f'APPOINTMENT_CONFIRMED_VIA_PAYMENT: payment {invoice.razorpay_payment_id}'
                )

    except Invoice.DoesNotExist:
        logger.error(f"Invoice for payment link {pl_id} not found.")


def handle_payment_failed(payment_entity):
    """
    Handles Razorpay payment.failed webhook event.
    Updates Invoice.last_failure_reason and notifies the patient with the
    specific error reason. Deliberately does NOT change Invoice.status or
    cancel appointment, allowing the patient to retry payment until the
    expiry sweep runs.
    """
    notes = payment_entity.get('notes', {}) or {}
    invoice_id = notes.get('invoice_id') or notes.get('invoice')
    pl_id = payment_entity.get('payment_link_id')

    invoice = None
    if invoice_id:
        try:
            invoice = Invoice.objects.get(pk=invoice_id)
        except (Invoice.DoesNotExist, ValueError):
            pass

    if not invoice and pl_id:
        try:
            invoice = Invoice.objects.get(razorpay_payment_link_id=pl_id)
        except Invoice.DoesNotExist:
            pass

    if not invoice:
        logger.error(f"payment.failed webhook: no matching invoice found for payment {payment_entity.get('id')}")
        return

    # Extract specific error reason from Razorpay payload
    error_desc = (
        payment_entity.get('error_description')
        or payment_entity.get('error_reason')
        or 'Payment failed'
    )
    invoice.last_failure_reason = str(error_desc)[:255]
    invoice.save(update_fields=['last_failure_reason'])

    # Send notification to patient with specific reason
    try:
        from apps.notifications.models import Notification
        patient_user = invoice.patient.user if invoice.patient and invoice.patient.user else None
        if patient_user:
            Notification.objects.create(
                recipient=patient_user,
                notification_type='SYSTEM',
                title='Payment Attempt Failed',
                message=(
                    f"Your payment attempt of ₹{invoice.total_amount} for invoice "
                    f"{invoice.invoice_number or invoice.pk} failed: {error_desc}. "
                    f"You may try again using your payment link."
                ),
                related_link='/dashboard/patient/invoices'
            )
    except Exception as e:
        logger.error(f"Failed to create payment failure notification: {e}")


def handle_payment_authorized(payment_entity):
    """
    Handles Razorpay payment.authorized webhook event (late-authorization recovery).
    If invoice is pending/draft/pending_at_clinic, marks it paid via apply_ledger_entry
    and sets payment method.
    If invoice is already paid, logs at debug level and ignores.
    If invoice is in terminal status (expired/cancelled), logs error requiring manual
    reconciliation as slot may have been released/rebooked.
    """
    notes = payment_entity.get('notes', {}) or {}
    invoice_id = notes.get('invoice_id') or notes.get('invoice')
    pl_id = payment_entity.get('payment_link_id')

    invoice = None
    if invoice_id:
        try:
            invoice = Invoice.objects.get(pk=invoice_id)
        except (Invoice.DoesNotExist, ValueError):
            pass

    if not invoice and pl_id:
        try:
            invoice = Invoice.objects.get(razorpay_payment_link_id=pl_id)
        except Invoice.DoesNotExist:
            pass

    if not invoice:
        logger.error(f"payment.authorized webhook: no matching invoice found for payment {payment_entity.get('id')}")
        return

    raw_method = payment_entity.get('method', 'other')
    payment_id = payment_entity.get('id', '')

    if invoice.status in ('pending', 'pending_at_clinic', 'draft'):
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
            source_event='webhook:payment.authorized',
            razorpay_reference=payment_id,
            payment_method=raw_method,
        )

        if invoice.appointment:
            appt = invoice.appointment
            if appt.payment_flow == 'pay_now' and appt.status == 'SCHEDULED':
                appt.status = 'CONFIRMED'
                appt.save(update_fields=['status'])

                try:
                    from apps.notifications.models import Notification
                    if appt.patient and appt.patient.user:
                        doctor_name = ''
                        try:
                            doctor_name = appt.doctor_clinic.doctor.user.get_full_name()
                        except Exception:
                            pass
                        Notification.objects.create(
                            recipient=appt.patient.user,
                            notification_type='APPOINTMENT',
                            title='Appointment Confirmed',
                            message=(
                                f'Your appointment with Dr. {doctor_name} on '
                                f'{appt.appointment_date} at {appt.start_time} '
                                f'has been confirmed via authorized payment.'
                            )
                        )
                except Exception as e:
                    logger.error(f"Failed to send appointment confirmation notification: {e}")

                from apps.audit.services import log_action
                from apps.audit.models import AuditLog
                log_action(
                    user=None,
                    clinic=appt.clinic,
                    action_type=AuditLog.ActionChoices.UPDATE,
                    object_type='Appointment',
                    object_id=appt.id,
                    description=f'APPOINTMENT_CONFIRMED_VIA_LATE_AUTHORIZATION: payment {payment_id}'
                )

    elif invoice.status == 'paid':
        logger.debug(f"payment.authorized for already-paid invoice {invoice.pk}, ignoring")
    else:
        logger.error(
            f"payment.authorized for invoice {invoice.pk} in terminal "
            f"status {invoice.status} — manual reconciliation needed, "
            f"payment may need refunding"
        )
        invoice.last_failure_reason = f"Late payment.authorized received while in terminal status {invoice.status} — manual reconciliation required"
        invoice.save(update_fields=['last_failure_reason'])


def handle_refund_processed(refund_entity):
    """
    Handles Razorpay refund.processed webhook event.
    Idempotent: if invoice is already in 'refunded' status, skips duplicate processing.
    Otherwise updates refund_id, refunded_at, and writes a credit ledger entry
    with resulting_status='refunded'.
    """
    payment_id = refund_entity.get('payment_id')
    if not payment_id:
        logger.error(f"refund.processed webhook: missing payment_id in refund entity {refund_entity.get('id')}")
        return

    invoice = Invoice.objects.filter(razorpay_payment_id=payment_id).first()
    if not invoice:
        invoice = SubscriptionInvoice.objects.filter(razorpay_payment_id=payment_id).first()

    if not invoice:
        logger.error(f"refund.processed webhook: no invoice found for payment {payment_id}")
        return

    if invoice.status == 'refunded':
        logger.debug(f"Invoice {invoice.pk} already marked refunded, skipping duplicate webhook")
        return

    if invoice.status != 'paid':
        logger.warning(f"refund.processed for invoice {invoice.pk} not in 'paid' status (currently {invoice.status})")

    refund_id = refund_entity.get('id', '')
    raw_amount = refund_entity.get('amount', 0)
    refund_amount = Decimal(str(raw_amount)) / Decimal('100') if raw_amount else invoice.total_amount

    invoice.refund_id = refund_id
    invoice.refunded_at = timezone.now()
    invoice.save(update_fields=['refund_id', 'refunded_at'])

    invoice.apply_ledger_entry(
        entry_type='credit',
        amount=refund_amount,
        resulting_status='refunded',
        source_event='webhook:refund.processed',
        razorpay_reference=refund_id,
    )


def handle_refund_failed(refund_entity):
    """
    Handles Razorpay refund.failed webhook event.
    Records failure reason without changing Invoice.status (remains 'paid').
    Notifies Super Admin / billing operations.
    """
    payment_id = refund_entity.get('payment_id')
    if not payment_id:
        logger.error(f"refund.failed webhook: missing payment_id in refund entity {refund_entity.get('id')}")
        return

    invoice = Invoice.objects.filter(razorpay_payment_id=payment_id).first()
    if not invoice:
        invoice = SubscriptionInvoice.objects.filter(razorpay_payment_id=payment_id).first()

    if not invoice:
        logger.error(f"refund.failed webhook: no invoice found for payment {payment_id}")
        return

    refund_id = refund_entity.get('id', '')
    error_desc = refund_entity.get('error_description') or refund_entity.get('error_reason') or 'Refund failed'

    logger.error(f"Refund FAILED for invoice {invoice.pk}, refund_id={refund_id}, error: {error_desc} — needs manual attention")

    invoice.last_failure_reason = str(f"Refund {refund_id} failed: {error_desc}")[:255]
    invoice.save(update_fields=['last_failure_reason'])

    try:
        from apps.notifications.models import Notification
        from django.contrib.auth import get_user_model
        User = get_user_model()
        super_admins = User.objects.filter(role=User.RoleChoices.SUPER_ADMIN)
        for admin in super_admins:
            Notification.objects.create(
                recipient=admin,
                notification_type='SYSTEM',
                title='Refund Failed Alert',
                message=(
                    f"Refund attempt {refund_id} for invoice {invoice.pk} "
                    f"(Amount: ₹{invoice.total_amount}) failed: {error_desc}. Manual intervention required."
                ),
                related_link='/dashboard/admin/billing'
            )
    except Exception as e:
        logger.error(f"Failed to create refund failure alert notification: {e}")



