from datetime import date, time
from apps.core.test_tenancy import TenantIsolationTestCase
from apps.core.factories import (
    PatientProfileFactory,
    create_doctor_clinic_with_full_week_schedule,
)
from apps.appointments.models import Appointment


class AppointmentTenancyTests(TenantIsolationTestCase):
    def setUp(self):
        super().setUp()
        self.doc_clinic_a = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_a)
        self.doc_clinic_b = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_b)

        self.patient_a = PatientProfileFactory(user__clinic=self.clinic_a)
        self.patient_b = PatientProfileFactory(user__clinic=self.clinic_b)

        self.appointment_a = Appointment.objects.create(
            clinic=self.clinic_a,
            doctor_clinic=self.doc_clinic_a,
            patient=self.patient_a,
            appointment_date=date(2030, 6, 1),
            start_time=time(10, 0),
            end_time=time(10, 30),
            status="SCHEDULED"
        )
        self.appointment_b = Appointment.objects.create(
            clinic=self.clinic_b,
            doctor_clinic=self.doc_clinic_b,
            patient=self.patient_b,
            appointment_date=date(2030, 6, 1),
            start_time=time(11, 0),
            end_time=time(11, 30),
            status="SCHEDULED"
        )

    def test_appointment_list_isolation(self):
        """AppointmentListView: Clinic A admin cannot see Clinic B appointments."""
        self.assert_clinic_a_cannot_see_clinic_b_data("/api/appointments/", self.appointment_b.id)

    def test_appointment_detail_isolation(self):
        """AppointmentDetailView: Direct GET by ID blocked for Clinic B appointment."""
        self.assert_direct_id_access_blocked(f"/api/appointments/{self.appointment_b.id}/", expected_status=(403, 404))

    def test_appointment_status_update_isolation(self):
        """AppointmentStatusUpdateView: Direct status update by ID blocked for Clinic B appointment."""
        self.assert_direct_id_access_blocked(
            f"/api/appointments/{self.appointment_b.id}/status/",
            expected_status=(403, 404),
            method="patch"
        )
