from django.db import models
from django.utils import timezone
from apps.billing.models import (
    SubscriptionInvoice,
    SUBSCRIPTION_INVOICE_ALLOWED_TRANSITIONS,
    InvalidStatusTransition,
)

PLAN_FEATURES = {
    'starter': {
        'max_doctors': 1,
        'analytics': False,
        'billing': False,
        'inventory': False,
        'multi_clinic': False,
        'label': 'Starter',
        'price': 0,
    },
    'professional': {
        'max_doctors': 10,
        'analytics': True,
        'billing': True,
        'inventory': True,
        'multi_clinic': False,
        'label': 'Professional',
        'price': 999,
    },
    'enterprise': {
        'max_doctors': None,
        'analytics': True,
        'billing': True,
        'inventory': True,
        'multi_clinic': True,
        'label': 'Enterprise',
        'price': 2999,
    },
}

class Subscription(models.Model):
    clinic = models.OneToOneField('clinics.Clinic', on_delete=models.CASCADE, related_name='subscription')
    
    # Razorpay IDs
    razorpay_customer_id = models.CharField(max_length=100, blank=True)
    razorpay_subscription_id = models.CharField(max_length=100, blank=True)
    razorpay_plan_id = models.CharField(max_length=100, blank=True)
    
    # Plan
    plan = models.CharField(max_length=50, default='starter',
        choices=[('starter','Starter'),('professional','Professional'),('enterprise','Enterprise')])
    
    # Status — single source of truth
    status = models.CharField(max_length=30, default='trialing',
        choices=[('trialing','Trialing'),('active','Active'),('past_due','Past Due'),
                 ('halted','Halted'),('cancelled','Cancelled'),('expired','Expired')])
    
    # Dates
    trial_end = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    
    # Grace period tracking
    payment_failed_at = models.DateTimeField(null=True, blank=True)
    grace_period_end = models.DateTimeField(null=True, blank=True)  # failed_at + 10 days
    
    # GST
    clinic_gstin = models.CharField(max_length=15, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.clinic.name} — {self.plan} ({self.status})"

    @property
    def features(self):
        return PLAN_FEATURES.get(self.plan, PLAN_FEATURES['starter'])

    @property
    def is_active(self):
        return self.status in ['active', 'trialing', 'past_due']
