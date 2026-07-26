from django.urls import path
from .views import (
    CreateReceptionistView, ReceptionistListView, ClinicRegistrationView,
    SuperAdminCreateClinicView, ClinicToggleStatusView, SuperAdminChangePlanView,
    ReceptionistInvitationStatusView, ReceptionistInviteAcceptView, AdminReceptionistInvitationListView
)

urlpatterns = [
    path('receptionists/', ReceptionistListView.as_view(), name='receptionist-list'),
    path('receptionists/create/', CreateReceptionistView.as_view(), name='receptionist-create'),
    path('receptionists/invitations/', AdminReceptionistInvitationListView.as_view(), name='receptionist-invitation-list'),
    path('receptionists/invitations/status/<str:token>/', ReceptionistInvitationStatusView.as_view(), name='receptionist-invite-status'),
    path('receptionists/invitations/accept/', ReceptionistInviteAcceptView.as_view(), name='receptionist-invite-accept'),
    path('register/', ClinicRegistrationView.as_view(), name='clinic-register'),
    path('create/', SuperAdminCreateClinicView.as_view(), name='superadmin-clinic-create'),
    path('<int:pk>/toggle-status/', ClinicToggleStatusView.as_view(), name='clinic-toggle-status'),
    path('super-admin/<int:pk>/change-plan/', SuperAdminChangePlanView.as_view(), name='superadmin-change-plan'),
]

