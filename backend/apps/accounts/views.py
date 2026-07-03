from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status

from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.conf import settings

from .jwt import CustomTokenObtainPairSerializer
from .serializers import MeSerializer

from apps.audit.services import log_action
from apps.audit.models import AuditLog
from apps.accounts.models import User


class CustomTokenObtainPairView(TokenObtainPairView):

    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        email = request.data.get("email")
        user = User.objects.get(email=email)

        log_action(
            user=user,
            clinic=user.clinic,
            action_type=AuditLog.ActionChoices.LOGIN,
            object_type="User",
            object_id=user.id,
            description="User logged in",
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response(data)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = MeSerializer(request.user)
        return Response({"success": True, "data": serializer.data})


class PasswordResetRequestView(APIView):
    """
    Public — accepts an email address and sends a password reset link.
    Always returns 200 even if email does not exist (prevents user enumeration).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()

        try:
            user = User.objects.get(email=email)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
            reset_link = f"{frontend_url}/reset-password?uid={uid}&token={token}"

            from apps.notifications.tasks import send_email_task
            send_email_task.delay(
                to_email=user.email,
                subject="MediClinic: Reset Your Password",
                message=(
                    f"Hi {user.first_name or user.email},\n\n"
                    f"We received a request to reset your MediClinic password.\n\n"
                    f"Click the link below to set a new password (valid for 24 hours):\n"
                    f"{reset_link}\n\n"
                    f"If you did not request this, you can safely ignore this email.\n\n"
                    f"— MediClinic Team"
                )
            )
        except User.DoesNotExist:
            pass  # Silently ignore to prevent user enumeration

        return Response(
            {"success": True, "message": "If that email exists, a reset link has been sent."},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """
    Public — validates uid + token and sets a new password.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get("uid", "")
        token = request.data.get("token", "")
        new_password = request.data.get("new_password", "")

        if not uid or not token or not new_password:
            return Response(
                {"success": False, "error": "uid, token, and new_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"success": False, "error": "Password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_pk)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response(
                {"success": False, "error": "Invalid reset link."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"success": False, "error": "This reset link has expired or already been used."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save()

        return Response(
            {"success": True, "message": "Password reset successfully. You can now log in."},
            status=status.HTTP_200_OK,
        )

from .permissions import IsSuperAdmin
from .serializers import ClinicAdminCreateSerializer

class SuperAdminCreateClinicAdminView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        serializer = ClinicAdminCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        admin_user = serializer.save()

        log_action(
            user=request.user,
            clinic=admin_user.clinic,
            action_type=AuditLog.ActionChoices.CREATE,
            object_type="User",
            object_id=admin_user.id,
            description=f"Super Admin created clinic admin {admin_user.email}",
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response(
            {
                "success": True,
                "message": "Clinic admin created successfully.",
                "admin_id": admin_user.id,
            },
            status=status.HTTP_201_CREATED,
        )

from rest_framework_simplejwt.tokens import RefreshToken

class SuperAdminImpersonateView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        clinic_id = request.data.get("clinic_id")
        if not clinic_id:
            return Response({"success": False, "error": "clinic_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Find the clinic admin for this clinic
        admin_user = User.objects.filter(clinic_id=clinic_id, role=User.RoleChoices.CLINIC_ADMIN).first()
        if not admin_user:
            return Response({"success": False, "error": "No Clinic Admin found for this clinic."}, status=status.HTTP_404_NOT_FOUND)

        # Generate tokens
        refresh = RefreshToken.for_user(admin_user)

        log_action(
            user=request.user,
            clinic=admin_user.clinic,
            action_type=AuditLog.ActionChoices.LOGIN,
            object_type="User",
            object_id=admin_user.id,
            description=f"Super Admin impersonated Clinic Admin {admin_user.email}",
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response({
            "success": True,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        })
