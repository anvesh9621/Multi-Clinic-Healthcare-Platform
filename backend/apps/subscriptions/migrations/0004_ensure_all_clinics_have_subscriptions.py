from django.db import migrations
from django.utils import timezone
from datetime import timedelta

def ensure_subscriptions(apps, schema_editor):
    Clinic = apps.get_model('clinics', 'Clinic')
    Subscription = apps.get_model('subscriptions', 'Subscription')
    
    PLAN_TO_SUB_PLAN = {
        "BASIC": "starter",
        "PRO": "professional",
        "ENTERPRISE": "enterprise",
    }
    
    clinics_without_sub = Clinic.objects.filter(subscription__isnull=True)
    trial_end_date = timezone.now() + timedelta(days=14)
    
    for clinic in clinics_without_sub:
        raw_plan = getattr(clinic, 'subscription_plan', '') or ''
        plan_name = PLAN_TO_SUB_PLAN.get(raw_plan.upper(), 'starter')
        Subscription.objects.create(
            clinic=clinic,
            status='trialing',
            plan=plan_name,
            trial_end=trial_end_date
        )

def reverse_func(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('subscriptions', '0003_backfill_clinic_subscriptions'),
    ]

    operations = [
        migrations.RunPython(ensure_subscriptions, reverse_func),
    ]
