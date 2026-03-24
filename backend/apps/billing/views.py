import stripe
import json
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.views.decorators.csrf import csrf_exempt
from .models import Invoice, PaymentTransaction
from .serializers import InvoiceSerializer

# Configure mock/test keys if not provided in settings
stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', 'sk_test_dummy')

class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'PATIENT':
            return Invoice.objects.filter(patient__user=user)
        return Invoice.objects.all()

    @action(detail=True, methods=['post'], url_path='create-payment-intent')
    def create_payment_intent(self, request, pk=None):
        invoice = self.get_object()
        
        try:
            intent = stripe.PaymentIntent.create(
                amount=int(invoice.total_amount * 100),  # Stripe processes in cents
                currency='usd',
                metadata={'invoice_id': invoice.id}
            )
            
            invoice.stripe_payment_intent_id = intent['id']
            invoice.save()

            return Response({
                'clientSecret': intent['client_secret']
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def stripe_webhook(request):
    """
    Webhook endpoint to verify payments asynchronously directly from Stripe's servers.
    """
    payload = request.body

    try:
        # Note: In a production environment, you verify the signature using:
        # sig_header = request.headers.get('STRIPE_SIGNATURE', '')
        # event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        event = json.loads(payload.decode('utf-8'))
    except Exception as e:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    if event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        invoice_id = payment_intent.get('metadata', {}).get('invoice_id')
        
        if invoice_id:
            try:
                invoice = Invoice.objects.get(id=invoice_id)
                invoice.status = Invoice.StatusChoices.PAID
                invoice.amount_paid = invoice.total_amount
                invoice.save()
                
                PaymentTransaction.objects.create(
                    invoice=invoice,
                    amount=invoice.total_amount,
                    stripe_charge_id=payment_intent.get('latest_charge'),
                    status='SUCCESS'
                )
            except Invoice.DoesNotExist:
                pass

    return Response(status=status.HTTP_200_OK)
