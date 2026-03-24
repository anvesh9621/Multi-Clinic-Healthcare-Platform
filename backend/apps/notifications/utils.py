import os
from django.core.mail import send_mail
from django.conf import settings

import logging

logger = logging.getLogger(__name__)

def send_appointment_email(to_email, subject, message):
    """
    Sends an email using Django's built-in mail utilities (which falls back to console in DEBUG).
    In production, this routes through SendGrid.
    """
    try:
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@mediclinic.com')
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=[to_email],
            fail_silently=False,
        )
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False

def send_twilio_sms(to_phone, message):
    """
    Sends an SMS via Twilio.
    If credentials are not provided in environment, it will safely mock the action.
    """
    twilio_account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    twilio_auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
    twilio_phone_number = os.environ.get('TWILIO_PHONE_NUMBER', '+1234567890')

    try:
        if twilio_account_sid and twilio_auth_token:
            from twilio.rest import Client
            client = Client(twilio_account_sid, twilio_auth_token)
            
            message_instance = client.messages.create(
                body=message,
                from_=twilio_phone_number,
                to=to_phone
            )
            logger.info(f"Twilio SMS sent to {to_phone}. SID: {message_instance.sid}")
            return True
        else:
            # Fallback Mock Logic
            print("\n" + "="*60)
            print(f"📞 TWILIO SMS MOCK DISPATCH")
            print(f"TO: {to_phone}")
            print(f"MESSAGE: {message}")
            print("="*60 + "\n")
            logger.info(f"MOCKED Twilio SMS sent to {to_phone}.")
            return True
            
    except Exception as e:
        logger.error(f"Failed to send Twilio SMS to {to_phone}: {str(e)}")
        return False
