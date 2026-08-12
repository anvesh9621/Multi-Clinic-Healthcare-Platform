from datetime import date, time
from django.test import TestCase
from rest_framework.test import APIClient
from apps.core.factories import (
    ClinicFactory,
    PatientProfileFactory,
    ReceptionistFactory,
    create_doctor_clinic_with_full_week_schedule,
)
from apps.appointments.models import Appointment
from apps.records.models import MedicalRecord


class MedicalRecordOwnershipTests(TestCase):
    """
    Verifies that get_owned_appointment_or_403 correctly gates access in
    MedicalRecordCreateUpdateView without duplicating logic per view.
    """

    def setUp(self):
        self.client = APIClient()
        self.clinic_a = ClinicFactory(name="Clinic A")
        self.clinic_b = ClinicFactory(name="Clinic B")
        self.doctor_a = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_a)
        self.doctor_b = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_b)
        self.patient_1 = PatientProfileFactory()
        self.patient_2 = PatientProfileFactory()
        
        self.receptionist_a = ReceptionistFactory(clinic=self.clinic_a)

        # Appointment at clinic A for patient_1
        self.appointment_a = Appointment.objects.create(
            clinic=self.clinic_a,
            doctor_clinic=self.doctor_a,
            patient=self.patient_1,
            appointment_date=date(2030, 1, 1),
            start_time=time(10, 0),
            end_time=time(10, 30),
        )
        # Appointment at clinic B for patient_1
        self.appointment_b = Appointment.objects.create(
            clinic=self.clinic_b,
            doctor_clinic=self.doctor_b,
            patient=self.patient_1,
            appointment_date=date(2030, 1, 2),
            start_time=time(10, 0),
            end_time=time(10, 30),
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
        """Doctor A cannot GET appointment record for Clinic B — must 403."""
        self.client.force_authenticate(user=self.doctor_a.doctor.user)
        response = self.client.get(f"/api/records/consultation/{self.appointment_b.id}/")
        self.assertEqual(response.status_code, 403)


class PatientHistoryViewTests(TestCase):
    """
    Verifies correct scoping for the split DoctorPatientHistoryView /
    PatientOwnHistoryView views.
    """

    def setUp(self):
        self.client = APIClient()
        self.clinic_a = ClinicFactory(name="Clinic A")
        self.clinic_b = ClinicFactory(name="Clinic B")
        self.doctor_a = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_a)
        self.doctor_b = create_doctor_clinic_with_full_week_schedule(clinic=self.clinic_b)
        self.patient_1 = PatientProfileFactory()
        self.patient_2 = PatientProfileFactory()

        # Appointment + record at Clinic A
        appt_a = Appointment.objects.create(
            clinic=self.clinic_a,
            doctor_clinic=self.doctor_a,
            patient=self.patient_1,
            appointment_date=date(2030, 1, 1),
            start_time=time(10, 0),
            end_time=time(10, 30),
        )
        self.record_a = MedicalRecord.objects.create(
            appointment=appt_a,
            patient=self.patient_1,
            doctor_clinic=self.doctor_a,
            private_notes="Doctor-only note",
        )

        # Appointment + record at Clinic B
        appt_b = Appointment.objects.create(
            clinic=self.clinic_b,
            doctor_clinic=self.doctor_b,
            patient=self.patient_1,
            appointment_date=date(2030, 1, 2),
            start_time=time(10, 0),
            end_time=time(10, 30),
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
        items = response.data["results"] if isinstance(response.data, dict) and "results" in response.data else response.data
        ids = [r["id"] for r in items]
        self.assertIn(self.record_a.id, ids)
        self.assertNotIn(self.record_b.id, ids)

    def test_patient_sees_own_history_with_private_notes_stripped(self):
        """Patient gets their own history; private_notes must be absent."""
        self.client.force_authenticate(user=self.patient_1.user)
        response = self.client.get(f"/api/records/history/patient/{self.patient_1.id}/")
        self.assertEqual(response.status_code, 200)
        items = response.data["results"] if isinstance(response.data, dict) and "results" in response.data else response.data
        for record in items:
            self.assertNotIn("private_notes", record)

    def test_patient_cannot_access_another_patients_history(self):
        """Patient cannot request a different patient_id — must 403."""
        other_patient = self.patient_2
        self.client.force_authenticate(user=other_patient.user)
        response = self.client.get(f"/api/records/history/patient/{self.patient_1.id}/")
        self.assertEqual(response.status_code, 403)

    def test_doctor_a_cannot_see_clinic_b_records(self):
        """Doctor A should get 0 results for Clinic B's patient visit."""
        # patient_2 only has records at clinic_b
        patient_2 = self.patient_2
        appt_b2 = Appointment.objects.create(
            clinic=self.clinic_b,
            doctor_clinic=self.doctor_b,
            patient=patient_2,
            appointment_date=date(2030, 1, 3),
            start_time=time(11, 0),
            end_time=time(11, 30),
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
        items = response.data["results"] if isinstance(response.data, dict) and "results" in response.data else response.data
        self.assertEqual(len(items), 0)
