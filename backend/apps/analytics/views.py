from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

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


class SuperAdminStatsView(APIView):
    """
    SUPER_ADMIN only — returns platform-wide metrics across all clinics.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != "SUPER_ADMIN":
            return Response({"error": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        from apps.clinics.models import Clinic
        from apps.accounts.models import User
        from apps.appointments.models import Appointment
        from apps.billing.models import Invoice
        from django.db.models import Sum
        from django.utils import timezone

        today = timezone.now().date()

        total_clinics = Clinic.objects.count()
        active_clinics = Clinic.objects.filter(is_active=True).count()
        total_users = User.objects.count()
        total_appointments = Appointment.objects.count()
        appointments_today = Appointment.objects.filter(appointment_date=today).count()
        total_revenue = Invoice.objects.filter(
            status="PAID"
        ).aggregate(total=Sum("total_amount"))["total"] or 0

        # Per-clinic breakdown
        clinic_breakdown = []
        for clinic in Clinic.objects.filter(is_active=True).order_by("name"):
            clinic_breakdown.append({
                "id": clinic.id,
                "name": clinic.name,
                "plan": (clinic.subscription.plan if hasattr(clinic, "subscription") and clinic.subscription else clinic.subscription_plan).upper(),
                "is_active": clinic.is_active,
                "total_appointments": Appointment.objects.filter(clinic=clinic).count(),
                "appointments_today": Appointment.objects.filter(clinic=clinic, appointment_date=today).count(),
                "total_doctors": clinic.doctor_associations.filter(is_active=True).count(),
                "total_patients": clinic.appointments.values("patient").distinct().count(),
            })

        from apps.audit.models import AuditLog
        from datetime import timedelta

        # 7-day trend
        trend_data = []
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            day_rev = Invoice.objects.filter(
                status="PAID", created_at__date=d
            ).aggregate(total=Sum("total_amount"))["total"] or 0
            day_appts = Appointment.objects.filter(appointment_date=d).count()
            trend_data.append({
                "date": d.strftime("%b %d"),
                "revenue": float(day_rev),
                "appointments": day_appts
            })

        # Recent 10 audit logs
        recent_logs = []
        for log in AuditLog.objects.select_related("user", "clinic").order_by("-timestamp")[:10]:
            recent_logs.append({
                "id": log.id,
                "timestamp": log.timestamp,
                "action": log.action_type,
                "user": log.user.get_full_name() if log.user else "System",
                "clinic": log.clinic.name if log.clinic else "Platform",
                "description": log.description
            })

        return Response({
            "success": True,
            "data": {
                "total_clinics": total_clinics,
                "active_clinics": active_clinics,
                "total_users": total_users,
                "total_appointments": total_appointments,
                "appointments_today": appointments_today,
                "total_revenue_paid": float(total_revenue),
                "clinic_breakdown": clinic_breakdown,
                "trend_data": trend_data,
                "recent_logs": recent_logs,
            }
        })