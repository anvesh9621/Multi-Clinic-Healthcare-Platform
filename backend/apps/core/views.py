from uuid import uuid4
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from apps.clinics.models import Clinic, ReceptionistInvitation
from apps.doctors.models import DoctorInvitation
from apps.accounts.models import ClinicAdminInvitation, User, EmailOTP


class TestSeedInvitationView(APIView):
    """
    DEBUG-only view to seed invitations for E2E testing.
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        if not getattr(settings, "DEBUG", False):
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

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
    DEBUG-only view to retrieve the generated OTP for a user email during E2E testing.
    """
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        if not getattr(settings, "DEBUG", False):
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

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
    DEBUG-only view to seed a Patient user for E2E testing.
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        if not getattr(settings, "DEBUG", False):
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

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
