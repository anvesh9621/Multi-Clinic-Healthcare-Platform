"""
Celery tasks for the appointments app.
"""
from celery import shared_task
from django.db import transaction
import logging

logger = logging.getLogger(__name__)


@shared_task
def cancel_unpaid_appointments():
    """
    Runs every 5 minutes via Celery Beat.
    Cancels SCHEDULED pay_now appointments where the payment link has
    expired and payment was not received. Frees the slot and notifies
    the patient.
    """
    from django.utils import timezone
    from apps.appointments.models import Appointment
    from apps.billing.models import Invoice
    from apps.notifications.models import Notification
    from apps.audit.services import log_action
    from apps.audit.models import AuditLog

    now = timezone.now()

    expired_invoices = Invoice.objects.filter(
        status='pending',
        payment_link_expires_at__lt=now,
        appointment__payment_flow='pay_now',
        appointment__status='SCHEDULED'
    ).select_related('appointment__doctor_clinic__doctor__user', 'patient__user', 'clinic')

    cancelled_count = 0
    for invoice in expired_invoices:
        try:
            with transaction.atomic():
                appt = invoice.appointment
                appt.status = Appointment.StatusChoices.CANCELLED
                appt.save(update_fields=['status'])

                invoice.apply_ledger_entry(
                    entry_type='credit',
                    amount=invoice.total_amount,
                    resulting_status='cancelled',
                    source_event='task:expiry_sweep',
                )

                log_action(
                    user=None,
                    clinic=appt.clinic,
                    action_type=AuditLog.ActionChoices.CANCEL,
                    object_type='Appointment',
                    object_id=appt.id,
                    description='APPOINTMENT_AUTO_CANCELLED: Payment link expired — slot released automatically',
                )

            # Notify patient (outside atomic block to avoid holding transaction)
            if appt.patient and appt.patient.user:
                doctor_name = ''
                try:
                    doctor_name = appt.doctor_clinic.doctor.user.get_full_name()
                except Exception:
                    pass

                Notification.objects.create(
                    recipient=appt.patient.user,
                    notification_type='APPOINTMENT',
                    title='Appointment slot released',
                    message=(
                        f'Your appointment with Dr. {doctor_name} on '
                        f'{appt.appointment_date} was cancelled because payment '
                        f'was not completed within 30 minutes. '
                        f'Please rebook to secure a new slot.'
                    )
                )

            cancelled_count += 1
        except Exception as e:
            logger.error(f"Failed to auto-cancel appointment for invoice {invoice.id}: {e}")

    logger.info(f"cancel_unpaid_appointments: cancelled {cancelled_count} expired appointments")
    return f"Cancelled {cancelled_count} appointments"
