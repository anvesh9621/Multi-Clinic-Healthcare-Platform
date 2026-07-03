from django.db import models

class Clinic(models.Model):

    class SubscriptionChoices(models.TextChoices):
        BASIC = "BASIC", "Basic"
        PRO = "PRO", "Pro"
        ENTERPRISE = "ENTERPRISE", "Enterprise"

    name = models.CharField(max_length=255)

    address = models.TextField()

    # Map coordinates (optional — set via admin panel)
    latitude  = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    subscription_plan = models.CharField(
        max_length=20,
        choices=SubscriptionChoices.choices,
        default=SubscriptionChoices.BASIC
    )
    
    # Razorpay Route — for receiving patient payments
    razorpay_linked_account_id = models.CharField(max_length=100, blank=True)
    linked_account_status = models.CharField(max_length=30, default='not_started',
        choices=[('not_started','Not Started'),('kyc_submitted','KYC Submitted'),
                 ('kyc_under_review','Under Review'),('kyc_verified','Verified'),
                 ('kyc_rejected','Rejected')])
    kyc_rejection_reason = models.TextField(blank=True)
    
    # Bank details (store for reference after KYC)
    bank_account_number = models.CharField(max_length=50, blank=True)
    bank_ifsc = models.CharField(max_length=20, blank=True)
    bank_account_name = models.CharField(max_length=100, blank=True)
    business_pan = models.CharField(max_length=10, blank=True)
    gstin = models.CharField(max_length=15, blank=True)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name