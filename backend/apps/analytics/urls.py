from django.urls import path
from .views import ClinicDashboardView,DoctorWorkloadView,AppointmentTrendView

urlpatterns = [
    path("dashboard/", ClinicDashboardView.as_view()),
    path("doctor-workload/", DoctorWorkloadView.as_view()),
    path("appointment-trend/", AppointmentTrendView.as_view()),
]