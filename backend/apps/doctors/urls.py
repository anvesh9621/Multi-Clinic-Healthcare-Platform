from django.urls import path
from .views import (
    DoctorClinicListView, ClinicListView,
    PublicSpecialtyListView, PublicDoctorListView,
    DoctorScheduleListCreateView, DoctorScheduleDetailView,
    DoctorReviewListCreateView,
    CreateDoctorInvitationView, DoctorInvitationStatusView, AdminDoctorInvitationListView,
    CreateDoctorScheduleView,
    DoctorProfileView, DoctorInviteAcceptView,
    DoctorLeaveListCreateView, DoctorLeaveDetailView,
)

urlpatterns = [
    path("", DoctorClinicListView.as_view(), name="doctor-clinic-list"),
    path("clinics/", ClinicListView.as_view(), name="clinic-list"),
    path("public/specialties/", PublicSpecialtyListView.as_view(), name="public-specialties"),
    path("public/doctors/", PublicDoctorListView.as_view(), name="public-doctors"),
    path("<int:doctor_id>/reviews/", DoctorReviewListCreateView.as_view(), name="doctor-reviews"),
    path("schedules/", DoctorScheduleListCreateView.as_view()),
    path("schedules/<int:pk>/", DoctorScheduleDetailView.as_view()),
    path("leaves/", DoctorLeaveListCreateView.as_view()),
    path("leaves/<int:pk>/", DoctorLeaveDetailView.as_view()),
    
    # Invitations
    path("invitations/", AdminDoctorInvitationListView.as_view()),
    path("invitations/create/", CreateDoctorInvitationView.as_view()),
    path("invitations/status/<str:token>/", DoctorInvitationStatusView.as_view()),
    path("invite/accept/", DoctorInviteAcceptView.as_view(), name="doctor-invite-accept"),
    path("schedule/create/", CreateDoctorScheduleView.as_view()),
    path("profile/", DoctorProfileView.as_view(), name="doctor-profile"),
    path("invite/accept/", DoctorInviteAcceptView.as_view(), name="doctor-invite-accept"),
]
