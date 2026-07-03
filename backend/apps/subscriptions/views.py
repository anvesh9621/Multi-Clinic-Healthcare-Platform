from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from apps.subscriptions.permissions import IsClinicAdminOnly, IsClinicAdminOrSuperAdmin
from django.conf import settings
from apps.billing.razorpay_client import get_razorpay_client
from .models import Subscription
import hmac
import hashlib
import logging

logger = logging.getLogger(__name__)

class CreateSubscriptionView(APIView):
    permission_classes = [IsAuthenticated, IsClinicAdminOnly]

    def post(self, request):
        clinic = getattr(request.user, 'clinic', None)
        if not clinic:
            return Response({'error': 'User is not associated with a clinic.'}, status=status.HTTP_403_FORBIDDEN)
            
        plan = request.data.get('plan')
        if not plan or plan not in ['professional', 'enterprise']:
            return Response({'error': 'Valid plan is required (professional or enterprise).'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            client = get_razorpay_client()
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
        sub, _ = Subscription.objects.get_or_create(clinic=clinic)
        
        # 1. Create Customer if needed
        if not sub.razorpay_customer_id:
            customer_data = {
                "name": clinic.name,
                "email": request.user.email,
                "contact": request.user.phone_number if hasattr(request.user, 'phone_number') and request.user.phone_number else "",
                "fail_existing": "0",
            }
            try:
                customer = client.customer.create(data=customer_data)
                sub.razorpay_customer_id = customer['id']
                sub.save()
            except Exception as e:
                return Response({'error': f"Customer creation failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 2. Create Subscription
        plan_id = settings.RAZORPAY_PLAN_IDS.get(plan)
        if not plan_id:
            return Response({'error': f'Razorpay Plan ID for {plan} is missing. Please add RAZORPAY_PLAN_ID_{plan.upper()} to your .env file.'}, status=status.HTTP_400_BAD_REQUEST)

        subscription_data = {
            'plan_id': plan_id,
            'customer_notify': 1,
            'quantity': 1,
            'total_count': 120,  # 10 years — effectively indefinite
            'notes': {
                'clinic_id': str(clinic.id),
                'clinic_name': clinic.name,
            }
        }

        try:
            rzp_sub = client.subscription.create(data=subscription_data)
            sub.razorpay_subscription_id = rzp_sub['id']
            sub.razorpay_plan_id = plan_id
            sub.plan = plan
            sub.status = 'created'  # Will become active after e-mandate + first charge
            sub.save()

            # Get the publishable key to send to frontend
            from apps.billing.models import PlatformSettings
            settings_obj = PlatformSettings.objects.first()
            key_id = (settings_obj.razorpay_key_id if settings_obj and settings_obj.razorpay_key_id
                      else getattr(settings, 'RAZORPAY_KEY_ID', ''))

            return Response({
                'subscription_id': rzp_sub['id'],
                'razorpay_key': key_id,
            })
        except Exception as e:
            logger.error(f"Subscription creation failed: {e}")
            return Response({'error': f"Subscription creation failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SubscriptionStatusView(APIView):
    # SUPER_ADMIN can also call this to inspect any clinic's status
    permission_classes = [IsAuthenticated, IsClinicAdminOrSuperAdmin]

    def get(self, request):
        clinic = getattr(request.user, 'clinic', None)
        if not clinic:
            return Response({'error': 'User is not associated with a clinic.'}, status=status.HTTP_403_FORBIDDEN)
            
        sub = getattr(clinic, 'subscription', None)
        if not sub:
            return Response({
                'status': 'inactive',
                'plan': 'starter',
                'trial_end': None,
                'current_period_end': None,
                'grace_period_end': None,
                'show_warning': False,
                'warning_message': ''
            })

        show_warning = False
        warning_message = ''
        
        if sub.status == 'past_due':
            show_warning = True
            grace_end_str = sub.grace_period_end.strftime('%B %d, %Y') if sub.grace_period_end else "soon"
            warning_message = f"Payment failed. Update your payment method to avoid suspension on {grace_end_str}."

        return Response({
            'status': sub.status,
            'plan': sub.plan,
            'trial_end': sub.trial_end,
            'current_period_end': sub.current_period_end,
            'grace_period_end': sub.grace_period_end,
            'show_warning': show_warning,
            'warning_message': warning_message
        })


class CancelSubscriptionView(APIView):
    permission_classes = [IsAuthenticated, IsClinicAdminOnly]

    def post(self, request):
        clinic = getattr(request.user, 'clinic', None)
        if not clinic:
            return Response({'error': 'User is not associated with a clinic.'}, status=status.HTTP_403_FORBIDDEN)
            
        sub = getattr(clinic, 'subscription', None)
        if not sub or not sub.razorpay_subscription_id:
            return Response({'error': 'No active subscription found.'}, status=status.HTTP_400_BAD_REQUEST)
            
        client = get_razorpay_client()
        
        try:
            client.subscription.cancel(sub.razorpay_subscription_id, {"cancel_at_cycle_end": 0})
            sub.status = 'cancelled'
            sub.save()
            return Response({'message': 'Subscription cancelled successfully.'})
        except Exception as e:
            return Response({'error': f"Subscription cancellation failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifySubscriptionView(APIView):
    """
    POST /api/subscriptions/verify/
    Called by frontend after Razorpay e-mandate succeeds.
    Verifies the HMAC signature and marks the subscription as active.
    """
    permission_classes = [IsAuthenticated, IsClinicAdminOnly]

    def post(self, request):
        clinic = getattr(request.user, 'clinic', None)
        if not clinic:
            return Response({'error': 'Not associated with a clinic.'}, status=status.HTTP_403_FORBIDDEN)

        payment_id = request.data.get('razorpay_payment_id', '')
        subscription_id = request.data.get('razorpay_subscription_id', '')
        signature = request.data.get('razorpay_signature', '')

        if not all([payment_id, subscription_id, signature]):
            return Response(
                {'error': 'razorpay_payment_id, razorpay_subscription_id, and razorpay_signature are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Retrieve secret key
        from apps.billing.models import PlatformSettings
        settings_obj = PlatformSettings.objects.first()
        secret = (settings_obj.razorpay_key_secret if settings_obj and settings_obj.razorpay_key_secret
                  else getattr(settings, 'RAZORPAY_KEY_SECRET', ''))

        if not secret:
            return Response({'error': 'Payment gateway secret is not configured.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # HMAC-SHA256 verification
        message = f"{payment_id}|{subscription_id}"
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_signature, signature):
            logger.warning(f"Subscription payment signature mismatch for clinic {clinic.id}")
            return Response({'error': 'Payment verification failed. Invalid signature.'}, status=status.HTTP_400_BAD_REQUEST)

        # Signature valid — activate the subscription
        sub, _ = Subscription.objects.get_or_create(clinic=clinic)
        sub.razorpay_subscription_id = subscription_id
        sub.status = 'active'
        sub.save()

        logger.info(f"Subscription verified and activated for clinic {clinic.id} (sub_id={subscription_id})")
        return Response({'success': True, 'message': 'Subscription activated successfully.'})


class SubscriptionInvoiceListView(APIView):
    permission_classes = [IsAuthenticated, IsClinicAdminOnly]

    def get(self, request):
        clinic = getattr(request.user, 'clinic', None)
        if not clinic:
            return Response({'error': 'User is not associated with a clinic.'}, status=status.HTTP_403_FORBIDDEN)
            
        from apps.billing.models import SubscriptionInvoice
        invoices = SubscriptionInvoice.objects.filter(clinic=clinic).order_by('-issued_at')
        
        data = []
        for inv in invoices:
            data.append({
                'id': inv.id,
                'invoice_number': inv.invoice_number,
                'total_amount': str(inv.total_amount),
                'period_start': inv.period_start,
                'period_end': inv.period_end,
                'issued_at': inv.issued_at,
                'has_pdf': bool(inv.pdf_path)
            })
            
        return Response(data)


class SubscriptionInvoiceDownloadView(APIView):
    permission_classes = [IsAuthenticated, IsClinicAdminOnly]

    def get(self, request, pk):
        clinic = getattr(request.user, 'clinic', None)
        if not clinic:
            return Response({'error': 'User is not associated with a clinic.'}, status=status.HTTP_403_FORBIDDEN)
            
        from apps.billing.models import SubscriptionInvoice
        from django.http import FileResponse
        import os
        
        try:
            inv = SubscriptionInvoice.objects.get(id=pk, clinic=clinic)
        except SubscriptionInvoice.DoesNotExist:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)
            
        if not inv.pdf_path or not os.path.exists(inv.pdf_path):
            return Response({'error': 'PDF not generated yet.'}, status=status.HTTP_404_NOT_FOUND)
            
        return FileResponse(open(inv.pdf_path, 'rb'), content_type='application/pdf', filename=f"{inv.invoice_number}.pdf")
