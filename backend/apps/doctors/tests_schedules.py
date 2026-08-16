import pytest
from datetime import time
from rest_framework.test import APITestCase, APIClient
from django.test.utils import CaptureQueriesContext
from django.db import connection

from apps.core.factories import (
    ClinicFactory,
    ClinicAdminFactory,
    SuperAdminFactory,
    DoctorFactory,
    DoctorClinicFactory,
    create_doctor_clinic_with_full_week_schedule,
)
from apps.doctors.models import DoctorSchedule, DoctorClinic


@pytest.mark.django_db
class DoctorScheduleWorkflowTests(APITestCase):
    def setUp(self):
        self.clinic_a = ClinicFactory(name="Clinic Alpha")
        self.clinic_b = ClinicFactory(name="Clinic Beta")

        self.admin_a = ClinicAdminFactory(clinic=self.clinic_a)
        self.admin_b = ClinicAdminFactory(clinic=self.clinic_b)
        self.super_admin = SuperAdminFactory()

        # Doctor at Clinic A
        self.doc_clinic_a = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_a)
        self.doctor_a_user = self.doc_clinic_a.doctor.user

        # Doctor at Clinic B
        self.doc_clinic_b = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_b)
        self.doctor_b_user = self.doc_clinic_b.doctor.user

        self.client_admin_a = APIClient()
        self.client_admin_a.force_authenticate(user=self.admin_a)

    def test_clinic_admin_schedule_list_tenant_isolation(self):
        """Clinic Admin A can only see Clinic A schedules, never Clinic B schedules."""
        response = self.client_admin_a.get("/api/doctors/schedules/")
        self.assertEqual(response.status_code, 200)

        data = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        clinic_b_schedule_ids = set(DoctorSchedule.objects.filter(doctor_clinic=self.doc_clinic_b).values_list("id", flat=True))
        returned_ids = {item["id"] for item in data}

        self.assertTrue(returned_ids.isdisjoint(clinic_b_schedule_ids))
        self.assertGreater(len(returned_ids), 0)

    def test_clinic_admin_cannot_create_schedule_for_other_clinic(self):
        """Clinic Admin A cannot create a schedule block for Clinic B's doctor_clinic."""
        payload = {
            "doctor_clinic_id": self.doc_clinic_b.id,
            "day_of_week": 0,
            "start_time": "18:00:00",
            "end_time": "20:00:00",
            "slot_duration": 30,
        }
        response = self.client_admin_a.post("/api/doctors/schedules/", payload)
        self.assertEqual(response.status_code, 400)
        errors = response.data.get("errors", response.data)
        self.assertIn("doctor_clinic_id", errors)

    def test_clinic_admin_cannot_get_patch_or_delete_other_clinic_schedule(self):
        """Clinic Admin A cannot GET, PATCH, or DELETE Clinic B's schedule by direct ID."""
        sched_b = DoctorSchedule.objects.filter(doctor_clinic=self.doc_clinic_b).first()

        # GET
        res_get = self.client_admin_a.get(f"/api/doctors/schedules/{sched_b.id}/")
        self.assertEqual(res_get.status_code, 404)

        # PATCH
        res_patch = self.client_admin_a.patch(f"/api/doctors/schedules/{sched_b.id}/", {"slot_duration": 45})
        self.assertEqual(res_patch.status_code, 404)

        # DELETE
        res_delete = self.client_admin_a.delete(f"/api/doctors/schedules/{sched_b.id}/")
        self.assertEqual(res_delete.status_code, 404)

    def test_schedule_filtering_by_doctor_clinic_and_day_of_week(self):
        """Verify query params ?doctor_clinic_id=X and ?day_of_week=Y filter accurately."""
        # 1. Filter by doctor_clinic_id
        res = self.client_admin_a.get(f"/api/doctors/schedules/?doctor_clinic_id={self.doc_clinic_a.id}")
        self.assertEqual(res.status_code, 200)
        data = res.data.get("results", res.data) if isinstance(res.data, dict) else res.data
        self.assertEqual(len(data), 7)  # Full week has 7 days

        # 2. Filter by doctor_clinic_id AND day_of_week
        res_day0 = self.client_admin_a.get(f"/api/doctors/schedules/?doctor_clinic_id={self.doc_clinic_a.id}&day_of_week=0")
        self.assertEqual(res_day0.status_code, 200)
        data_day0 = res_day0.data.get("results", res_day0.data) if isinstance(res_day0.data, dict) else res_day0.data
        self.assertEqual(len(data_day0), 1)
        self.assertEqual(data_day0[0]["day_of_week"], 0)

    def test_schedule_list_query_count_ceiling_with_select_related(self):
        """Listing doctor schedules executes in fixed queries and doesn't issue N+1 queries for doctor or clinic."""
        with CaptureQueriesContext(connection) as ctx:
            response = self.client_admin_a.get(f"/api/doctors/schedules/?doctor_clinic_id={self.doc_clinic_a.id}")

        self.assertEqual(response.status_code, 200)
        # Should be at most 2 queries: pagination count (if paginated) + 1 select_related fetch
        self.assertLessEqual(len(ctx.captured_queries), 3)

    def test_schedule_overlap_rejection_on_create(self):
        """Reject overlapping time blocks on the same day for the same doctor_clinic."""
        # Existing schedule for Monday (day 0) is 09:00 - 17:00 from factory
        # Try adding 10:00 - 12:00 (enclosed overlap)
        payload = {
            "doctor_clinic_id": self.doc_clinic_a.id,
            "day_of_week": 0,
            "start_time": "10:00:00",
            "end_time": "12:00:00",
            "slot_duration": 30,
        }
        res = self.client_admin_a.post("/api/doctors/schedules/", payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("detail", str(res.data))

        # Try adding 08:00 - 10:00 (partial overlap at start)
        payload["start_time"] = "08:00:00"
        payload["end_time"] = "10:00:00"
        res = self.client_admin_a.post("/api/doctors/schedules/", payload)
        self.assertEqual(res.status_code, 400)

        # Try adding 16:00 - 18:00 (partial overlap at end)
        payload["start_time"] = "16:00:00"
        payload["end_time"] = "18:00:00"
        res = self.client_admin_a.post("/api/doctors/schedules/", payload)
        self.assertEqual(res.status_code, 400)

    def test_schedule_non_overlapping_blocks_on_same_day_allowed(self):
        """Non-overlapping time blocks on the same day are allowed (e.g. morning and evening shifts)."""
        # Delete existing monday schedule
        DoctorSchedule.objects.filter(doctor_clinic=self.doc_clinic_a, day_of_week=0).delete()

        # Block 1: Morning Shift 09:00 - 13:00
        res1 = self.client_admin_a.post("/api/doctors/schedules/", {
            "doctor_clinic_id": self.doc_clinic_a.id,
            "day_of_week": 0,
            "start_time": "09:00:00",
            "end_time": "13:00:00",
            "slot_duration": 30,
        })
        self.assertEqual(res1.status_code, 201)

        # Block 2: Evening Shift 14:00 - 18:00 (no overlap!)
        res2 = self.client_admin_a.post("/api/doctors/schedules/", {
            "doctor_clinic_id": self.doc_clinic_a.id,
            "day_of_week": 0,
            "start_time": "14:00:00",
            "end_time": "18:00:00",
            "slot_duration": 30,
        })
        self.assertEqual(res2.status_code, 201)

        # Confirm both exist
        monday_blocks = DoctorSchedule.objects.filter(doctor_clinic=self.doc_clinic_a, day_of_week=0)
        self.assertEqual(monday_blocks.count(), 2)

    def test_schedule_overlap_rejection_on_patch_update(self):
        """PATCH updating a schedule to overlap with an existing block is rejected."""
        DoctorSchedule.objects.filter(doctor_clinic=self.doc_clinic_a, day_of_week=0).delete()

        # Morning 09:00 - 12:00
        s1 = DoctorSchedule.objects.create(
            doctor_clinic=self.doc_clinic_a,
            day_of_week=0,
            start_time="09:00:00",
            end_time="12:00:00",
            slot_duration=30,
        )
        # Evening 14:00 - 18:00
        s2 = DoctorSchedule.objects.create(
            doctor_clinic=self.doc_clinic_a,
            day_of_week=0,
            start_time="14:00:00",
            end_time="18:00:00",
            slot_duration=30,
        )

        # Try updating s2 to start at 11:00 (overlaps with s1 09:00-12:00)
        res = self.client_admin_a.patch(f"/api/doctors/schedules/{s2.id}/", {"start_time": "11:00:00"})
        self.assertEqual(res.status_code, 400)

        # Updating s2 duration or moving to 15:00-19:00 (non-overlapping) succeeds
        res_ok = self.client_admin_a.patch(f"/api/doctors/schedules/{s2.id}/", {"start_time": "15:00:00", "end_time": "19:00:00"})
        self.assertEqual(res_ok.status_code, 200)
        s2.refresh_from_db()
        self.assertEqual(str(s2.start_time), "15:00:00")

    def test_start_time_after_end_time_rejected(self):
        """Reject schedule where start_time >= end_time."""
        payload = {
            "doctor_clinic_id": self.doc_clinic_a.id,
            "day_of_week": 2,
            "start_time": "17:00:00",
            "end_time": "09:00:00",
            "slot_duration": 30,
        }
        res = self.client_admin_a.post("/api/doctors/schedules/", payload)
        self.assertEqual(res.status_code, 400)
        errors = res.data.get("errors", res.data)
        self.assertIn("end_time", errors)
