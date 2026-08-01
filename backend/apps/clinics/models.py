import uuid
from datetime import timedelta
from django.utils import timezone
from django.db import models


class Clinic(models.Model):

    name = models.CharField(max_length=255)
    address = models.TextField()

    # Map coordinates (optional — set via admin panel)
    latitude  = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
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


class ReceptionistInvitation(models.Model):
    STATUS_CHOICES = (
        ("PENDING", "Pending"),
        ("ACCEPTED", "Accepted"),
        ("EXPIRED", "Expired"),
        ("CANCELLED", "Cancelled"),
    )

    clinic = models.ForeignKey(
        Clinic,
        on_delete=models.CASCADE,
        related_name="receptionist_invitations"
    )
    email = models.EmailField()
    token = models.CharField(max_length=64, default=uuid.uuid4, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        unique_together = ("clinic", "email", "status")

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=48)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        return self.status == "PENDING" and self.expires_at > timezone.now()

    def __str__(self):
        return f"Receptionist Invite: {self.email} to {self.clinic.name} ({self.status})"