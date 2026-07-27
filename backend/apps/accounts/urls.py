from django.urls import path
from .views import (
    MeView, PasswordResetRequestView, PasswordResetConfirmView,
    SuperAdminCreateClinicAdminView, SuperAdminImpersonateView,
    ClinicAdminInvitationStatusView, ClinicAdminInviteAcceptView
)

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("clinic-admins/create/", SuperAdminCreateClinicAdminView.as_view(), name="create-clinic-admin"),
    path("clinic-admins/invitations/status/<str:token>/", ClinicAdminInvitationStatusView.as_view(), name="admin-invite-status"),
    path("clinic-admins/invitations/accept/", ClinicAdminInviteAcceptView.as_view(), name="admin-invite-accept"),
    path("impersonate/", SuperAdminImpersonateView.as_view(), name="impersonate-admin"),
]