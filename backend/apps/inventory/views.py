from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import InventoryItem, StockTransaction
from .serializers import InventoryItemSerializer, StockTransactionSerializer

class InventoryItemViewSet(viewsets.ModelViewSet):
    queryset = InventoryItem.objects.all().order_by('name')
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'], url_path='adjust-stock')
    def adjust_stock(self, request, pk=None):
        item = self.get_object()
        transaction_type = request.data.get('transaction_type')
        quantity_change = request.data.get('quantity_change')
        reason = request.data.get('reason', '')

        try:
            quantity_change = int(quantity_change)
        except (ValueError, TypeError):
            return Response({'error': 'Invalid quantity change'}, status=status.HTTP_400_BAD_REQUEST)

        if not transaction_type in dict(StockTransaction.TransactionType.choices):
            return Response({'error': 'Invalid transaction type'}, status=status.HTTP_400_BAD_REQUEST)

        if transaction_type == StockTransaction.TransactionType.DEDUCT:
            if item.quantity - quantity_change < 0:
                return Response({'error': 'Insufficient stock'}, status=status.HTTP_400_BAD_REQUEST)
            item.quantity -= quantity_change
        else:
            item.quantity += quantity_change
            
        item.save()

        txn = StockTransaction.objects.create(
            item=item,
            transaction_type=transaction_type,
            quantity_change=quantity_change,
            reason=reason
        )

        return Response({
            'item': InventoryItemSerializer(item).data,
            'transaction': StockTransactionSerializer(txn).data
        })
