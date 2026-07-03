from django.urls import path
from .views import (
    CreateReceptionistView, ReceptionistListView, ClinicRegistrationView,
    SuperAdminCreateClinicView, ClinicToggleStatusView, SuperAdminChangePlanView
)

urlpatterns = [
    path('receptionists/', ReceptionistListView.as_view(), name='receptionist-list'),
    path('receptionists/create/', CreateReceptionistView.as_view(), name='receptionist-create'),
    path('register/', ClinicRegistrationView.as_view(), name='clinic-register'),
    path('create/', SuperAdminCreateClinicView.as_view(), name='superadmin-clinic-create'),
    path('<int:pk>/toggle-status/', ClinicToggleStatusView.as_view(), name='clinic-toggle-status'),
    path('super-admin/<int:pk>/change-plan/', SuperAdminChangePlanView.as_view(), name='superadmin-change-plan'),
]

