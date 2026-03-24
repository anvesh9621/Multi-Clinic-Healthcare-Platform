from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsClinicAdminOrReceptionist
from .services import get_clinic_dashboard_stats
from .services import get_doctor_workload
from .services import get_appointment_trend

class ClinicDashboardView(APIView):

    permission_classes = [IsAuthenticated, IsClinicAdminOrReceptionist]

    def get(self, request):

        clinic = request.user.clinic

        if clinic is None:
            return Response(
                {
                    "success": False,
                    "message": "User does not belong to a clinic."
                },
                status=400
            )

        stats = get_clinic_dashboard_stats(clinic)

        return Response(
            {
                "success": True,
                "data": stats
            }
        )
    

class DoctorWorkloadView(APIView):

    permission_classes = [IsAuthenticated, IsClinicAdminOrReceptionist]

    def get(self, request):

        clinic = request.user.clinic

        workload = get_doctor_workload(clinic)

        return Response({
            "success": True,
            "data": workload
        })



class AppointmentTrendView(APIView):

    permission_classes = [IsAuthenticated, IsClinicAdminOrReceptionist]

    def get(self, request):

        clinic = request.user.clinic

        data = get_appointment_trend(clinic)

        return Response({
            "success": True,
            "data": data
        })