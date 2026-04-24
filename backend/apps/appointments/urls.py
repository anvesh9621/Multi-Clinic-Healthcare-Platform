from django.urls import path
from .views import (
    BookAppointmentView, AppointmentListView, AppointmentDetailView,
    AppointmentStatusUpdateView, SlotAvailabilityView,
    ReceptionistBookAppointmentView, DoctorRescheduleAppointmentView,
    DoctorRunningLateView,
)

urlpatterns = [
    path("book/", BookAppointmentView.as_view(), name="book-appointment"),
    path("receptionist/book/", ReceptionistBookAppointmentView.as_view(), name="receptionist-book-appointment"),
    path("", AppointmentListView.as_view(), name="appointment-list"),
    path("<int:pk>/", AppointmentDetailView.as_view(), name="appointment-detail"),
    path("<int:pk>/status/", AppointmentStatusUpdateView.as_view(), name="appointment-status-update"),
    path("slots/", SlotAvailabilityView.as_view(), name="slot-availability"),
    path("<int:pk>/reschedule/", DoctorRescheduleAppointmentView.as_view(), name="appointment-reschedule"),
    path("running-late/", DoctorRunningLateView.as_view(), name="appointments-running-late"),
]