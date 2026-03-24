from rest_framework import serializers
from .models import InventoryItem, StockTransaction

class StockTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockTransaction
        fields = '__all__'

class InventoryItemSerializer(serializers.ModelSerializer):
    transactions = StockTransactionSerializer(many=True, read_only=True)

    class Meta:
        model = InventoryItem
        fields = '__all__'
