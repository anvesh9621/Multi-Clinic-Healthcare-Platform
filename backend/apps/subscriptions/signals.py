from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.clinics.models import Clinic
from .models import Subscription
from django.utils import timezone
from datetime import timedelta

@receiver(post_save, sender=Clinic)
def create_clinic_subscription(sender, instance, created, **kwargs):
    if created:
        Subscription.objects.get_or_create(
            clinic=instance,
            defaults={
                'status': 'trialing',
                'plan': 'starter',
                'trial_end': timezone.now() + timedelta(days=14)
            }
        )
