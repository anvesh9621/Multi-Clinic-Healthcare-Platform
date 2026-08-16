import logging
from datetime import timedelta
from django.utils import timezone
from django.core.cache import cache
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncDate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework import status

from apps.accounts.permissions import IsClinicAdminOrReceptionist
from .services import get_clinic_dashboard_stats, get_doctor_workload, get_appointment_trend

logger = logging.getLogger(__name__)


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
    SUPER_ADMIN only — returns platform-wide overview metrics across all clinics.
    Cached in Redis with short TTL (60s) and fail-open resilience.
    """
    permission_classes = [IsAuthenticated]

    CACHE_KEY = "super_admin_overview_stats"
    CACHE_TTL = 60  # 60 seconds

    def get(self, request):
        if request.user.role != "SUPER_ADMIN":
            return Response({"error": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        # Check Redis cache with fail-open safety
        try:
            cached_data = cache.get(self.CACHE_KEY)
            if cached_data is not None:
                return Response({"success": True, "data": cached_data})
        except Exception as exc:
            logger.warning("Failed to get cache for %s: %s", self.CACHE_KEY, exc)

        from apps.clinics.models import Clinic
        from apps.accounts.models import User
        from apps.appointments.models import Appointment
        from apps.billing.models import Invoice
        from apps.audit.models import AuditLog

        today = timezone.now().date()

        # Top-line metrics (O(1) aggregations)
        total_clinics = Clinic.objects.count()
        active_clinics = Clinic.objects.filter(is_active=True).count()
        total_users = User.objects.count()
        total_appointments = Appointment.objects.count()
        appointments_today = Appointment.objects.filter(appointment_date=today).count()
        total_revenue = Invoice.objects.filter(
            status="PAID"
        ).aggregate(total=Sum("total_amount"))["total"] or 0

        # 7-day trend (2 queries total via TruncDate grouping instead of 14 per-day queries)
        start_7_days = today - timedelta(days=6)

        rev_by_date = {
            row["day"]: row["total"] or 0
            for row in Invoice.objects.filter(
                status="PAID", created_at__date__gte=start_7_days, created_at__date__lte=today
            )
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(total=Sum("total_amount"))
        }

        appts_by_date = {
            row["appointment_date"]: row["count"]
            for row in Appointment.objects.filter(
                appointment_date__gte=start_7_days, appointment_date__lte=today
            )
            .values("appointment_date")
            .annotate(count=Count("id"))
        }

        trend_data = []
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            trend_data.append({
                "date": d.strftime("%b %d"),
                "revenue": float(rev_by_date.get(d, 0)),
                "appointments": appts_by_date.get(d, 0)
            })

        # Recent 10 audit logs (1 query with select_related)
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

        data = {
            "total_clinics": total_clinics,
            "active_clinics": active_clinics,
            "total_users": total_users,
            "total_appointments": total_appointments,
            "appointments_today": appointments_today,
            "total_revenue_paid": float(total_revenue),
            "trend_data": trend_data,
            "recent_logs": recent_logs,
        }

        # Set Redis cache with fail-open safety
        try:
            cache.set(self.CACHE_KEY, data, self.CACHE_TTL)
        except Exception as exc:
            logger.warning("Failed to set cache for %s: %s", self.CACHE_KEY, exc)

        return Response({
            "success": True,
            "data": data
        })


class SuperAdminClinicsPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


class SuperAdminClinicsView(APIView):
    """
    SUPER_ADMIN only — paginated breakdown of clinics with annotated stats.
    Eliminates N+1 query storm by computing all stats in a single annotated query with select_related.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != "SUPER_ADMIN":
            return Response({"error": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        from apps.clinics.models import Clinic

        today = timezone.now().date()
        search = request.query_params.get("search", "").strip()

        qs = (
            Clinic.objects.all()
            .select_related("subscription")
            .annotate(
                annotated_total_appointments=Count("appointments", distinct=True),
                annotated_appointments_today=Count(
                    "appointments",
                    filter=Q(appointments__appointment_date=today),
                    distinct=True,
                ),
                annotated_total_doctors=Count(
                    "doctor_associations",
                    filter=Q(doctor_associations__is_active=True),
                    distinct=True,
                ),
                annotated_total_patients=Count("appointments__patient", distinct=True),
            )
            .order_by("name")
        )

        if search:
            qs = qs.filter(name__icontains=search)

        paginator = SuperAdminClinicsPagination()
        page = paginator.paginate_queryset(qs, request, view=self)

        clinic_list = []
        for clinic in page:
            clinic_list.append({
                "id": clinic.id,
                "name": clinic.name,
                "plan": (clinic.subscription.plan if hasattr(clinic, "subscription") and clinic.subscription else "starter").upper(),
                "is_active": clinic.is_active,
                "total_appointments": clinic.annotated_total_appointments,
                "appointments_today": clinic.annotated_appointments_today,
                "total_doctors": clinic.annotated_total_doctors,
                "total_patients": clinic.annotated_total_patients,
            })

        return paginator.get_paginated_response(clinic_list)


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