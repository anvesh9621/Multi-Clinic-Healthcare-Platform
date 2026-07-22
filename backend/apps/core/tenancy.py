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
    Intended for CLINIC_ADMIN, RECEPTIONIST, DOCTOR, or SUPER_ADMIN scoped views.
    Raises PermissionDenied if used by PATIENT roles.
    """
    clinic_field = 'clinic'

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        if user.role == "PATIENT":
            raise PermissionDenied("This view is for clinic staff only. Patients should use patient-specific endpoints.")

        clinic = get_user_clinic(user)

        # Super admin sees all
        if clinic is None and user.role == "SUPER_ADMIN":
            return queryset

        # Otherwise filter by clinic
        filter_kwargs = {self.clinic_field: clinic}
        return queryset.filter(**filter_kwargs)


class PatientOwnedQuerysetMixin:
    """
    Automatically filters queryset to objects owned by the authenticated patient.
    Intended for PATIENT scoped views.
    Assumes the model has a `patient` field that relates to the Patient profile.
    """
    patient_field = 'patient'

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        if not hasattr(user, 'patient_profile'):
            raise PermissionDenied("This view requires a patient profile.")
            
        filter_kwargs = {self.patient_field: user.patient_profile}
        return queryset.filter(**filter_kwargs)