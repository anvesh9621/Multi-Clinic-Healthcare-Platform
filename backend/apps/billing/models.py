import uuid
from django.db import models
from django.db.models import Q, CheckConstraint
from django.conf import settings

class Invoice(models.Model):
    clinic = models.ForeignKey('clinics.Clinic', on_delete=models.CASCADE)
    patient = models.ForeignKey('patients.Patient', on_delete=models.CASCADE)
    appointment = models.ForeignKey('appointments.Appointment', on_delete=models.SET_NULL, null=True)
    
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    status = models.CharField(max_length=20, default='draft',
        choices=[('draft','Draft'),('pending','Pending'),('paid','Paid'),
                 ('expired','Expired'),('cancelled','Cancelled'),('refunded','Refunded'),
                 ('pending_at_clinic','Pending at Clinic')])
    
    payment_method = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('cash', 'Cash'),
            ('upi', 'UPI'),
            ('card', 'Card'),
        ],
        default='pending'
    )
    
    # Razorpay Payment Link fields
    razorpay_payment_link_id = models.CharField(max_length=100, blank=True)
    razorpay_payment_link_url = models.URLField(blank=True)
    razorpay_payment_link_short_url = models.URLField(blank=True)
    payment_link_status = models.CharField(max_length=20, default='not_generated')
    payment_link_expires_at = models.DateTimeField(null=True, blank=True)
    
    # After payment
    razorpay_payment_id = models.CharField(max_length=100, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    
    # Refund
    refund_id = models.CharField(max_length=100, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    refund_reason = models.TextField(blank=True)
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class WebhookEvent(models.Model):
    event_id = models.CharField(max_length=100, unique=True)
    event_type = models.CharField(max_length=100)
    processed_at = models.DateTimeField(auto_now_add=True)
    raw_payload = models.JSONField()
    processing_status = models.CharField(max_length=20, default='processed',
        choices=[('processed','Processed'),('failed','Failed'),('skipped','Skipped')])
    error_message = models.TextField(blank=True)

    class Meta:
        indexes = [models.Index(fields=['event_id']), models.Index(fields=['event_type'])]

class SubscriptionInvoice(models.Model):
    subscription = models.ForeignKey('subscriptions.Subscription', on_delete=models.CASCADE)
    clinic = models.ForeignKey('clinics.Clinic', on_delete=models.CASCADE)
    
    invoice_number = models.CharField(max_length=50, unique=True)  # MC-2024-001
    amount_before_gst = models.DecimalField(max_digits=10, decimal_places=2)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18.00)
    cgst = models.DecimalField(max_digits=10, decimal_places=2)
    sgst = models.DecimalField(max_digits=10, decimal_places=2)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    razorpay_payment_id = models.CharField(max_length=100, blank=True)
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()
    
    pdf_path = models.CharField(max_length=255, blank=True)
    issued_at = models.DateTimeField(auto_now_add=True)

class PlatformSettings(models.Model):
    """
    Global settings for the platform (Super Admin config).
    Acts as a singleton (only one row).
    """
    razorpay_key_id = models.CharField(max_length=255, blank=True, null=True)
    razorpay_key_secret = models.CharField(max_length=255, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return "Platform Settings"


class PaymentIdempotencyKey(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    operation_type = models.CharField(max_length=50)
    reference_id = models.CharField(max_length=100)
    razorpay_response = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=20, default='pending', choices=[
        ('pending', 'Pending'), ('completed', 'Completed'), ('failed', 'Failed'),
    ])
    created_at = models.DateTimeField(auto_now_add=True)


class PaymentLedgerEntry(models.Model):
    """
    THE SOURCE OF TRUTH for all money movement across both appointment
    payments and subscription billing. Append-only — application code
    must never update or delete rows in this table. Exactly one of
    `invoice` / `subscription_invoice` is set per entry, enforced at the
    database level.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey('billing.Invoice', on_delete=models.PROTECT, related_name='ledger_entries', null=True, blank=True)
    subscription_invoice = models.ForeignKey('billing.SubscriptionInvoice', on_delete=models.PROTECT, related_name='ledger_entries', null=True, blank=True)
    entry_type = models.CharField(max_length=20, choices=[('debit', 'Debit'), ('credit', 'Credit')])
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    resulting_status = models.CharField(max_length=20)
    source_event = models.CharField(max_length=50)
    razorpay_reference = models.CharField(max_length=100, blank=True)
    idempotency_key = models.ForeignKey(PaymentIdempotencyKey, on_delete=models.PROTECT, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['invoice', 'created_at']),
            models.Index(fields=['subscription_invoice', 'created_at']),
        ]
        constraints = [
            CheckConstraint(
                condition=(
                    Q(invoice__isnull=False, subscription_invoice__isnull=True) |
                    Q(invoice__isnull=True, subscription_invoice__isnull=False)
                ),
                name='ledger_entry_exactly_one_target',
            )
        ]

    def __str__(self):
        target = self.invoice_id or self.subscription_invoice_id
        return f"{self.entry_type} {self.amount} {self.currency} -> {self.resulting_status} ({target})"

