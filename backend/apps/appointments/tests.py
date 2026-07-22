from django.test import TestCase, override_settings
from django.utils import timezone
from datetime import datetime, time, date

from apps.accounts.models import User
from apps.clinics.models import Clinic
from apps.doctors.models import Doctor, DoctorClinic, DoctorSchedule
from apps.patients.models import Patient
from apps.appointments.models import Appointment
from apps.appointments.services import book_appointment, change_appointment_status

@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_BROKER_URL="memory://", CELERY_RESULT_BACKEND="cache+memory://")
class OverlappingAppointmentTestCase(TestCase):
    def setUp(self):
        # Create users
        self.clinic_admin = User.objects.create(email="admin@test.com", role=User.RoleChoices.CLINIC_ADMIN)
        self.doc_user = User.objects.create(email="doc@test.com", role=User.RoleChoices.DOCTOR)
        self.pat_user = User.objects.create(email="pat@test.com", role=User.RoleChoices.PATIENT)

        # Create Clinic
        self.clinic = Clinic.objects.create(name="Test Clinic", address="Test Address")
        self.clinic_admin.clinic = self.clinic
        self.clinic_admin.save()
        self.doc_user.clinic = self.clinic
        self.doc_user.save()

        # Create Doctor
        self.doctor = Doctor.objects.create(user=self.doc_user, specialization="General")
        
        # Create DoctorClinic
        self.doctor_clinic = DoctorClinic.objects.create(
            doctor=self.doctor, 
            clinic=self.clinic, 
            consultation_fee=100
        )

        # Create Patient
        self.patient = Patient.objects.create(user=self.pat_user, date_of_birth="2000-01-01")

        # Create Schedule for Doctor (Monday = 0, today we will just use next Monday)
        self.next_monday = date(2030, 1, 7) # Jan 7, 2030 is a Monday
        self.schedule = DoctorSchedule.objects.create(
            doctor_clinic=self.doctor_clinic,
            day_of_week=0,
            start_time=time(9, 0),
            end_time=time(17, 0),
            slot_duration=30
        )

    def test_cancelled_appointment_frees_slot(self):
        # Book an appointment
        appt1 = book_appointment(
            clinic=self.clinic,
            doctor_clinic=self.doctor_clinic,
            patient=self.patient,
            created_by=self.pat_user,
            appointment_date=self.next_monday,
            start_time=time(10, 0),
            end_time=time(10, 30),
            reason="Checkup"
        )
        self.assertEqual(Appointment.objects.count(), 1)
        self.assertIsNotNone(appt1.time_range)

        # Cancel the appointment
        change_appointment_status(
            appointment=appt1,
            new_status="CANCELLED",
            user=self.clinic_admin
        )
        appt1.refresh_from_db()
        self.assertIsNone(appt1.time_range)

        # Try to book the exact same slot again, this should succeed
        appt2 = book_appointment(
            clinic=self.clinic,
            doctor_clinic=self.doctor_clinic,
            patient=self.patient,
            created_by=self.pat_user,
            appointment_date=self.next_monday,
            start_time=time(10, 0),
            end_time=time(10, 30),
            reason="Checkup Again"
        )
        self.assertEqual(Appointment.objects.count(), 2)
        self.assertIsNotNone(appt2.time_range)
