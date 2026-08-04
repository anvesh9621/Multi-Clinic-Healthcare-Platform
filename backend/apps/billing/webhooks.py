import json
import logging
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from apps.billing.razorpay_client import get_razorpay_client
from apps.billing.models import WebhookEvent, Invoice, SubscriptionInvoice
from apps.subscriptions.models import Subscription
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
