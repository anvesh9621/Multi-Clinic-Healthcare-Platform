import os
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


import jwt
import datetime
from datetime import timedelta
from rest_framework_simplejwt.tokens import RefreshToken
from .models import StaffMFA
from .services import (
    generate_mfa_secret,
    enable_mfa,
    verify_totp,
    verify_backup_code,
)


class CustomTokenObtainPairView(TokenObtainPairView):

    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        email = request.data.get("email", "").strip().lower()
        user = User.objects.get(email=email)

        # Patients skip Staff MFA and get direct JWT tokens
        if user.role == User.RoleChoices.PATIENT:
            log_action(
                user=user,
                clinic=user.clinic,
                action_type=AuditLog.ActionChoices.LOGIN,
                object_type="User",
                object_id=user.id,
                description="Patient logged in via password",
                ip_address=request.META.get("REMOTE_ADDR"),
            )
            return Response(data)

        # Staff roles (CLINIC_ADMIN, DOCTOR, RECEPTIONIST, SUPER_ADMIN) require MFA
        mfa = StaffMFA.objects.filter(user=user).first()
        is_mfa_enabled = mfa is not None and mfa.is_enabled

        action = "mfa_verify" if is_mfa_enabled else "mfa_setup"
        payload = {
            "token_type": "mfa_pending",
            "user_id": user.id,
            "email": user.email,
            "role": user.role,
            "action": action,
            "exp": datetime.datetime.now(datetime.timezone.utc) + timedelta(minutes=5),
            "iat": datetime.datetime.now(datetime.timezone.utc),
        }
        pending_token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

        return Response({
            "mfa_required": True,
            "mfa_setup_required": not is_mfa_enabled,
            "pending_token": pending_token,
            "message": (
                "MFA verification required."
                if is_mfa_enabled else
                "MFA setup is mandatory for staff accounts before accessing the system."
            )
        }, status=status.HTTP_200_OK)


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
from .models import ClinicAdminInvitation
from .serializers import (
    ClinicAdminCreateSerializer,
    ClinicAdminInvitationSerializer,
    ClinicAdminAcceptInviteSerializer,
)

class SuperAdminCreateClinicAdminView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        serializer = ClinicAdminCreateSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(
                {"success": False, "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invite = serializer.save()

        log_action(
            user=request.user,
            clinic=invite.clinic,
            action_type=AuditLog.ActionChoices.CREATE,
            object_type="ClinicAdminInvitation",
            object_id=invite.id,
            description=f"Super Admin invited clinic admin {invite.email}",
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response(
            {
                "success": True,
                "message": "Clinic admin invitation sent successfully.",
                "invite_id": invite.id,
            },
            status=status.HTTP_201_CREATED,
        )


class ClinicAdminInvitationStatusView(APIView):
    """Public — checks if a clinic admin invite token is valid."""
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            invite = ClinicAdminInvitation.objects.get(token=token)
            serializer = ClinicAdminInvitationSerializer(invite)
            if not invite.is_valid:
                error_msg = "This invitation has expired or has already been used."
                if invite.status == "ACCEPTED":
                    error_msg = "This invitation has already been accepted. You can log in with your credentials."
                elif invite.status == "EXPIRED":
                    error_msg = "This invitation link has expired. Please contact support or your system administrator."
                elif invite.status == "CANCELLED":
                    error_msg = "This invitation has been cancelled."

                return Response(
                    {"isValid": False, "error": error_msg, "status": invite.status, "invitation": serializer.data},
                    status=status.HTTP_400_BAD_REQUEST
                )

            return Response({"isValid": True, "invitation": serializer.data, "status": invite.status})

        except ClinicAdminInvitation.DoesNotExist:
            return Response({"isValid": False, "error": "Invalid invitation token.", "status": "NOT_FOUND"}, status=status.HTTP_404_NOT_FOUND)


class ClinicAdminInviteAcceptView(APIView):
    """Public — clinic admin sets password to complete account creation."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ClinicAdminAcceptInviteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()

        return Response({
            "success": True,
            "message": "Clinic Admin account created successfully. You can now log in.",
            "email": user.email,
        })

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


from django.db import transaction
from apps.patients.models import Patient
from .services import generate_and_send_otp, verify_otp

class PatientOTPRequestView(APIView):
    """
    Public — requests a 6-digit Email OTP for patient registration or login.
    Rejects REGISTER if email is already a User; rejects LOGIN if email is not a User.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        purpose = request.data.get("purpose", "").strip().upper()

        if not email or not purpose:
            return Response(
                {"success": False, "error": "Email and purpose ('REGISTER' or 'LOGIN') are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if purpose not in ["REGISTER", "LOGIN"]:
            return Response(
                {"success": False, "error": "Purpose must be either 'REGISTER' or 'LOGIN'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_exists = User.objects.filter(email=email).exists()

        if purpose == "REGISTER" and user_exists:
            return Response(
                {"success": False, "error": "An account with this email already exists. Please log in instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if purpose == "LOGIN" and not user_exists:
            return Response(
                {"success": False, "error": "No account found with this email address. Please register first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ok, msg, _ = generate_and_send_otp(email, purpose)
        if not ok:
            return Response({"success": False, "error": msg}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"success": True, "message": msg}, status=status.HTTP_200_OK)


class PatientOTPVerifyView(APIView):
    """
    Public — verifies Email OTP for patient registration or login.
    On REGISTER success: creates User (role=PATIENT, no password set) + Patient profile and issues JWT.
    On LOGIN success: issues JWT for the existing User.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        code = request.data.get("code", "").strip()
        purpose = request.data.get("purpose", "").strip().upper()

        if not email or not code or not purpose:
            return Response(
                {"success": False, "error": "Email, code, and purpose are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if purpose not in ["REGISTER", "LOGIN"]:
            return Response(
                {"success": False, "error": "Purpose must be either 'REGISTER' or 'LOGIN'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ok, msg = verify_otp(email, code, purpose)
        if not ok:
            return Response({"success": False, "error": msg}, status=status.HTTP_400_BAD_REQUEST)

        if purpose == "REGISTER":
            with transaction.atomic():
                if User.objects.filter(email=email).exists():
                    return Response(
                        {"success": False, "error": "An account with this email already exists."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                first_name = request.data.get("first_name", "").strip()
                last_name = request.data.get("last_name", "").strip()
                phone = request.data.get("phone", "").strip()

                user = User.objects.create_user(
                    email=email,
                    role=User.RoleChoices.PATIENT,
                    first_name=first_name,
                    last_name=last_name,
                )
                user.set_unusable_password()
                user.save()

                Patient.objects.get_or_create(
                    user=user,
                    defaults={"phone": phone}
                )

                log_action(
                    user=user,
                    clinic=None,
                    action_type=AuditLog.ActionChoices.CREATE,
                    object_type="Patient",
                    object_id=user.id,
                    description=f"Patient self-registered via Email OTP: {user.email}",
                    ip_address=request.META.get("REMOTE_ADDR"),
                )

        else:  # LOGIN
            user = User.objects.filter(email=email).first()
            if not user:
                return Response(
                    {"success": False, "error": "No account found for this email address."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            log_action(
                user=user,
                clinic=user.clinic,
                action_type=AuditLog.ActionChoices.LOGIN,
                object_type="User",
                object_id=user.id,
                description=f"Patient logged in via Email OTP: {user.email}",
                ip_address=request.META.get("REMOTE_ADDR"),
            )

        # Issue JWT tokens
        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["clinic_id"] = user.clinic.id if user.clinic else None

        return Response(
            {
                "success": True,
                "message": "Authentication successful.",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "role": user.role,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": user.role,
                },
            },
            status=status.HTTP_200_OK,
        )


from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

class PatientGoogleAuthView(APIView):
    """
    Public — verifies Google ID token from Sign-In JS SDK.
    Patient-only: registers new patient or logs in existing patient.
    Rejects staff users attempting Google Sign-In.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        client_id = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "") or os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
        if not client_id:
            return Response(
                {"success": False, "error": "GOOGLE_OAUTH_CLIENT_ID is not configured on the server."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        token = request.data.get("id_token") or request.data.get("token")
        if not token:
            return Response(
                {"success": False, "error": "id_token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            id_info = google_id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                client_id
            )
        except Exception as e:
            return Response(
                {"success": False, "error": f"Invalid or expired Google ID token: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = id_info.get("email", "").strip().lower()
        if not email:
            return Response(
                {"success": False, "error": "Google token does not contain a valid email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email=email).first()

        if user:
            if user.role != User.RoleChoices.PATIENT:
                return Response(
                    {"success": False, "error": "Google Sign-In is only available for patient accounts."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            log_action(
                user=user,
                clinic=user.clinic,
                action_type=AuditLog.ActionChoices.LOGIN,
                object_type="User",
                object_id=user.id,
                description=f"Patient logged in via Google OAuth: {user.email}",
                ip_address=request.META.get("REMOTE_ADDR"),
            )
        else:
            with transaction.atomic():
                first_name = id_info.get("given_name") or id_info.get("name", "")
                last_name = id_info.get("family_name", "")

                user = User.objects.create_user(
                    email=email,
                    role=User.RoleChoices.PATIENT,
                    first_name=first_name.strip(),
                    last_name=last_name.strip(),
                )
                user.set_unusable_password()
                user.save()

                Patient.objects.get_or_create(
                    user=user,
                    defaults={"phone": ""}
                )

                log_action(
                    user=user,
                    clinic=None,
                    action_type=AuditLog.ActionChoices.CREATE,
                    object_type="Patient",
                    object_id=user.id,
                    description=f"Patient self-registered via Google OAuth: {user.email}",
                    ip_address=request.META.get("REMOTE_ADDR"),
                )

        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["clinic_id"] = user.clinic.id if user.clinic else None

        return Response(
            {
                "success": True,
                "message": "Google authentication successful.",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "role": user.role,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": user.role,
                },
            },
            status=status.HTTP_200_OK,
        )


def parse_mfa_pending_token(request, required_actions=("mfa_setup", "mfa_verify")):
    token = request.data.get("pending_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        return None, "pending_token is required."

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("token_type") != "mfa_pending":
            return None, "Invalid token type."
        if payload.get("action") not in required_actions:
            return None, f"Token action '{payload.get('action')}' is not authorized for this operation."

        user_id = payload.get("user_id")
        user = User.objects.filter(id=user_id).first()
        if not user:
            return None, "User associated with token not found."

        if user.role == User.RoleChoices.PATIENT:
            return None, "MFA endpoints are only available for staff accounts."

        return user, None
    except jwt.ExpiredSignatureError:
        return None, "Pending MFA session expired. Please log in again."
    except jwt.InvalidTokenError:
        return None, "Invalid pending MFA token."


class MFASetupView(APIView):
    """
    Generates MFA secret + provisioning URI for QR code rendering.
    Accessible via authenticated staff user OR a valid pending MFA token.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        if request.user and request.user.is_authenticated and request.user.role != User.RoleChoices.PATIENT:
            user = request.user
        else:
            user, err = parse_mfa_pending_token(request, required_actions=["mfa_setup", "mfa_verify"])
            if err:
                return Response({"success": False, "error": err}, status=status.HTTP_400_BAD_REQUEST)

        secret, provisioning_uri = generate_mfa_secret(user)

        return Response({
            "success": True,
            "secret": secret,
            "provisioning_uri": provisioning_uri,
            "message": "Scan the QR code or enter secret into your authenticator app, then confirm with a valid 6-digit code."
        }, status=status.HTTP_200_OK)


class MFAConfirmView(APIView):
    """
    Verifies TOTP code against the generated secret, calls enable_mfa,
    and returns 10 single-use backup codes ONCE along with JWT access + refresh tokens.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        if request.user and request.user.is_authenticated and request.user.role != User.RoleChoices.PATIENT:
            user = request.user
        else:
            user, err = parse_mfa_pending_token(request, required_actions=["mfa_setup", "mfa_verify"])
            if err:
                return Response({"success": False, "error": err}, status=status.HTTP_400_BAD_REQUEST)

        code = request.data.get("code", "").strip()
        if not code:
            return Response({"success": False, "error": "Verification code is required."}, status=status.HTTP_400_BAD_REQUEST)

        ok, msg, backup_codes = enable_mfa(user, code)
        if not ok:
            return Response({"success": False, "error": msg}, status=status.HTTP_400_BAD_REQUEST)

        log_action(
            user=user,
            clinic=user.clinic,
            action_type=AuditLog.ActionChoices.LOGIN,
            object_type="User",
            object_id=user.id,
            description=f"Staff enrolled MFA: {user.email}",
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["clinic_id"] = user.clinic.id if user.clinic else None

        return Response({
            "success": True,
            "message": "MFA enabled successfully.",
            "backup_codes": backup_codes,
            "backup_codes_notice": "SHOWN_ONLY_ONCE: Save these backup codes in a secure location. They will not be displayed again.",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "role": user.role,
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
            }
        }, status=status.HTTP_200_OK)


class MFAVerifyView(APIView):
    """
    Second step of staff login: verifies TOTP code or backup code against pending_token,
    issues full JWT access + refresh tokens upon success.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        user, err = parse_mfa_pending_token(request, required_actions=["mfa_verify", "mfa_setup"])
        if err:
            return Response({"success": False, "error": err}, status=status.HTTP_400_BAD_REQUEST)

        code = request.data.get("code", "").strip()
        if not code:
            return Response({"success": False, "error": "Verification code or backup code is required."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Try TOTP code verification
        is_valid = verify_totp(user, code)

        # 2. Try Backup Code verification if TOTP failed
        if not is_valid:
            is_valid = verify_backup_code(user, code)

        if not is_valid:
            return Response({"success": False, "error": "Invalid verification code or backup code."}, status=status.HTTP_400_BAD_REQUEST)

        log_action(
            user=user,
            clinic=user.clinic,
            action_type=AuditLog.ActionChoices.LOGIN,
            object_type="User",
            object_id=user.id,
            description=f"Staff logged in via MFA: {user.email}",
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["clinic_id"] = user.clinic.id if user.clinic else None

        return Response({
            "success": True,
            "message": "MFA verification successful.",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "role": user.role,
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
            }
        }, status=status.HTTP_200_OK)
