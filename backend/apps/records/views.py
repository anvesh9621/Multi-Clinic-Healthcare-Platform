# pyre-ignore-all-errors
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from django.shortcuts import get_object_or_404

from apps.appointments.models import Appointment
from apps.core.tenancy import ClinicQuerysetMixin, PatientOwnedQuerysetMixin
from apps.accounts.permissions import IsDoctor

from .models import MedicalRecord, Prescription, PrescriptionTemplate
from .serializers import (
    MedicalRecordSerializer,
    PrescriptionSerializer,
    PrescriptionTemplateSerializer,
)
from .permissions import get_owned_appointment_or_403


class MedicalRecordCreateUpdateView(generics.CreateAPIView, generics.UpdateAPIView):
    """
    Doctor:  POST/PUT/PATCH to create or update a medical record.
    Patient: GET to read their own record for a specific appointment.

    Ownership enforcement is delegated to get_owned_appointment_or_403() so
    the access rules live in one auditable place (records/permissions.py).
    """
    serializer_class = MedicalRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        appointment_id = self.request.data.get("appointment") or self.kwargs.get("appointment_id")
        return MedicalRecord.objects.filter(appointment_id=appointment_id).first()

    def get(self, request, appointment_id=None):
        if not appointment_id:
            return Response({"error": "appointment_id required."}, status=status.HTTP_400_BAD_REQUEST)

        # Single authoritative ownership check — raises 403/404 on failure.
        appointment = get_owned_appointment_or_403(appointment_id, request.user)
        user = request.user

        record = MedicalRecord.objects.filter(appointment_id=appointment_id).first()
        if not record:
            if user.role == "DOCTOR":
                # Auto-create the record stub when the doctor opens the consultation.
                record = MedicalRecord.objects.create(
                    appointment=appointment,
                    patient=appointment.patient,
                    doctor_clinic=appointment.doctor_clinic,
                )
                if appointment.status == Appointment.StatusChoices.SCHEDULED:
                    appointment.status = Appointment.StatusChoices.IN_PROGRESS
                    appointment.save(update_fields=["status"])
            else:
                return Response(
                    {"detail": "No medical record found for this appointment."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        serializer = self.get_serializer(record)
        data = serializer.data
        # Hide private notes from patients.
        if user.role == "PATIENT":
            data.pop("private_notes", None)
        return Response(data)

    def perform_create(self, serializer):
        if self.request.user.role != "DOCTOR":
            raise PermissionDenied("Only doctors can create medical records.")

        appointment_id = self.request.data.get("appointment")
        # Ownership check — raises 403 if this doctor doesn't own the appointment.
        appointment = get_owned_appointment_or_403(appointment_id, self.request.user)

        serializer.save(
            patient=appointment.patient,
            doctor_clinic=appointment.doctor_clinic,
        )

        # Mark appointment as in progress when record is started.
        if appointment.status == Appointment.StatusChoices.SCHEDULED:
            appointment.status = Appointment.StatusChoices.IN_PROGRESS
            appointment.save(update_fields=["status"])


class PrescriptionCreateView(generics.CreateAPIView):
    serializer_class = PrescriptionSerializer
    permission_classes = [IsDoctor]

    def perform_create(self, serializer):
        medical_record_id = self.request.data.get("medical_record")
        record = get_object_or_404(MedicalRecord, id=medical_record_id)

        if record.doctor_clinic.doctor.user != self.request.user:
            raise PermissionDenied("You can only prescribe for your own patients.")

        # If one already exists, delete it — making this a replace operation.
        Prescription.objects.filter(medical_record=record).delete()

        serializer.save(medical_record=record)


# ---------------------------------------------------------------------------
# Patient history — split into two views so each uses the correct mixin.
# ---------------------------------------------------------------------------

class DoctorPatientHistoryView(generics.ListAPIView):
    """
    DOCTOR only — returns the medical record timeline for a specific patient,
    scoped to records where THIS doctor's clinic treated that patient.

    Scoping is intentionally tighter than clinic-level: a doctor at Clinic A
    must not see records created by a doctor at Clinic B, even if both have
    treated the same patient.  ClinicQuerysetMixin alone (clinic_field =
    'doctor_clinic__clinic') would allow cross-doctor visibility within a
    single clinic, which is too broad for medical records.  Instead we scope
    directly to doctor_clinic__doctor__user == request.user.
    """
    serializer_class = MedicalRecordSerializer
    permission_classes = [permissions.IsAuthenticated, IsDoctor]

    def get_queryset(self):
        patient_id = self.kwargs["patient_id"]
        return (
            MedicalRecord.objects
            .filter(
                patient_id=patient_id,
                doctor_clinic__doctor__user=self.request.user,
            )
            .order_by("-created_at")
        )


class PatientOwnHistoryView(generics.ListAPIView):
    """
    PATIENT only — returns their own medical record timeline.

    Uses PatientOwnedQuerysetMixin conceptually but since the URL carries an
    explicit patient_id we enforce that the requesting patient matches it
    before querying, then return all of their records (private_notes stripped).
    """
    serializer_class = MedicalRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        patient_id = self.kwargs["patient_id"]
        user = self.request.user

        if user.role != "PATIENT":
            # This view is patients-only; staff should use DoctorPatientHistoryView.
            raise PermissionDenied("This endpoint is for patients only.")

        # Ownership guard: a patient can only request their own history.
        try:
            if user.patient_profile.id != int(patient_id):
                raise PermissionDenied("You can only view your own history.")
        except AttributeError:
            raise PermissionDenied("No patient profile associated with this account.")

        return MedicalRecord.objects.filter(patient_id=patient_id).order_by("-created_at")

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data

        # Strip private notes — patients must never see private_notes.
        for item in data:
            item.pop("private_notes", None)

        return Response(data)


# ---------------------------------------------------------------------------
# Prescription templates — scoped to THIS doctor (not clinic-wide).
# ClinicQuerysetMixin is intentionally NOT used: templates are personal to
# the doctor who created them and must not be visible to other doctors at
# the same clinic.
# ---------------------------------------------------------------------------

class PrescriptionTemplateViewSet(generics.ListCreateAPIView):
    serializer_class = PrescriptionTemplateSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        return PrescriptionTemplate.objects.filter(doctor_clinic__doctor__user=self.request.user)

    def perform_create(self, serializer):
        # Infer doctor_clinic from the logged-in doctor.
        doctor_clinic = self.request.user.doctor_profile.clinic_associations.first()
        serializer.save(doctor_clinic=doctor_clinic)


class PrescriptionTemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PrescriptionTemplateSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        return PrescriptionTemplate.objects.filter(doctor_clinic__doctor__user=self.request.user)