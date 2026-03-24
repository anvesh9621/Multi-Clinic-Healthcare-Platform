from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import ListAPIView
from rest_framework import status

from apps.accounts.models import User
from apps.accounts.permissions import IsClinicAdmin
from apps.core.tenancy import ClinicQuerysetMixin

from apps.audit.services import log_action
from apps.audit.models import AuditLog

from .serializers import ReceptionistCreateSerializer, ReceptionistSerializer

class CreateReceptionistView(APIView):
    permission_classes = [IsClinicAdmin]

    def post(self, request):
        serializer = ReceptionistCreateSerializer(
            data=request.data,
            context={"request": request},
        )

        if not serializer.is_valid():
            return Response(
                {"success": False, "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        receptionist = serializer.save()

        log_action(
            user=request.user,
            clinic=request.user.clinic,
            action_type=AuditLog.ActionChoices.CREATE,
            object_type="User",
            object_id=receptionist.id,
            description="Clinic admin created a receptionist",
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response(
            {
                "success": True,
                "receptionist_id": receptionist.id,
                "message": "Receptionist created successfully"
            },
            status=status.HTTP_201_CREATED,
        )

class ReceptionistListView(ClinicQuerysetMixin, ListAPIView):
    permission_classes = [IsClinicAdmin]
    serializer_class = ReceptionistSerializer
    
    def get_queryset(self):
        # Base query filtered further by ClinicQuerysetMixin
        return User.objects.filter(role=User.RoleChoices.RECEPTIONIST)
