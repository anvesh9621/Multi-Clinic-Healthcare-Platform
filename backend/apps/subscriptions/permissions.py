from rest_framework.permissions import BasePermission


class IsClinicAdminOnly(BasePermission):
    message = 'Only clinic administrators can manage subscriptions.'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == 'CLINIC_ADMIN'
        )


class IsClinicAdminOrSuperAdmin(BasePermission):
    """For endpoints that both CLINIC_ADMIN and SUPER_ADMIN can access."""
    message = 'Only clinic administrators or super admins can access this.'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in ('CLINIC_ADMIN', 'SUPER_ADMIN')
        )
