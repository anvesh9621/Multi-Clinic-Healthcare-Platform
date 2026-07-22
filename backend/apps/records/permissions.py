"""
Ownership helpers for apps/records views.

Mirrors the pattern in apps/appointments/permissions.py (get_owned_appointment).
All access-control logic for medical records lives here so each view stays thin.
"""
from rest_framework.exceptions import PermissionDenied, NotFound

from apps.appointments.models import Appointment
from .models import MedicalRecord


def get_owned_appointment_or_403(appointment_id, user):
    """
    Fetches an Appointment and verifies that `user` is allowed to access its
    medical record.

    Rules:
      - PATIENT  → must be the patient on the appointment.
      - DOCTOR   → must be the doctor assigned to the appointment.
      - CLINIC_ADMIN / RECEPTIONIST → must belong to the clinic the appointment is at.
      - SUPER_ADMIN → allowed unconditionally.

    Returns the Appointment on success.
    Raises NotFound if the appointment does not exist.
    Raises PermissionDenied if the user has no access.
    """
    try:
        appointment = Appointment.objects.select_related(
            "patient__user",
            "doctor_clinic__doctor__user",
            "clinic",
        ).get(id=appointment_id)
    except Appointment.DoesNotExist:
        raise NotFound("Appointment not found.")

    if user.role == "PATIENT":
        if appointment.patient.user != user:
            raise PermissionDenied("You can only access your own records.")

    elif user.role == "DOCTOR":
        if appointment.doctor_clinic.doctor.user != user:
            raise PermissionDenied("You can only access records for your own appointments.")

    elif user.role in ("CLINIC_ADMIN", "RECEPTIONIST"):
        from apps.core.tenancy import get_user_clinic
        clinic = get_user_clinic(user)
        if not clinic or appointment.clinic != clinic:
            raise PermissionDenied("You can only access records for your own clinic.")

    elif user.role == "SUPER_ADMIN":
        pass  # Global access is correct for SUPER_ADMIN

    else:
        raise PermissionDenied("You do not have access to this record.")

    return appointment
