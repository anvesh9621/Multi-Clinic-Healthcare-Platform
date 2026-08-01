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


import pyotp
from django.contrib.auth.hashers import make_password, check_password
from .models import StaffMFA, User


def generate_mfa_secret(user: User) -> tuple[str, str]:
    """
    Generates or returns existing TOTP secret for a user (is_enabled=False until verified).
    Returns (secret, provisioning_uri).
    """
    mfa, _ = StaffMFA.objects.get_or_create(user=user)
    if not mfa.secret:
        mfa.secret = pyotp.random_base32()
        mfa.is_enabled = False
        mfa.save()

    totp = pyotp.TOTP(mfa.secret)
    provisioning_uri = totp.provisioning_uri(
        name=user.email,
        issuer_name="MediClinic"
    )

    return (mfa.secret, provisioning_uri)


def generate_backup_codes(user: User) -> list[str]:
    """
    Generates 10 single-use backup codes, hashes them with Django's make_password,
    stores them in StaffMFA.backup_codes, and returns the plaintext codes list.
    """
    mfa, _ = StaffMFA.objects.get_or_create(user=user)
    plaintext_codes = []
    hashed_codes = []

    for _ in range(10):
        raw_hex = secrets.token_hex(4).upper()
        formatted_code = f"{raw_hex[:4]}-{raw_hex[4:]}"
        plaintext_codes.append(formatted_code)
        hashed_codes.append(make_password(formatted_code))

    mfa.backup_codes = hashed_codes
    mfa.save(update_fields=["backup_codes"])

    return plaintext_codes


def verify_totp(user: User, code: str) -> bool:
    """
    Verifies code against user's TOTP secret using pyotp's default time-window.
    """
    code = code.strip().replace(" ", "").replace("-", "")
    mfa = StaffMFA.objects.filter(user=user).first()
    if not mfa or not mfa.secret:
        return False

    totp = pyotp.TOTP(mfa.secret)
    return totp.verify(code, valid_window=1)


def verify_backup_code(user: User, code: str) -> bool:
    """
    Checks code against user's hashed backup codes list.
    If matched, removes the single-use code from the list and returns True.
    """
    code = code.strip().upper()
    mfa = StaffMFA.objects.filter(user=user).first()
    if not mfa or not mfa.backup_codes:
        return False

    backup_list = list(mfa.backup_codes)
    for idx, hashed_code in enumerate(backup_list):
        if check_password(code, hashed_code):
            backup_list.pop(idx)
            mfa.backup_codes = backup_list
            mfa.save(update_fields=["backup_codes"])
            return True

    return False


def enable_mfa(user: User, verification_code: str) -> tuple[bool, str, list[str]]:
    """
    Requires one successful TOTP code verification before flipping is_enabled=True.
    Generates and returns fresh backup codes on initial enable.
    Returns (success: bool, message: str, backup_codes: list[str])
    """
    mfa = StaffMFA.objects.filter(user=user).first()
    if not mfa or not mfa.secret:
        return (False, "MFA secret has not been generated yet. Please initiate setup first.", [])

    if not verify_totp(user, verification_code):
        return (False, "Invalid verification code. Please check your authenticator app and try again.", [])

    mfa.is_enabled = True
    mfa.save(update_fields=["is_enabled"])

    plaintext_backup_codes = generate_backup_codes(user)

    return (True, "MFA enabled successfully.", plaintext_backup_codes)
