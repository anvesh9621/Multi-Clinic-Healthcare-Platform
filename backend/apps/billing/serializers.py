from rest_framework import serializers
from django.utils import timezone
from .models import Invoice


class InvoiceSerializer(serializers.ModelSerializer):
    """
    Full serializer for the Invoice model.
    Adds computed fields: minutes_remaining, patient_display_name.
    """
    # Read-only computed fields
    paid_at = serializers.DateTimeField(read_only=True)
    razorpay_payment_link_short_url = serializers.CharField(read_only=True)
    payment_link_status = serializers.CharField(read_only=True)
    minutes_remaining = serializers.SerializerMethodField()

    # Writeable fields (subset of what staff may set on create)
    payment_method = serializers.ChoiceField(
        choices=Invoice._meta.get_field('payment_method').choices,
        required=False
    )

    class Meta:
        model = Invoice
        fields = [
            'id',
            'clinic',
            'patient',
            'appointment',
            'amount',
            'gst_amount',
            'total_amount',
            'status',
            'payment_method',
            # Razorpay link fields
            'razorpay_payment_link_id',
            'razorpay_payment_link_url',
            'razorpay_payment_link_short_url',
            'payment_link_status',
            'payment_link_expires_at',
            # After payment
            'razorpay_payment_id',
            'paid_at',
            # Refund
            'refund_id',
            'refunded_at',
            'refund_reason',
            # Timestamps
            'notes',
            'created_at',
            'updated_at',
            # Computed
            'minutes_remaining',
        ]
        read_only_fields = [
            'id',
            'paid_at',
            'razorpay_payment_link_short_url',
            'payment_link_status',
            'payment_link_expires_at',
            'razorpay_payment_id',
            'refund_id',
            'refunded_at',
            'created_at',
            'updated_at',
            'minutes_remaining',
        ]

    def get_minutes_remaining(self, obj) -> int | None:
        """Returns minutes remaining on the active payment link, or None if expired/absent."""
        if obj.razorpay_payment_link_id and obj.payment_link_expires_at:
            remaining = obj.payment_link_expires_at - timezone.now()
            if remaining.total_seconds() > 0:
                return int(remaining.total_seconds() / 60)
        return None
