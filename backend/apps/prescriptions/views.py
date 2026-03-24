from rest_framework.generics import CreateAPIView
from rest_framework.permissions import IsAuthenticated

from .models import Prescription
from .serializers import PrescriptionSerializer

from apps.audit.services import log_action
from apps.audit.models import AuditLog


class CreatePrescriptionView(CreateAPIView):
    permission_classes = [IsAuthenticated]

    queryset = Prescription.objects.all()
    serializer_class = PrescriptionSerializer

    def perform_create(self, serializer):
        prescription = serializer.save()

        request = self.request
        clinic = prescription.medical_record.appointment.clinic

        log_action(
            user=request.user,
            clinic=clinic,
            action_type=AuditLog.ActionChoices.CREATE,
            object_type="Prescription",
            object_id=prescription.id,
            description="Doctor created prescription",
            ip_address=request.META.get("REMOTE_ADDR"),
        )