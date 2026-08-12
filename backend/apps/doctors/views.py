# pyre-ignore-all-errors
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.generics import ListCreateAPIView, ListAPIView
from rest_framework import status
from apps.core.tenancy import ClinicQuerysetMixin, get_user_clinic, TenantScopedAPIView

from .models import DoctorClinic, DoctorSchedule, Doctor, DoctorLeave
from .serializers import (
    DoctorClinicSerializer,
    DoctorDetailSerializer,
    DoctorProfileUpdateSerializer,
    DoctorScheduleSerializer,
    DoctorLeaveSerializer,
    BulkDoctorInviteSerializer,
    DoctorAcceptInviteSerializer,
    DoctorInvitationSerializer,
    ClinicListSerializer,
)
from .models import DoctorInvitation
from apps.clinics.models import Clinic
from apps.accounts.permissions import IsClinicAdmin, IsDoctor
from apps.audit.services import log_action
from apps.audit.models import AuditLog


class ClinicListView(APIView):
    """Public — returns active clinics for the booking wizard."""
    permission_classes = [AllowAny]

    def get(self, request):
        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        clinics = Clinic.objects.filter(is_active=True).order_by('name')
        page = paginator.paginate_queryset(clinics, request)
        if page is not None:
            serializer = ClinicListSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        serializer = ClinicListSerializer(clinics, many=True)
        return Response(serializer.data)


class DoctorClinicListView(TenantScopedAPIView):
    def get(self, request):
        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        queryset = DoctorClinic.objects.select_related("doctor__user", "clinic")
        if not self.is_platform_wide:
            queryset = queryset.filter(clinic=self.clinic)
        page = paginator.paginate_queryset(queryset, request)
        if page is not None:
            serializer = DoctorClinicSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        serializer = DoctorClinicSerializer(queryset, many=True)
        return Response(serializer.data)


class DoctorScheduleListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DoctorScheduleSerializer

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "role", None) == "DOCTOR":
            return DoctorSchedule.objects.filter(doctor_clinic__doctor__user=user)
        if getattr(user, "role", None) in ["CLINIC_ADMIN", "RECEPTIONIST"]:
            clinic = get_user_clinic(user)
            return DoctorSchedule.objects.filter(doctor_clinic__clinic=clinic)
        if getattr(user, "role", None) == "SUPER_ADMIN":
            return DoctorSchedule.objects.all()
        return DoctorSchedule.objects.none()


from rest_framework.generics import RetrieveUpdateDestroyAPIView

class DoctorScheduleDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DoctorScheduleSerializer

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "role", None) == "DOCTOR":
            return DoctorSchedule.objects.filter(doctor_clinic__doctor__user=user)
        if getattr(user, "role", None) in ["CLINIC_ADMIN", "RECEPTIONIST"]:
            clinic = get_user_clinic(user)
            return DoctorSchedule.objects.filter(doctor_clinic__clinic=clinic)
        if getattr(user, "role", None) == "SUPER_ADMIN":
            return DoctorSchedule.objects.all()
        return DoctorSchedule.objects.none()


class DoctorLeaveListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DoctorLeaveSerializer

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "role", None) == "DOCTOR":
            return DoctorLeave.objects.filter(doctor_clinic__doctor__user=user)
        # Clinic admins/receptionists see all leaves for their clinic
        if getattr(user, "role", None) in ["CLINIC_ADMIN", "RECEPTIONIST"]:
            clinic = get_user_clinic(user)
            return DoctorLeave.objects.filter(doctor_clinic__clinic=clinic)
        if getattr(user, "role", None) == "SUPER_ADMIN":
            return DoctorLeave.objects.all()
        return DoctorLeave.objects.none()

    def perform_create(self, serializer):
        serializer.save()


class DoctorLeaveDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DoctorLeaveSerializer

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "role", None) == "DOCTOR":
            return DoctorLeave.objects.filter(doctor_clinic__doctor__user=user)
        if getattr(user, "role", None) in ["CLINIC_ADMIN", "RECEPTIONIST"]:
            clinic = get_user_clinic(user)
            return DoctorLeave.objects.filter(doctor_clinic__clinic=clinic)
        if getattr(user, "role", None) == "SUPER_ADMIN":
            return DoctorLeave.objects.all()
        return DoctorLeave.objects.none()


class CreateDoctorInvitationView(APIView):
    """Clinic Admin invites doctors. Replaces direct object creation."""
    permission_classes = [IsClinicAdmin]

    def post(self, request):
        serializer = BulkDoctorInviteSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        invitations = serializer.save()

        for invite in invitations:
            log_action(
                user=request.user,
                clinic=request.user.clinic,
                action_type=AuditLog.ActionChoices.CREATE,
                object_type="DoctorInvitation",
                object_id=invite.id,
                description=f"Clinic admin invited {invite.email} to join as {invite.specialization}",
                ip_address=request.META.get("REMOTE_ADDR"),
            )

        return Response(
            {"success": True, "count": len(invitations), "message": "Invitations sent successfully"},
            status=status.HTTP_201_CREATED,
        )


class DoctorInvitationStatusView(APIView):
    """Public — checks if an invite token is valid before showing the registration form."""
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            invite = DoctorInvitation.objects.get(token=token)
            if not invite.is_valid:
                return Response({"isValid": False, "error": "This invitation has expired, or has already been used."}, status=status.HTTP_400_BAD_REQUEST)
            
            serializer = DoctorInvitationSerializer(invite)
            return Response({"isValid": True, "invitation": serializer.data})
            
        except DoctorInvitation.DoesNotExist:
            return Response({"isValid": False, "error": "Invalid invitation token."}, status=status.HTTP_404_NOT_FOUND)


class AdminDoctorInvitationListView(ClinicQuerysetMixin, ListAPIView):
    """Clinic Admin views all sent invitations, scoped to their clinic."""
    permission_classes = [IsClinicAdmin]
    serializer_class = DoctorInvitationSerializer
    queryset = DoctorInvitation.objects.order_by("-created_at")
    clinic_field = 'clinic'


class DoctorProfileView(APIView):
    """Doctor views and updates their own profile."""
    permission_classes = [IsDoctor]

    def _get_doctor(self, user):
        try:
            return user.doctor_profile
        except Doctor.DoesNotExist:
            return None

    def get(self, request):
        doctor = self._get_doctor(request.user)
        if not doctor:
            return Response({"error": "Doctor profile not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = DoctorDetailSerializer(doctor)
        return Response({"success": True, "data": serializer.data})

    def patch(self, request):
        doctor = self._get_doctor(request.user)
        if not doctor:
            return Response({"error": "Doctor profile not found."}, status=status.HTTP_404_NOT_FOUND)

        # Handle profile photo separately (multipart)
        if "profile_photo" in request.FILES:
            doctor.profile_photo = request.FILES["profile_photo"]
            doctor.save()

        serializer = DoctorProfileUpdateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        serializer.update(doctor, serializer.validated_data)
        return Response({"success": True, "data": DoctorDetailSerializer(doctor).data})


class DoctorInviteAcceptView(APIView):
    """Public — doctor inputs token, sets password, and completes their profile."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = DoctorAcceptInviteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()

        return Response({
            "success": True,
            "message": "Doctor account created successfully. You can now log in.",
            "email": user.email,
        })


class CreateDoctorScheduleView(APIView):
    permission_classes = [IsClinicAdmin]

    def post(self, request):
        serializer = DoctorScheduleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        schedule = serializer.save()

        log_action(
            user=request.user,
            clinic=request.user.clinic,
            action_type=AuditLog.ActionChoices.CREATE,
            object_type="DoctorSchedule",
            object_id=schedule.id,
            description="Doctor schedule created",
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response({"success": True, "schedule_id": schedule.id}, status=status.HTTP_201_CREATED)


from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

class PublicSpecialtyListView(APIView):
    """Public — returns a list of unique specialties that have active doctors."""
    permission_classes = [AllowAny]

    @method_decorator(cache_page(60 * 15))
    def get(self, request):
        active_doctors = Doctor.objects.filter(clinic_associations__is_active=True)
        specialties = active_doctors.values_list('specialization', flat=True).distinct()
        return Response([s for s in sorted(list(specialties)) if s])


class PublicDoctorListView(APIView):
    """Public — returns active doctors filtered by specialty. Includes basic profile details."""
    permission_classes = [AllowAny]

    @method_decorator(cache_page(60 * 15))
    def get(self, request):
        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        specialty = request.query_params.get("specialty")
        queryset = Doctor.objects.filter(clinic_associations__is_active=True).distinct()
        
        if specialty:
            queryset = queryset.filter(specialization__iexact=specialty)
            
        page = paginator.paginate_queryset(queryset, request)
        if page is not None:
            serializer = DoctorDetailSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        serializer = DoctorDetailSerializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})


class DoctorReviewListCreateView(APIView):
    """Public GET. Patient POST to leave review."""
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request, doctor_id):
        from rest_framework.pagination import PageNumberPagination
        from .models import DoctorReview
        from .serializers import DoctorReviewSerializer
        paginator = PageNumberPagination()
        reviews = DoctorReview.objects.filter(doctor_id=doctor_id)
        page = paginator.paginate_queryset(reviews, request)
        if page is not None:
            serializer = DoctorReviewSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        serializer = DoctorReviewSerializer(reviews, many=True)
        return Response(serializer.data)

    def post(self, request, doctor_id):
        from .serializers import DoctorReviewSerializer
        patient = getattr(request.user, 'patient_profile', None)
        if not patient:
            return Response({"error": "Only patients can leave reviews."}, status=status.HTTP_403_FORBIDDEN)
            
        data = request.data.copy()
        data['doctor'] = doctor_id
        
        serializer = DoctorReviewSerializer(data=data)
        if serializer.is_valid():
            serializer.save(patient=patient)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)