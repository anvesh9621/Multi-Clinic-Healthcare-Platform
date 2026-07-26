from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.clinics.models import Clinic
from .models import Subscription
from django.utils import timezone
from datetime import timedelta

PLAN_TO_SUB_PLAN = {
    "BASIC": "starter",
    "PRO": "professional",
    "ENTERPRISE": "enterprise",
}

SUB_PLAN_TO_CLINIC_PLAN = {
    "starter": "BASIC",
    "professional": "PRO",
    "enterprise": "ENTERPRISE",
}


@receiver(post_save, sender=Clinic)
def create_clinic_subscription(sender, instance, created, **kwargs):
    if created:
        plan_name = PLAN_TO_SUB_PLAN.get((instance.subscription_plan or "").upper(), "starter")
        Subscription.objects.get_or_create(
            clinic=instance,
            defaults={
                'status': 'trialing',
                'plan': plan_name,
                'trial_end': timezone.now() + timedelta(days=14)
            }
        )


@receiver(post_save, sender=Subscription)
def sync_clinic_subscription_plan(sender, instance, **kwargs):
    if instance.clinic:
        clinic_plan = SUB_PLAN_TO_CLINIC_PLAN.get(instance.plan, instance.plan.upper())
        if instance.clinic.subscription_plan != clinic_plan:
            Clinic.objects.filter(id=instance.clinic.id).update(subscription_plan=clinic_plan)
