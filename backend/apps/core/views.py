import os
from uuid import uuid4
from django.conf import settings
from django.http import Http404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from apps.clinics.models import Clinic, ReceptionistInvitation
from apps.doctors.models import DoctorInvitation
from apps.accounts.models import ClinicAdminInvitation, User, EmailOTP


class TestSeedInvitationView(APIView):
    """
    E2E-only view to seed invitations for E2E testing.
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        if not settings.DEBUG and os.environ.get("E2E_TEST_MODE") != "true":
            raise Http404()

        role = (request.data.get("role") or "DOCTOR").upper()
        unique_id = uuid4().hex[:8]
        email = f"e2e_{role.lower()}_{unique_id}@example.com"

        clinic = Clinic.objects.create(
            name=f"E2E Clinic {role} {unique_id}",
            address="123 E2E Street"
        )

        if role == "DOCTOR":
            invite = DoctorInvitation.objects.create(
                clinic=clinic,
                email=email,
                specialization="General Medicine",
                status="PENDING"
            )
            return Response({
                "success": True,
                "role": role,
                "token": str(invite.token),
                "email": email,
                "url_path": f"/invite/{invite.token}"
            })

        elif role == "RECEPTIONIST":
            User.objects.filter(clinic=clinic, role=User.RoleChoices.RECEPTIONIST).delete()
            ReceptionistInvitation.objects.filter(clinic=clinic).delete()

            invite = ReceptionistInvitation.objects.create(
                clinic=clinic,
                email=email,
                status="PENDING"
            )
            return Response({
                "success": True,
                "role": role,
                "token": str(invite.token),
                "email": email,
                "url_path": f"/receptionist/invite/{invite.token}"
            })

        elif role == "CLINIC_ADMIN":
            User.objects.filter(clinic=clinic, role=User.RoleChoices.CLINIC_ADMIN).delete()
            ClinicAdminInvitation.objects.filter(clinic=clinic).delete()

            invite = ClinicAdminInvitation.objects.create(
                clinic=clinic,
                email=email,
                status="PENDING"
            )
            return Response({
                "success": True,
                "role": role,
                "token": str(invite.token),
                "email": email,
                "url_path": f"/admin/invite/{invite.token}"
            })

        return Response({"error": "Invalid role"}, status=status.HTTP_400_BAD_REQUEST)


class TestGetOTPView(APIView):
    """
    E2E-only view to retrieve the generated OTP for a user email during E2E testing.
    """
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        if not settings.DEBUG and os.environ.get("E2E_TEST_MODE") != "true":
            raise Http404()

        email = request.query_params.get("email")
        if not email:
            return Response({"error": "email parameter required"}, status=status.HTTP_400_BAD_REQUEST)

        otp = EmailOTP.objects.filter(user_email=email).order_by("-created_at").first()
        if not otp:
            return Response({"error": "No OTP found for this email"}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "success": True,
            "code": otp.code,
            "purpose": otp.purpose,
            "is_used": otp.is_used,
            "created_at": otp.created_at
        })


class TestSeedPatientView(APIView):
    """
    E2E-only view to seed a Patient user for E2E testing.
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        if not settings.DEBUG and os.environ.get("E2E_TEST_MODE") != "true":
            raise Http404()

        unique_id = uuid4().hex[:8]
        email = request.data.get("email") or f"e2e_patient_{unique_id}@example.com"

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "role": User.RoleChoices.PATIENT,
                "first_name": "E2E",
                "last_name": "Patient",
            }
        )
        return Response({"success": True, "email": user.email, "created": created})


class TestSeedStaffView(APIView):
    """
    E2E-only view to seed a Staff user (Doctor, Receptionist, or Clinic Admin) with password for E2E testing.
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        if not settings.DEBUG and os.environ.get("E2E_TEST_MODE") != "true":
            raise Http404()

        role = (request.data.get("role") or "DOCTOR").upper()
        unique_id = uuid4().hex[:8]
        email = request.data.get("email") or f"e2e_staff_{role.lower()}_{unique_id}@example.com"
        password = request.data.get("password") or "TestPassword123!"

        clinic = Clinic.objects.create(
            name=f"E2E Staff Clinic {unique_id}",
            address="123 Staff Street"
        )

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "role": role,
                "first_name": "E2E",
                "last_name": "Staff",
                "clinic": clinic,
            }
        )
        user.set_password(password)
        user.save()

        return Response({
            "success": True,
            "email": user.email,
            "password": password,
            "role": user.role,
            "created": created
        })


class TestGenerateTOTPView(APIView):
    """
    E2E-only view to generate a valid TOTP code for a secret or staff user for E2E testing.
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        if not settings.DEBUG and os.environ.get("E2E_TEST_MODE") != "true":
            raise Http404()

        secret = request.data.get("secret")
        email = request.data.get("email")

        if email:
            email = email.strip().lower()
            if not secret:
                from apps.accounts.models import StaffMFA
                user = User.objects.filter(email=email).first()
                if user:
                    mfa = StaffMFA.objects.filter(user=user).first()
                    if mfa:
                        secret = mfa.secret

        if not secret:
            return Response({"error": "secret or valid email required"}, status=status.HTTP_400_BAD_REQUEST)

        import pyotp
        totp = pyotp.TOTP(secret)
        return Response({
            "success": True,
            "code": totp.now(),
            "secret": secret
        })
