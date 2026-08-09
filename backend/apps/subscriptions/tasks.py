import logging
from celery import shared_task
from django.utils import timezone
from django.conf import settings
from django.core.mail import send_mail
from .models import Subscription

logger = logging.getLogger('payments')


@shared_task
def process_subscription_dunning():
    """
    Daily task. For subscriptions in past_due status, checks how many
    days into the grace period they are and sends the appropriate
    escalating communication if that stage hasn't been reached yet.
    Does NOT retry charges — Razorpay's own subscription retry cycle
    handles that; this only tracks/communicates the grace period.
    """
    past_due_subs = Subscription.objects.filter(status='past_due', payment_failed_at__isnull=False)

    STAGE_THRESHOLDS = [
        (1, 'day_1'), (3, 'day_3'), (5, 'day_5'), (7, 'day_7_final'),
    ]
    STAGE_ORDER = ['none', 'day_1', 'day_3', 'day_5', 'day_7_final']

    for sub in past_due_subs:
        days_elapsed = (timezone.now() - sub.payment_failed_at).days
        target_stage = None
        for threshold_days, stage_name in STAGE_THRESHOLDS:
            if days_elapsed >= threshold_days:
                target_stage = stage_name

        if not target_stage:
            continue  # not yet at day 1

        current_index = STAGE_ORDER.index(sub.dunning_stage if sub.dunning_stage in STAGE_ORDER else 'none')
        target_index = STAGE_ORDER.index(target_stage)
        if target_index <= current_index:
            continue  # already sent this stage's communication (or a later one)

        _send_dunning_email(sub, target_stage)
        sub.transition_status(
            'past_due',  # self-loop, per Phase 4's fix
            source_event=f'dunning:{target_stage}',
            extra_fields={'dunning_stage': target_stage},
        )

        if target_stage == 'day_7_final' and sub.grace_period_end and timezone.now() > sub.grace_period_end:
            sub.transition_status(
                'halted',
                source_event='dunning:grace_period_expired',
            )


def _send_dunning_email(sub, stage):
    """
    Escalating urgency per stage — day_1 is a gentle reminder, day_7_final
    is urgent with clear consequences stated.
    Uses django.core.mail.send_mail following the established project pattern.
    """
    from apps.notifications.models import Notification

    messages = {
        'day_1': (
            "Payment issue with your MediClinic subscription",
            f"Dear {sub.clinic.name} Admin,\n\n"
            f"We noticed a payment issue with your MediClinic {sub.plan.title()} subscription. "
            f"Please update your payment method to ensure uninterrupted service."
        ),
        'day_3': (
            "Action needed: update your payment method",
            f"Dear {sub.clinic.name} Admin,\n\n"
            f"Your payment method update is still pending for your MediClinic subscription. "
            f"Please update your payment billing details as soon as possible."
        ),
        'day_5': (
            "Your MediClinic access is at risk",
            f"Dear {sub.clinic.name} Admin,\n\n"
            f"Your MediClinic subscription payment is now 5 days past due. "
            f"Access to write/edit features for your clinic will be restricted if payment is not updated within 2 days."
        ),
        'day_7_final': (
            "Final notice: your MediClinic subscription will be restricted",
            f"Dear {sub.clinic.name} Admin,\n\n"
            f"This is your final notice regarding your past-due MediClinic subscription. "
            f"Your grace period is ending. Mutating actions on your account will be suspended until payment is restored."
        ),
    }

    if stage not in messages:
        return

    subject, body = messages[stage]

    # 1. Send Email to Clinic Admin
    clinic_admin_user = sub.clinic.users.filter(role='CLINIC_ADMIN').first()
    recipient_email = clinic_admin_user.email if clinic_admin_user else None

    if recipient_email:
        try:
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@mediclinic.com')
            send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=[recipient_email],
                fail_silently=True,
            )
            logger.info(
                "dunning_email_sent",
                extra={
                    'subscription_id': str(sub.pk),
                    'clinic_id': str(sub.clinic.pk),
                    'dunning_stage': stage,
                    'recipient_email': recipient_email,
                }
            )
        except Exception as e:
            logger.error(f"Failed to send dunning email ({stage}) to {recipient_email}: {e}")

    # 2. In-App Notification
    if clinic_admin_user:
        try:
            Notification.objects.create(
                recipient=clinic_admin_user,
                notification_type='SYSTEM',
                title=subject,
                message=body,
            )
        except Exception as e:
            logger.error(f"Failed to create dunning in-app notification ({stage}): {e}")
