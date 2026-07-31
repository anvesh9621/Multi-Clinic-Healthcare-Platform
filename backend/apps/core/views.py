from uuid import uuid4
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from apps.clinics.models import Clinic, ReceptionistInvitation
from apps.doctors.models import DoctorInvitation
from apps.accounts.models import ClinicAdminInvitation, User


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
