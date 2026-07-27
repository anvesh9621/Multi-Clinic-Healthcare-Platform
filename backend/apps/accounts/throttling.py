from rest_framework.throttling import SimpleRateThrottle
from apps.audit.services import log_auth_attempt


class BaseCustomRateThrottle(SimpleRateThrottle):
    """
    Base throttle class that supports custom duration strings like '5/15m', '5/5m', '10/h'.
    """
    def parse_rate(self, rate):
        if rate is None:
            return (None, None)
        num, period = rate.split('/')
        num_requests = int(num)

        if period.endswith('min'):
            digits = period[:-3]
            multiplier = 60
        elif period.endswith('m'):
            digits = period[:-1]
            multiplier = 60
        elif period.endswith('h'):
            digits = period[:-1]
            multiplier = 3600
        elif period.endswith('d'):
            digits = period[:-1]
            multiplier = 86400
        elif period.endswith('s'):
            digits = period[:-1]
            multiplier = 1
        else:
            digits = ""
            multiplier = 60

        num_units = int(digits) if digits and digits.isdigit() else 1
        duration = num_units * multiplier
        return (num_requests, duration)


class LoginEmailRateThrottle(BaseCustomRateThrottle):
    """
    Email+password login throttle — ~5 attempts per email per 15 minutes.
    Locks out / backs off further attempts once rate is exceeded.
    """
    scope = "login_email"
    rate = "5/15m"

    def get_cache_key(self, request, view):
        self.request = request
        email = request.data.get("email", "").strip().lower()
        if not email:
            ident = self.get_ident(request)
        else:
            ident = email

        return self.cache_format % {
            "scope": self.scope,
            "ident": ident
        }

    def throttle_failure(self):
        email = getattr(self, "request", None) and self.request.data.get("email", "")
        ip_address = getattr(self, "request", None) and self.get_ident(self.request)
        log_auth_attempt(
            email=email or "",
            ip_address=ip_address,
            endpoint="/api/accounts/login/",
            status="LOCKED_OUT",
            reason="Login email rate limit exceeded (5 attempts / 15 min)"
        )
        return super().throttle_failure()


class PatientOTPRateThrottle(BaseCustomRateThrottle):
    """
    IP-based throttling for Patient OTP request and verify endpoints.
    Serves as a second layer on top of OTP model's built-in cooldown & attempt limits.
    Rate: 10 attempts/requests per IP per hour.
    """
    scope = "patient_otp"
    rate = "10/h"

    def get_cache_key(self, request, view):
        self.request = request
        ident = self.get_ident(request)
        return self.cache_format % {
            "scope": self.scope,
            "ident": ident
        }

    def throttle_failure(self):
        email = getattr(self, "request", None) and self.request.data.get("email", "")
        ip_address = getattr(self, "request", None) and self.get_ident(self.request)
        endpoint = getattr(self, "request", None) and self.request.path
        log_auth_attempt(
            email=email or "",
            ip_address=ip_address,
            endpoint=endpoint or "/api/accounts/patient/otp/",
            status="LOCKED_OUT",
            reason="Patient OTP IP rate limit exceeded (10 attempts / 1 hour)"
        )
        return super().throttle_failure()


class MFAStrictRateThrottle(BaseCustomRateThrottle):
    """
    Strict throttling for /api/accounts/mfa/verify/ and /mfa/recover/.
    Prevents brute-force attacks against 6-digit TOTP codes (1M possibilities).
    Rate: 5 attempts per 5 minutes per IP + email combination.
    """
    scope = "mfa_strict"
    rate = "5/5m"

    def get_cache_key(self, request, view):
        self.request = request
        email = request.data.get("email", "").strip().lower()
        ident = self.get_ident(request)
        key_ident = f"{ident}_{email}" if email else ident

        return self.cache_format % {
            "scope": self.scope,
            "ident": key_ident
        }

    def throttle_failure(self):
        email = getattr(self, "request", None) and self.request.data.get("email", "")
        ip_address = getattr(self, "request", None) and self.get_ident(self.request)
        endpoint = getattr(self, "request", None) and self.request.path
        log_auth_attempt(
            email=email or "",
            ip_address=ip_address,
            endpoint=endpoint or "/api/accounts/mfa/",
            status="LOCKED_OUT",
            reason="Strict MFA rate limit exceeded (5 attempts / 5 min)"
        )
        return super().throttle_failure()
