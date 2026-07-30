from rest_framework.test import APITestCase
from apps.core.test_tenancy import TenantIsolationTestCase
from apps.core.factories import (
    ClinicFactory,
    ClinicAdminFactory,
    SuperAdminFactory,
    PatientFactory,
    create_doctor_clinic_with_full_week_schedule,
)
from apps.doctors.models import DoctorSchedule, DoctorLeave


class DoctorTenancyTests(TenantIsolationTestCase):
    def setUp(self):
        super().setUp()
        self.doc_clinic_a = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_a)
        self.doc_clinic_b = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_b)

        self.schedule_a = DoctorSchedule.objects.filter(doctor_clinic=self.doc_clinic_a).first()
        self.schedule_b = DoctorSchedule.objects.filter(doctor_clinic=self.doc_clinic_b).first()

        self.leave_a = DoctorLeave.objects.create(
            doctor_clinic=self.doc_clinic_a,
            start_date="2030-05-01",
            end_date="2030-05-05",
            reason="Vacation"
        )
        self.leave_b = DoctorLeave.objects.create(
            doctor_clinic=self.doc_clinic_b,
            start_date="2030-05-01",
            end_date="2030-05-05",
            reason="Conference"
        )

    def test_doctor_clinic_list_isolation(self):
        """DoctorClinicListView: Clinic A admin cannot see Clinic B's doctor clinic link."""
        self.assert_clinic_a_cannot_see_clinic_b_data("/api/doctors/", self.doc_clinic_b.id)
        self.assert_super_admin_can_see_clinic_b_data("/api/doctors/", self.doc_clinic_b.id)

    def test_doctor_schedule_list_isolation(self):
        """DoctorScheduleListCreateView: Clinic A admin cannot see Clinic B schedules."""
        self.assert_clinic_a_cannot_see_clinic_b_data("/api/doctors/schedules/", self.schedule_b.id)
        self.assert_super_admin_can_see_clinic_b_data("/api/doctors/schedules/", self.schedule_b.id)

    def test_doctor_schedule_detail_isolation_get(self):
        """DoctorScheduleDetailView: Direct GET by ID blocked for Clinic B's schedule."""
        self.assert_direct_id_access_blocked(f"/api/doctors/schedules/{self.schedule_b.id}/", expected_status=(404, 403))

    def test_doctor_schedule_detail_isolation_patch(self):
        """DoctorScheduleDetailView: Direct PATCH by ID blocked for Clinic B's schedule."""
        self.assert_direct_id_access_blocked(f"/api/doctors/schedules/{self.schedule_b.id}/", expected_status=(404, 403), method="patch")

    def test_doctor_schedule_detail_isolation_delete(self):
        """DoctorScheduleDetailView: Direct DELETE by ID blocked for Clinic B's schedule."""
        self.assert_direct_id_access_blocked(f"/api/doctors/schedules/{self.schedule_b.id}/", expected_status=(404, 403), method="delete")

    def test_doctor_leave_list_isolation(self):
        """DoctorLeaveListCreateView: Clinic A admin cannot see Clinic B leave requests."""
        self.assert_clinic_a_cannot_see_clinic_b_data("/api/doctors/leaves/", self.leave_b.id)
        self.assert_super_admin_can_see_clinic_b_data("/api/doctors/leaves/", self.leave_b.id)

    def test_doctor_leave_detail_isolation(self):
        """DoctorLeaveDetailView: Direct GET access blocked for Clinic B leave."""
        self.assert_direct_id_access_blocked(f"/api/doctors/leaves/{self.leave_b.id}/", expected_status=(404, 403))

    def test_doctor_leave_unrecognized_role_fail_closed(self):
        """Unrecognized roles (e.g. PATIENT) get empty queryset / access denied."""
        patient_user = PatientFactory()
        self.client.force_authenticate(user=patient_user)
        response = self.client.get("/api/doctors/leaves/")
        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 0)
