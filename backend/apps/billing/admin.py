from django.contrib import admin
from .models import Invoice, PaymentTransaction

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'total_amount', 'status', 'issued_date')
    list_filter = ('status', 'issued_date')
    search_fields = ('patient__user__email', 'stripe_payment_intent_id')

@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'invoice', 'amount', 'status', 'created_at')
