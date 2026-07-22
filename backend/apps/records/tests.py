from django.test import TestCase
from rest_framework.test import APIClient
from apps.core.test_utils import setup_test_environment
from apps.appointments.models import Appointment
from apps.records.models import MedicalRecord


class MedicalRecordOwnershipTests(TestCase):
    """
    Verifies that get_owned_appointment_or_403 correctly gates access in
    MedicalRecordCreateUpdateView without duplicating logic per view.
    """

    def setUp(self):
        self.env = setup_test_environment()
        self.client = APIClient()
        self.doctor_a = self.env["doctor_a"]
        self.doctor_b = self.env["doctor_b"]
        self.patient_1 = self.env["patient_1"]
        self.patient_2 = self.env["patient_2"]

        # Appointment at clinic A for patient_1
        self.appointment_a = Appointment.objects.create(
            clinic=self.env["clinic_a"],
            doctor_clinic=self.doctor_a,
            patient=self.patient_1,
            appointment_date="2030-01-01",
            start_time="10:00:00",
            end_time="10:30:00",
        )
        # Appointment at clinic B for patient_1
        self.appointment_b = Appointment.objects.create(
            clinic=self.env["clinic_b"],
            doctor_clinic=self.doctor_b,
            patient=self.patient_1,
            appointment_date="2030-01-02",
            start_time="10:00:00",
            end_time="10:30:00",
        )

    def test_patient_can_get_own_record(self):
        """Patient GETs their own appointment's record — should succeed (200 or 404-no-record)."""
        self.client.force_authenticate(user=self.patient_1.user)
        response = self.client.get(f"/api/records/consultation/{self.appointment_a.id}/")
        self.assertIn(response.status_code, [200, 404])

    def test_patient_cannot_get_another_patients_record(self):
        """Patient A cannot GET Patient B's appointment record — must 403."""
        self.client.force_authenticate(user=self.patient_2.user)
        response = self.client.get(f"/api/records/consultation/{self.appointment_a.id}/")
        self.assertEqual(response.status_code, 403)

    def test_doctor_cannot_get_another_clinics_appointment(self):
        """Doctor A cannot GET an appointment owned by Doctor B — must 403."""
        self.client.force_authenticate(user=self.doctor_a.doctor.user)
        response = self.client.get(f"/api/records/consultation/{self.appointment_b.id}/")
        self.assertEqual(response.status_code, 403)


class PatientHistoryViewTests(TestCase):
    """
    Verifies correct scoping for the split DoctorPatientHistoryView /
    PatientOwnHistoryView views.
    """

    def setUp(self):
        self.env = setup_test_environment()
        self.client = APIClient()
        self.doctor_a = self.env["doctor_a"]
        self.doctor_b = self.env["doctor_b"]
        self.patient_1 = self.env["patient_1"]

        # Appointment + record at Clinic A
        appt_a = Appointment.objects.create(
            clinic=self.env["clinic_a"],
            doctor_clinic=self.doctor_a,
            patient=self.patient_1,
            appointment_date="2030-01-01",
            start_time="10:00:00",
            end_time="10:30:00",
        )
        self.record_a = MedicalRecord.objects.create(
            appointment=appt_a,
            patient=self.patient_1,
            doctor_clinic=self.doctor_a,
            private_notes="Doctor-only note",
        )

        # Appointment + record at Clinic B
        appt_b = Appointment.objects.create(
            clinic=self.env["clinic_b"],
            doctor_clinic=self.doctor_b,
            patient=self.patient_1,
            appointment_date="2030-01-02",
            start_time="10:00:00",
            end_time="10:30:00",
        )
        self.record_b = MedicalRecord.objects.create(
            appointment=appt_b,
            patient=self.patient_1,
            doctor_clinic=self.doctor_b,
            private_notes="Clinic B doctor-only note",
        )

    def test_doctor_sees_only_own_clinic_patient_records(self):
        """Doctor A sees record_a but NOT record_b (Clinic B's record)."""
        self.client.force_authenticate(user=self.doctor_a.doctor.user)
        response = self.client.get(f"/api/records/history/patient/{self.patient_1.id}/")
        self.assertEqual(response.status_code, 200)
        ids = [r["id"] for r in response.data]
        self.assertIn(self.record_a.id, ids)
        self.assertNotIn(self.record_b.id, ids)

    def test_patient_sees_own_history_with_private_notes_stripped(self):
        """Patient gets their own history; private_notes must be absent."""
        self.client.force_authenticate(user=self.patient_1.user)
        response = self.client.get(f"/api/records/history/patient/{self.patient_1.id}/")
        self.assertEqual(response.status_code, 200)
        for record in response.data:
            self.assertNotIn("private_notes", record)

    def test_patient_cannot_access_another_patients_history(self):
        """Patient cannot request a different patient_id — must 403."""
        other_patient = self.env["patient_2"]
        self.client.force_authenticate(user=other_patient.user)
        response = self.client.get(f"/api/records/history/patient/{self.patient_1.id}/")
        self.assertEqual(response.status_code, 403)

    def test_doctor_a_cannot_see_clinic_b_records(self):
        """Doctor A should get 0 results for Clinic B's patient visit."""
        # patient_2 only has records at clinic_b
        patient_2 = self.env["patient_2"]
        appt_b2 = Appointment.objects.create(
            clinic=self.env["clinic_b"],
            doctor_clinic=self.doctor_b,
            patient=patient_2,
            appointment_date="2030-01-03",
            start_time="11:00:00",
            end_time="11:30:00",
        )
        MedicalRecord.objects.create(
            appointment=appt_b2,
            patient=patient_2,
            doctor_clinic=self.doctor_b,
        )
        # Doctor A asks for patient_2's history — should get empty list (not 403,
        # because access is scoped by doctor ownership, returning only matching records)
        self.client.force_authenticate(user=self.doctor_a.doctor.user)
        response = self.client.get(f"/api/records/history/patient/{patient_2.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)
