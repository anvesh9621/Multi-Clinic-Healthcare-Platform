from .models import AuditLog


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