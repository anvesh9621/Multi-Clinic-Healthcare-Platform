from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import ListAPIView
from rest_framework import status
from rest_framework.permissions import AllowAny

from apps.accounts.models import User
from apps.accounts.permissions import IsClinicAdmin
from apps.core.tenancy import ClinicQuerysetMixin

from apps.audit.services import log_action
from apps.audit.models import AuditLog

from .serializers import (
    ReceptionistCreateSerializer,
    ReceptionistSerializer,
    ReceptionistInvitationSerializer,
    ReceptionistAcceptInviteSerializer,
)
from .models import ReceptionistInvitation


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

        invite = serializer.save()

        log_action(
            user=request.user,
            clinic=request.user.clinic,
            action_type=AuditLog.ActionChoices.CREATE,
            object_type="ReceptionistInvitation",
            object_id=invite.id,
            description=f"Clinic admin invited receptionist {invite.email}",
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response(
            {
                "success": True,
                "invite_id": invite.id,
                "message": "Receptionist invitation sent successfully."
            },
            status=status.HTTP_201_CREATED,
        )


class ReceptionistInvitationStatusView(APIView):
    """Public — checks if a receptionist invite token is valid."""
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            invite = ReceptionistInvitation.objects.get(token=token)
            serializer = ReceptionistInvitationSerializer(invite)
            if not invite.is_valid:
                error_msg = "This invitation has expired or has already been used."
                if invite.status == "ACCEPTED":
                    error_msg = "This invitation has already been accepted. You can log in with your credentials."
                elif invite.status == "EXPIRED":
                    error_msg = "This invitation link has expired. Please request a new invite from your clinic admin."
                elif invite.status == "CANCELLED":
                    error_msg = "This invitation has been cancelled by the clinic admin."

                return Response(
                    {"isValid": False, "error": error_msg, "status": invite.status, "invitation": serializer.data},
                    status=status.HTTP_400_BAD_REQUEST
                )

            return Response({"isValid": True, "invitation": serializer.data, "status": invite.status})

        except ReceptionistInvitation.DoesNotExist:
            return Response({"isValid": False, "error": "Invalid invitation token.", "status": "NOT_FOUND"}, status=status.HTTP_404_NOT_FOUND)


class ReceptionistInviteAcceptView(APIView):
    """Public — receptionist sets password to complete account creation."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ReceptionistAcceptInviteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()

        return Response({
            "success": True,
            "message": "Receptionist account created successfully. You can now log in.",
            "email": user.email,
        })


class ReceptionistListView(ClinicQuerysetMixin, ListAPIView):
    permission_classes = [IsClinicAdmin]
    serializer_class = ReceptionistSerializer
    queryset = User.objects.filter(role=User.RoleChoices.RECEPTIONIST)


class AdminReceptionistInvitationListView(ClinicQuerysetMixin, ListAPIView):
    """Clinic Admin views all sent receptionist invitations, scoped to their clinic."""
    permission_classes = [IsClinicAdmin]
    serializer_class = ReceptionistInvitationSerializer
    queryset = ReceptionistInvitation.objects.order_by("-created_at")
    clinic_field = 'clinic'

from rest_framework.permissions import AllowAny
from .serializers import ClinicRegistrationSerializer

class ClinicRegistrationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ClinicRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = serializer.save()

        # In production, this is where you would call Razorpay API to create a Customer
        # e.g., client.customer.create(...) and update the clinic object.
        
        return Response(
            {
                "success": True,
                "message": "Clinic and admin account created successfully.",
                "clinic_id": result["clinic"].id,
                "admin_id": result["admin"].id,
            },
            status=status.HTTP_201_CREATED,
        )

from apps.accounts.permissions import IsSuperAdmin
from .serializers import SuperAdminClinicCreateSerializer

class SuperAdminCreateClinicView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        serializer = SuperAdminClinicCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        clinic = serializer.save()

        log_action(
            user=request.user,
            clinic=clinic,
            action_type=AuditLog.ActionChoices.CREATE,
            object_type="Clinic",
            object_id=clinic.id,
            description=f"Super Admin created clinic {clinic.name}",
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response(
            {
                "success": True,
                "message": "Clinic created successfully.",
                "clinic_id": clinic.id,
            },
            status=status.HTTP_201_CREATED,
        )

from django.shortcuts import get_object_or_404
from .models import Clinic

class ClinicToggleStatusView(APIView):
    permission_classes = [IsSuperAdmin]

    def patch(self, request, pk):
        clinic = get_object_or_404(Clinic, pk=pk)
        clinic.is_active = not clinic.is_active
        clinic.save()

        # If deactivating, optionally deactivate all users? Let's just keep it simple.
        # If clinic is inactive, users won't be able to log in or use the platform (we should probably check is_active in our middleware or permissions, but for now just updating the flag is fine).

        action = AuditLog.ActionChoices.UPDATE
        log_action(
            user=request.user,
            clinic=clinic,
            action_type=action,
            object_type="Clinic",
            object_id=clinic.id,
            description=f"Super Admin {'activated' if clinic.is_active else 'suspended'} clinic {clinic.name}",
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response({
            "success": True,
            "message": f"Clinic {'activated' if clinic.is_active else 'suspended'} successfully.",
            "is_active": clinic.is_active
        })


class SuperAdminChangePlanView(APIView):
    """
    POST /api/clinics/super-admin/<int:pk>/change-plan/
    Super Admin manually upgrades or downgrades a clinic's subscription plan.
    Used as the final step in the manual fallback flow after a payment link is paid.
    Body: { "plan": "professional" | "enterprise" | "starter" }
    """
    permission_classes = [IsSuperAdmin]

    VALID_PLANS = ['starter', 'professional', 'enterprise']

    def post(self, request, pk):
        clinic = get_object_or_404(Clinic, pk=pk)
        plan = request.data.get('plan', '').lower()

        if plan not in self.VALID_PLANS:
            return Response(
                {'error': f'Invalid plan. Must be one of: {", ".join(self.VALID_PLANS)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.subscriptions.models import Subscription
        sub, _ = Subscription.objects.get_or_create(clinic=clinic)
        target_status = 'active' if plan != 'starter' else 'trialing'
        sub = sub.transition_status(
            target_status,
            source_event='view:admin_change_plan',
            extra_fields={'plan': plan}
        )

        log_action(
            user=request.user,
            clinic=clinic,
            action_type=AuditLog.ActionChoices.UPDATE,
            object_type='Subscription',
            object_id=sub.id,
            description=f"Super Admin manually changed clinic plan to '{plan}'",
            ip_address=request.META.get('REMOTE_ADDR'),
        )

        return Response({
            'success': True,
            'message': f"Clinic plan updated to '{plan}' successfully.",
            'clinic': clinic.name,
            'plan': plan,
        })

