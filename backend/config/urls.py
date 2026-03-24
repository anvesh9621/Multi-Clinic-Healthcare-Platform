
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from apps.accounts.views import CustomTokenObtainPairView


urlpatterns = [
    path("admin/", admin.site.urls),

    # Appointment APIs
    path("api/accounts/", include("apps.accounts.urls")),
    path("api/appointments/", include("apps.appointments.urls")),

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
]
