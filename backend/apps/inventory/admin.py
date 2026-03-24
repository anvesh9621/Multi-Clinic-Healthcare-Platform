from django.contrib import admin
from .models import InventoryItem, StockTransaction

@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'sku', 'quantity', 'restock_threshold', 'unit_price')
    list_filter = ('category',)
    search_fields = ('name', 'sku')

@admin.register(StockTransaction)
class StockTransactionAdmin(admin.ModelAdmin):
    list_display = ('item', 'transaction_type', 'quantity_change', 'created_at')
    list_filter = ('transaction_type', 'created_at')
