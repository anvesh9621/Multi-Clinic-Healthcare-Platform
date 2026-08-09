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
                "plan": (clinic.subscription.plan if hasattr(clinic, "subscription") and clinic.subscription else "starter").upper(),
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

        # Recent 30 days PaymentMetricSnapshot
        from apps.billing.models import PaymentMetricSnapshot
        start_30 = today - timedelta(days=30)
        snapshots_qs = PaymentMetricSnapshot.objects.filter(date__gte=start_30).order_by('date')
        
        payment_snapshots = []
        tot_attempts = 0
        tot_success = 0
        tot_reconciliations = 0

        for snap in snapshots_qs:
            rate = round((snap.successful_payments / snap.total_payment_attempts) * 100, 1) if snap.total_payment_attempts > 0 else 100.0
            payment_snapshots.append({
                "id": snap.id,
                "date": snap.date.strftime("%Y-%m-%d"),
                "date_formatted": snap.date.strftime("%b %d"),
                "total_payment_attempts": snap.total_payment_attempts,
                "successful_payments": snap.successful_payments,
                "failed_payments": snap.failed_payments,
                "success_rate": rate,
                "reconciliation_catches": snap.reconciliation_catches,
                "refunds_processed": snap.refunds_processed,
                "refund_total_amount": float(snap.refund_total_amount),
                "avg_time_to_payment_seconds": snap.avg_time_to_payment_seconds,
            })
            tot_attempts += snap.total_payment_attempts
            tot_success += snap.successful_payments
            tot_reconciliations += snap.reconciliation_catches

        overall_success_rate = round((tot_success / tot_attempts) * 100, 1) if tot_attempts > 0 else 100.0

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
                "payment_metrics": {
                    "overall_success_rate": overall_success_rate,
                    "total_reconciliation_catches": tot_reconciliations,
                    "snapshots": payment_snapshots,
                }
            }
        })


class PaymentMetricsView(APIView):
    """
    SUPER_ADMIN only — returns recent PaymentMetricSnapshot rows (e.g. last 30 days)
    and aggregate health metrics.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != "SUPER_ADMIN":
            return Response({"error": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        from apps.billing.models import PaymentMetricSnapshot
        from django.utils import timezone
        from datetime import timedelta

        try:
            days = int(request.query_params.get('days', 30))
        except (ValueError, TypeError):
            days = 30

        start_date = (timezone.now() - timedelta(days=days)).date()
        snapshots = PaymentMetricSnapshot.objects.filter(date__gte=start_date).order_by('date')

        snapshot_list = []
        total_attempts = 0
        total_successful = 0
        total_failed = 0
        total_reconciliation_catches = 0
        total_refunds = 0
        total_refund_amount = 0.0

        for snap in snapshots:
            success_rate = (
                round((snap.successful_payments / snap.total_payment_attempts) * 100, 1)
                if snap.total_payment_attempts > 0
                else 100.0
            )
            snapshot_list.append({
                "id": snap.id,
                "date": snap.date.strftime("%Y-%m-%d"),
                "date_formatted": snap.date.strftime("%b %d"),
                "total_payment_attempts": snap.total_payment_attempts,
                "successful_payments": snap.successful_payments,
                "failed_payments": snap.failed_payments,
                "success_rate": success_rate,
                "avg_time_to_payment_seconds": snap.avg_time_to_payment_seconds,
                "reconciliation_catches": snap.reconciliation_catches,
                "refunds_processed": snap.refunds_processed,
                "refund_total_amount": float(snap.refund_total_amount),
                "dunning_recoveries": snap.dunning_recoveries,
            })
            total_attempts += snap.total_payment_attempts
            total_successful += snap.successful_payments
            total_failed += snap.failed_payments
            total_reconciliation_catches += snap.reconciliation_catches
            total_refunds += snap.refunds_processed
            total_refund_amount += float(snap.refund_total_amount)

        overall_success_rate = (
            round((total_successful / total_attempts) * 100, 1)
            if total_attempts > 0
            else 100.0
        )

        return Response({
            "success": True,
            "data": {
                "days": days,
                "overall_success_rate": overall_success_rate,
                "total_attempts": total_attempts,
                "total_successful": total_successful,
                "total_failed": total_failed,
                "total_reconciliation_catches": total_reconciliation_catches,
                "total_refunds": total_refunds,
                "total_refund_amount": total_refund_amount,
                "snapshots": snapshot_list,
            }
        })