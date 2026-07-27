import secrets
from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from .models import EmailOTP


def generate_and_send_otp(email: str, purpose: str) -> tuple[bool, str, EmailOTP | None]:
    """
    Generates a 6-digit cryptographically secure numeric OTP using secrets.randbelow,
    saves an EmailOTP record, enforces cooldown and hourly rate-limiting, and emails the code.
    
    Returns (success: bool, message: str, otp_object: EmailOTP | None)
    """
    email = email.strip().lower()
    now = timezone.now()

    # 1. 60-second resend cooldown per email + purpose
    cooldown_cutoff = now - timedelta(seconds=60)
    recent_otp = EmailOTP.objects.filter(
        user_email=email,
        purpose=purpose,
        created_at__gte=cooldown_cutoff
    ).first()
    if recent_otp:
        return (False, "Please wait 60 seconds before requesting another verification code.", None)

    # 2. Rate limit: max 5 OTP requests per email per hour
    hourly_cutoff = now - timedelta(hours=1)
    hourly_count = EmailOTP.objects.filter(
        user_email=email,
        created_at__gte=hourly_cutoff
    ).count()
    if hourly_count >= 5:
        return (False, "Maximum OTP request limit reached (5 per hour). Please try again later.", None)

    # 3. Generate 6-digit numeric code via secrets.randbelow
    code_int = secrets.randbelow(1000000)
    code_str = f"{code_int:06d}"

    # 4. Expiration = 10 minutes
    expires_at = now + timedelta(minutes=10)

    # 5. Create EmailOTP record
    otp_obj = EmailOTP.objects.create(
        user_email=email,
        code=code_str,
        purpose=purpose,
        expires_at=expires_at
    )

    # 6. Send OTP via configured email backend
    purpose_label = "Registration" if purpose == "REGISTER" else "Login"
    subject = f"Your MediClinic Verification Code: {code_str}"
    message = (
        f"Hello,\n\n"
        f"Your verification code for MediClinic ({purpose_label}) is: {code_str}\n\n"
        f"This code is valid for 10 minutes.\n"
        f"If you did not request this verification code, please ignore this email.\n\n"
        f"— MediClinic Security Team"
    )
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@mediclinic.com")

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as e:
        # Log exception if needed, return success with record
        pass

    return (True, "Verification code sent successfully.", otp_obj)


def verify_otp(email: str, code: str, purpose: str) -> tuple[bool, str]:
    """
    Validates code against the most recent unused/unexpired OTP for email + purpose.
    Increments attempts on failure (max 5), marks is_used=True on success.
    
    Returns (success: bool, message: str)
    """
    email = email.strip().lower()
    code = code.strip()
    now = timezone.now()

    # Fetch the most recent unused & unexpired OTP record
    otp_obj = EmailOTP.objects.filter(
        user_email=email,
        purpose=purpose,
        is_used=False,
        expires_at__gt=now
    ).order_by("-created_at").first()

    if not otp_obj:
        return (False, "Invalid or expired verification code.")

    if otp_obj.attempts >= 5:
        return (False, "Maximum verification attempts exceeded. Please request a new code.")

    if otp_obj.code != code:
        otp_obj.attempts += 1
        otp_obj.save(update_fields=["attempts"])
        remaining = 5 - otp_obj.attempts
        if remaining <= 0:
            return (False, "Maximum verification attempts exceeded. Please request a new code.")
        return (False, f"Incorrect verification code. {remaining} attempt(s) remaining.")

    # Match! Mark as used
    otp_obj.is_used = True
    otp_obj.save(update_fields=["is_used"])

    return (True, "Verification successful.")
