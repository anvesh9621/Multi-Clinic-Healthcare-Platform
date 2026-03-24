from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.views import APIView
# from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

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

        return Response(
            {
                "success": True,
                "data": serializer.data
            }
        )
    


