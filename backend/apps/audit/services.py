from .models import AuditLog, AuthAttempt


def log_action(
    *,
    user,
    action_type,
    object_type,
    object_id,
    clinic=None,
    description=None,
    ip_address=None,
):
    AuditLog.objects.create(
        user=user,
        clinic=clinic,
        action_type=action_type,
        object_type=object_type,
        object_id=object_id,
        description=description,
        ip_address=ip_address,
    )


def log_auth_attempt(
    *,
    email: str,
    endpoint: str,
    ip_address: str | None = None,
    status: str = "FAILED",
    reason: str | None = None,
) -> AuthAttempt:
    return AuthAttempt.objects.create(
        email=email.strip().lower() if email else "",
        ip_address=ip_address,
        endpoint=endpoint,
        status=status,
        reason=reason,
    )