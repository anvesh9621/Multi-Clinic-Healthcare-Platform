from django.core.exceptions import PermissionDenied


def get_user_clinic(user):
    """
    Returns clinic for user if applicable.
    SUPER_ADMIN returns None (global access).
    """

    if not user.is_authenticated:
        raise PermissionDenied("User not authenticated.")

    if user.role == "SUPER_ADMIN":
        return None

    return user.clinic

class ClinicQuerysetMixin:
    """
    Automatically filters queryset by clinic context.
    """

    def get_queryset(self):
        queryset = super().get_queryset()

        user = self.request.user
        clinic = get_user_clinic(user)

        # Super admin sees all
        if clinic is None and user.role == "SUPER_ADMIN":
            return queryset

        # Otherwise filter by clinic
        return queryset.filter(clinic=clinic)