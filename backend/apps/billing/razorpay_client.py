import razorpay
from django.conf import settings

def get_razorpay_client():
    """
    Returns an authenticated Razorpay Client instance.
    Reads from PlatformSettings if configured, else falls back to .env settings.
    """
    from apps.billing.models import PlatformSettings
    settings_obj = PlatformSettings.objects.first()
    
    key_id = getattr(settings_obj, 'razorpay_key_id', None) or settings.RAZORPAY_KEY_ID
    key_secret = getattr(settings_obj, 'razorpay_key_secret', None) or settings.RAZORPAY_KEY_SECRET

    if not key_id or not key_secret:
        raise ValueError("Razorpay keys are missing from settings. Please configure them in the Super Admin dashboard or .env file.")
        
    return razorpay.Client(auth=(key_id, key_secret))
