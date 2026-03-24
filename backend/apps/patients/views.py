# pyre-ignore-all-errors
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated

from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.permissions import IsClinicAdminOrReceptionist, IsClinicStaff
from apps.core.tenancy import get_user_clinic
from apps.audit.services import log_action
from apps.audit.models import AuditLog

from .models import Patient
from .serializers import (
    PatientRegistrationSerializer,
    PatientListSerializer,
    PublicPatientRegistrationSerializer,
    PatientProfileSerializer,
    PatientProfileUpdateSerializer,
)
from .services import register_patient


class PatientProfileView(APIView):
    """Patient-only endpoint to view and update their own medical profile."""
    permission_classes = [IsAuthenticated]

    def get_patient(self, user):
        try:
            return user.patient_profile
        except Patient.DoesNotExist:
            return None

    def get(self, request):
        patient = self.get_patient(request.user)
        if not patient:
            return Response({"error": "Patient profile not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = PatientProfileSerializer(patient)
        return Response({"success": True, "data": serializer.data})

    def patch(self, request):
        patient = self.get_patient(request.user)
        if not patient:
            return Response({"error": "Patient profile not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = PatientProfileUpdateSerializer(patient, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # Re-read the full profile after save
        read_serializer = PatientProfileSerializer(patient)
        return Response({"success": True, "data": read_serializer.data})


class PatientSelfRegisterView(APIView):
    """Public endpoint — any visitor can create a patient account."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PublicPatientRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        patient = register_patient(
            email=data['email'],
            password=data['password'],
            phone=data['phone'],
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            gender=data.get('gender'),
            date_of_birth=data.get('date_of_birth'),
        )

        # Auto-login: generate JWT tokens for the new patient
        refresh = RefreshToken.for_user(patient.user)

        return Response(
            {
                "success": True,
                "message": "Registration successful.",
                "patient_id": patient.id,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED
        )


class PatientRegistrationView(APIView):
    # Only Receptionists and Clinic Admins should be able to register patients directly into the clinic
    permission_classes = [IsClinicAdminOrReceptionist]

    def post(self, request):
        serializer = PatientRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        
        # Determine the clinic based on the user creating the patient
        clinic = request.user.clinic

        if not clinic:
            return Response(
                {"error": "User does not belong to a clinic."},
                status=status.HTTP_400_BAD_REQUEST
            )

        patient = register_patient(
            email=data['email'],
            password=data['password'],
            clinic=clinic,
            phone=data['phone'],
            date_of_birth=data.get('date_of_birth'),
            address=data.get('address', ''),
            emergency_contact=data.get('emergency_contact', '')
        )

        log_action(
            user=request.user,
            clinic=clinic,
            action_type=AuditLog.ActionChoices.CREATE,
            object_type="Patient",
            object_id=patient.id,
            description=f"Patient {patient.user.email} registered",
            ip_address=request.META.get("REMOTE_ADDR")
        )

        return Response(
            {
                "success": True,
                "patient_id": patient.id,
                "message": "Patient registered successfully."
            },
            status=status.HTTP_201_CREATED
        )


class PatientListView(ListAPIView):
    permission_classes = [IsClinicStaff]
    serializer_class = PatientListSerializer
    
    def get_queryset(self):
        user = self.request.user
        clinic = get_user_clinic(user)
        
        queryset = Patient.objects.all().order_by('-created_at')
        
        if clinic is None and user.role == "SUPER_ADMIN":
            pass
        else:
            queryset = queryset.filter(user__clinic=clinic)
            
        search_query = self.request.query_params.get('search', None)
        if search_query:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(user__email__icontains=search_query) |
                Q(phone__icontains=search_query)
            )
            
        return queryset

from apps.appointments.serializers import AppointmentListSerializer
from apps.appointments.models import Appointment
from rest_framework.exceptions import PermissionDenied

class PatientHistoryView(APIView):
    permission_classes = [IsClinicStaff]

    def get(self, request, pk):
        try:
            patient = Patient.objects.get(pk=pk)
        except Patient.DoesNotExist:
            return Response({"error": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        clinic = get_user_clinic(request.user)
        
        if clinic and patient.user.clinic != clinic:
            raise PermissionDenied("You do not have permission to view this patient.")

        patient_serializer = PatientListSerializer(patient)
        
        appointments = Appointment.objects.filter(patient=patient).order_by('-appointment_date', '-start_time')
        appointments_serializer = AppointmentListSerializer(appointments, many=True)

        return Response({
            "patient": patient_serializer.data,
            "appointments": appointments_serializer.data
        })

from django.shortcuts import get_object_or_404
from .models import IntakeForm
from .serializers import IntakeFormSerializer, IntakeFormUpdateSerializer

class IntakeFormView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, appointment_id):
        # Allow both patient and doctor/staff to see it
        intake, created = IntakeForm.objects.get_or_create(
            appointment_id=appointment_id,
            defaults={"patient": request.user.patient_profile} if hasattr(request.user, 'patient_profile') else {}
        )
        serializer = IntakeFormSerializer(intake)
        return Response({"success": True, "data": serializer.data})

    def patch(self, request, appointment_id):
        intake = get_object_or_404(IntakeForm, appointment_id=appointment_id)
        
        # Only patient should be able to update their own form
        if not hasattr(request.user, 'patient_profile') or intake.patient != request.user.patient_profile:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to update this intake form.")
            
        serializer = IntakeFormUpdateSerializer(intake, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        # Read full again
        full_serializer = IntakeFormSerializer(intake)
        return Response({"success": True, "data": full_serializer.data})
