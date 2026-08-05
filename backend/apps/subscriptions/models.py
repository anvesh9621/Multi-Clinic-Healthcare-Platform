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

import logging

logger = logging.getLogger(__name__)

SUBSCRIPTION_ALLOWED_TRANSITIONS = {
    'trialing': ['created', 'active', 'cancelled'],
    'created': ['active', 'cancelled', 'trialing'],
    'active': ['created', 'active', 'past_due', 'cancelled', 'trialing'],
    'past_due': ['active', 'halted', 'cancelled', 'trialing'],
    'halted': ['active', 'cancelled', 'expired', 'trialing'],
    'cancelled': ['created', 'active', 'trialing'],
    'expired': ['created', 'active', 'trialing'],
}


class InvalidSubscriptionTransition(Exception):
    pass


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
        choices=[('trialing','Trialing'),('created','Created'),('active','Active'),('past_due','Past Due'),
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

    def transition_status(self, new_status, *, source_event, extra_fields=None):
        """
        The only method that should change Subscription.status. Locks the
        row, validates the transition, applies the status change plus any
        related fields (payment_failed_at, grace_period_end, etc.) in one
        atomic operation. Does NOT create a PaymentLedgerEntry — Subscription
        is access-control state, not a financial record; SubscriptionInvoice
        already carries the actual billing ledger.
        """
        from django.db import transaction

        with transaction.atomic():
            locked = Subscription.objects.select_for_update().get(pk=self.pk)
            old_status = locked.status
            if new_status not in SUBSCRIPTION_ALLOWED_TRANSITIONS.get(old_status, []):
                raise InvalidSubscriptionTransition(
                    f"Subscription {locked.pk}: {old_status} -> {new_status} not allowed "
                    f"(triggered by {source_event})"
                )
            locked.status = new_status
            update_fields = ['status']
            if extra_fields:
                for field, value in extra_fields.items():
                    setattr(locked, field, value)
                    update_fields.append(field)
            locked.save(update_fields=update_fields)
            logger.info(f"Subscription {locked.pk} transitioned {old_status} -> {new_status} via {source_event}")
        return locked

