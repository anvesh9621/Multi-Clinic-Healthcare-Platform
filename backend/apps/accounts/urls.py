from django.urls import path
from .views import (
    MeView, PasswordResetRequestView, PasswordResetConfirmView,
    SuperAdminCreateClinicAdminView, SuperAdminImpersonateView,
    ClinicAdminInvitationStatusView, ClinicAdminInviteAcceptView,
    PatientOTPRequestView, PatientOTPVerifyView
)

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("clinic-admins/create/", SuperAdminCreateClinicAdminView.as_view(), name="create-clinic-admin"),
    path("clinic-admins/invitations/status/<str:token>/", ClinicAdminInvitationStatusView.as_view(), name="admin-invite-status"),
    path("clinic-admins/invitations/accept/", ClinicAdminInviteAcceptView.as_view(), name="admin-invite-accept"),
    path("patient/otp/request/", PatientOTPRequestView.as_view(), name="patient-otp-request"),
    path("patient/otp/verify/", PatientOTPVerifyView.as_view(), name="patient-otp-verify"),
    path("impersonate/", SuperAdminImpersonateView.as_view(), name="impersonate-admin"),
]