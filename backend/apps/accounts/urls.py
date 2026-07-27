from django.urls import path
from .views import (
    MeView, PasswordResetRequestView, PasswordResetConfirmView,
    SuperAdminCreateClinicAdminView, SuperAdminImpersonateView,
    ClinicAdminInvitationStatusView, ClinicAdminInviteAcceptView,
    PatientOTPRequestView, PatientOTPVerifyView, PatientGoogleAuthView,
    MFASetupView, MFAConfirmView, MFAVerifyView,
    MFARecoverView, MFAResetRequestView, MFAAdminResetView
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
    path("patient/google/", PatientGoogleAuthView.as_view(), name="patient-google-auth"),
    path("mfa/setup/", MFASetupView.as_view(), name="mfa-setup"),
    path("mfa/confirm/", MFAConfirmView.as_view(), name="mfa-confirm"),
    path("mfa/verify/", MFAVerifyView.as_view(), name="mfa-verify"),
    path("mfa/recover/", MFARecoverView.as_view(), name="mfa-recover"),
    path("mfa/reset-request/", MFAResetRequestView.as_view(), name="mfa-reset-request"),
    path("mfa/admin-reset/", MFAAdminResetView.as_view(), name="mfa-admin-reset"),
    path("impersonate/", SuperAdminImpersonateView.as_view(), name="impersonate-admin"),
]