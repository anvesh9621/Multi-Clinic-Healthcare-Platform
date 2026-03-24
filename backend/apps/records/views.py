# pyre-ignore-all-errors
from rest_framework import generics, viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404

from apps.appointments.models import Appointment
from .models import MedicalRecord, Prescription, PrescriptionTemplate
from .serializers import (
    MedicalRecordSerializer,
    PrescriptionSerializer,
    PrescriptionTemplateSerializer,
)
from apps.accounts.permissions import IsDoctor


class MedicalRecordCreateUpdateView(generics.CreateAPIView, generics.UpdateAPIView):
    """
    Doctor:  POST/PUT/PATCH to create or update a medical record.
    Patient: GET to read their own record for a completed appointment.
    """
    serializer_class = MedicalRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        appointment_id = self.request.data.get("appointment") or self.kwargs.get("appointment_id")
        return MedicalRecord.objects.filter(appointment_id=appointment_id).first()

    def get(self, request, appointment_id=None):
        if not appointment_id:
            return Response({"error": "appointment_id required."}, status=status.HTTP_400_BAD_REQUEST)

        appointment = get_object_or_404(Appointment, id=appointment_id)
        user = request.user

        # Patients can only view their own records
        if user.role == "PATIENT":
            if appointment.patient.user != user:
                raise PermissionDenied("You can only view your own records.")

        # Doctors can only view records for their appointments
        elif user.role == "DOCTOR":
            if appointment.doctor_clinic.doctor.user != user:
                raise PermissionDenied("You can only view records for your own appointments.")

        record = MedicalRecord.objects.filter(appointment_id=appointment_id).first()
        if not record:
            return Response({"detail": "No medical record found for this appointment."}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(record)
        data = serializer.data
        # Hide private notes from patients
        if user.role == "PATIENT":
            data.pop("private_notes", None)
        return Response(data)

    def perform_create(self, serializer):
        if self.request.user.role != "DOCTOR":
            raise PermissionDenied("Only doctors can create medical records.")
        appointment = get_object_or_404(Appointment, id=self.request.data.get("appointment"))

        # Security: ensure doctor owns this appointment
        if appointment.doctor_clinic.doctor.user != self.request.user:
            raise PermissionDenied("You can only create records for your own appointments.")

        serializer.save(
            patient=appointment.patient,
            doctor_clinic=appointment.doctor_clinic
        )

        # Mark appointment as in progress when record is started
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

        # If one already exists, delete it essentially making this a replace operation
        Prescription.objects.filter(medical_record=record).delete()

        serializer.save(medical_record=record)


class PatientHistoryView(generics.ListAPIView):
    """
    Returns a timeline of past records for a specific patient.
    """
    serializer_class = MedicalRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        patient_id = self.kwargs.get("patient_id")
        user = self.request.user

        # Doctors can see records for their patients
        if user.role == "DOCTOR":
            return MedicalRecord.objects.filter(
                patient_id=patient_id,
                doctor_clinic__doctor__user=user
            ).order_by("-created_at")
            
        # Patients can see their own records, but EXCLUDE private_notes
        if user.role == "PATIENT":
            if user.patient.id != int(patient_id):
                raise PermissionDenied()
            # Explicitly defer private_notes at DB level, or handle in serializer
            # Note: The easiest way to hide private notes is overriding to_representation in the serializer 
            # if user.role == "PATIENT", but for simplicity we will handle it in the response below
            return MedicalRecord.objects.filter(patient_id=patient_id).order_by("-created_at")

        return MedicalRecord.objects.none()

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data

        # Strip private notes if user is patient
        if request.user.role == "PATIENT":
            for item in data:
                item.pop('private_notes', None)

        return Response(data)


class PrescriptionTemplateViewSet(generics.ListCreateAPIView):
    serializer_class = PrescriptionTemplateSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        return PrescriptionTemplate.objects.filter(doctor_clinic__doctor__user=self.request.user)

    def perform_create(self, serializer):
        # Infer doctor_clinic from logged in doctor
        doctor_clinic = self.request.user.doctor.doctorclinic_set.first()
        serializer.save(doctor_clinic=doctor_clinic)


class PrescriptionTemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PrescriptionTemplateSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        return PrescriptionTemplate.objects.filter(doctor_clinic__doctor__user=self.request.user)