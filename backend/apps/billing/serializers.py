from rest_framework import serializers
from .models import Invoice, PaymentTransaction, InvoiceItem

class PaymentTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentTransaction
        fields = '__all__'

class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = ['id', 'description', 'amount']

class InvoiceSerializer(serializers.ModelSerializer):
    transactions = PaymentTransactionSerializer(many=True, read_only=True)
    items = InvoiceItemSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = '__all__'

    def create(self, validated_data):
        items_data = self.initial_data.get('items', [])
        invoice = Invoice.objects.create(**validated_data)
        
        total = 0
        for item in items_data:
            InvoiceItem.objects.create(invoice=invoice, description=item.get('description'), amount=item.get('amount'))
            total += float(item.get('amount', 0))
            
        if not invoice.total_amount or float(invoice.total_amount) == 0:
            invoice.total_amount = total
            invoice.save()
            
        return invoice
