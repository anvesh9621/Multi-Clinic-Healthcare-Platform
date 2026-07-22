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
      - DOCTOR   → must be the doctor assigned to the appointment (doctor_clinic.doctor.user).
      - CLINIC_ADMIN / RECEPTIONIST / SUPER_ADMIN → allowed unconditionally
        (they already pass clinic-level tenancy checks at the view level).

    Returns the Appointment on success.
    Raises NotFound if the appointment does not exist.
    Raises PermissionDenied if the user has no access.
    """
    try:
        appointment = Appointment.objects.select_related(
            "patient__user",
            "doctor_clinic__doctor__user",
        ).get(id=appointment_id)
    except Appointment.DoesNotExist:
        raise NotFound("Appointment not found.")

    if user.role == "PATIENT":
        if appointment.patient.user != user:
            raise PermissionDenied("You can only access your own records.")

    elif user.role == "DOCTOR":
        if appointment.doctor_clinic.doctor.user != user:
            raise PermissionDenied("You can only access records for your own appointments.")

    # CLINIC_ADMIN, RECEPTIONIST, SUPER_ADMIN: no additional object-level check needed.
    return appointment
