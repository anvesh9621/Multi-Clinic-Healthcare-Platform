# pyre-ignore-all-errors
from rest_framework.permissions import BasePermission


class RolePermission(BasePermission):
    """
    Base role-based permission.
    Subclasses must define allowed_roles.
    """

    allowed_roles = []

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return getattr(request.user, "role", None) in self.allowed_roles
    
class IsSuperAdmin(RolePermission):
    allowed_roles = ["SUPER_ADMIN"]


class IsClinicAdmin(RolePermission):
    allowed_roles = ["CLINIC_ADMIN"]


class IsDoctor(RolePermission):
    allowed_roles = ["DOCTOR"]


class IsReceptionist(RolePermission):
    allowed_roles = ["RECEPTIONIST"]


class IsPatient(RolePermission):
    allowed_roles = ["PATIENT"]


class IsClinicAdminOrReceptionist(RolePermission):
    allowed_roles = ["CLINIC_ADMIN", "RECEPTIONIST"]

class IsClinicStaff(RolePermission):
    allowed_roles = ["CLINIC_ADMIN", "RECEPTIONIST", "DOCTOR"]