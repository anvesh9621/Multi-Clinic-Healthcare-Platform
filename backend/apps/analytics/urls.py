from django.urls import path
from .views import (
    ClinicDashboardView,
    DoctorWorkloadView,
    AppointmentTrendView,
    SuperAdminStatsView,
    SuperAdminClinicsView,
    PaymentMetricsView,
)

urlpatterns = [
    path("dashboard/", ClinicDashboardView.as_view()),
    path("doctor-workload/", DoctorWorkloadView.as_view()),
    path("appointment-trend/", AppointmentTrendView.as_view()),
    path("super-admin/", SuperAdminStatsView.as_view(), name="super-admin-stats"),
    path("super-admin/clinics/", SuperAdminClinicsView.as_view(), name="super-admin-clinics"),
    path("payment-metrics/", PaymentMetricsView.as_view(), name="payment-metrics"),
]