
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from apps.accounts.views import CustomTokenObtainPairView
from apps.doctors.views import PublicSpecialtyListView, PublicDoctorListView
from apps.appointments.public_views import (
    PublicClinicListView,
    PublicClinicDoctorsView,
    PublicAvailableSlotsView,
)


from apps.core.views import TestSeedInvitationView


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/test-seed-invitation/", TestSeedInvitationView.as_view(), name="test-seed-invitation"),

    # Appointment APIs
    path("api/accounts/", include("apps.accounts.urls")),
    path("api/appointments/", include("apps.appointments.urls")),
    path("api/public/specialties/", PublicSpecialtyListView.as_view(), name="root-public-specialties"),
    path("api/public/doctors/", PublicDoctorListView.as_view(), name="root-public-doctors"),
    path("api/public/clinics/", PublicClinicListView.as_view(), name="public-clinic-list"),
    path("api/public/clinics/<int:clinic_id>/doctors/", PublicClinicDoctorsView.as_view(), name="public-clinic-doctors"),
    path("api/public/doctors/<int:doctor_clinic_id>/slots/", PublicAvailableSlotsView.as_view(), name="public-doctor-slots"),

    # JWT Authentication
    path("api/token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/doctors/", include("apps.doctors.urls")),
    path("api/records/", include("apps.records.urls")),
    path("api/prescriptions/", include("apps.prescriptions.urls")),
    path("api/analytics/", include("apps.analytics.urls")),
    path("api/patients/", include("apps.patients.urls")),
    path("api/clinics/", include("apps.clinics.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/billing/", include("apps.billing.urls")),
    path("api/inventory/", include("apps.inventory.urls")),
    path("api/subscriptions/", include("apps.subscriptions.urls")),
]
