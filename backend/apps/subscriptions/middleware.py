from rest_framework_simplejwt.authentication import JWTAuthentication
from django.utils import timezone
from django.http import JsonResponse
import logging

logger = logging.getLogger(__name__)

class SubscriptionEnforcementMiddleware:
    """
    Middleware that enforces subscription states globally.
    If a clinic's subscription is past_due and the grace period has expired,
    it blocks all POST/PUT/PATCH/DELETE API requests with a 403 error,
    effectively making the platform read-only for them until they pay.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. Only block mutating API requests. GET/OPTIONS/HEAD remain allowed.
        if request.method in ['GET', 'OPTIONS', 'HEAD']:
            return self.get_response(request)
            
        # 2. Only intercept /api/ requests
        if not request.path.startswith('/api/'):
            return self.get_response(request)
            
        # 3. Whitelist authentication, webhooks, and subscription endpoints
        if (request.path.startswith('/api/accounts/') or 
            request.path.startswith('/api/billing/webhook/') or
            request.path.startswith('/api/subscriptions/')):
            return self.get_response(request)
            
        user = getattr(request, 'user', None)
        
        # In Django middleware, DRF hasn't attached the user yet if using JWT.
        # So we manually parse the JWT here to identify the clinic.
        if not user or not user.is_authenticated:
            try:
                auth = JWTAuthentication()
                auth_tuple = auth.authenticate(request)
                if auth_tuple is not None:
                    user = auth_tuple[0]
            except Exception:
                pass
                
        if user and user.is_authenticated:
            clinic = getattr(user, 'clinic', None)
            if clinic:
                sub = getattr(clinic, 'subscription', None)
                if sub and sub.status == 'past_due' and sub.grace_period_end:
                    if timezone.now() > sub.grace_period_end:
                        return JsonResponse({
                            'error': 'Account suspended due to unpaid invoices. Please update your payment method to restore access.'
                        }, status=403)
                        
        return self.get_response(request)
