"""
Shared appointment ownership helpers.

These functions centralise the "can this user see/touch this appointment?"
check so it doesn't get copy-pasted across every view that needs to locate
a single appointment.
"""
from rest_framework.exceptions import NotFound, PermissionDenied

from .models import Appointment
from apps.core.tenancy import get_user_clinic


def get_owned_appointment(pk, user):
    """
    Look up Appointment by pk and verify the requesting user has ownership.

    Allowed roles and their ownership rules:
    - SUPER_ADMIN    → always allowed
    - PATIENT        → only their own appointment (patient.user == user)
    - DOCTOR         → only appointments assigned to them (doctor_clinic.doctor.user == user)
    - CLINIC_ADMIN / RECEPTIONIST → only appointments belonging to their clinic

    Raises NotFound if the appointment doesn't exist.
    Raises PermissionDenied if the user doesn't have access.
    """
    appointment = Appointment.objects.filter(id=pk).first()
    if not appointment:
        raise NotFound("Appointment not found.")

    if user.role == "SUPER_ADMIN":
        return appointment

    if user.role == "PATIENT":
        if appointment.patient.user != user:
            raise PermissionDenied("Unauthorized access.")

    elif user.role == "DOCTOR":
        if appointment.doctor_clinic.doctor.user != user:
            raise PermissionDenied("Unauthorized access.")

    elif user.role in ("CLINIC_ADMIN", "RECEPTIONIST"):
        clinic = get_user_clinic(user)
        if appointment.clinic != clinic:
            raise PermissionDenied("Unauthorized access.")

    return appointment
