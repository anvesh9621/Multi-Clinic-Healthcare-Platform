from django.utils import timezone
from datetime import timedelta, time
import uuid

from apps.accounts.models import User
from apps.clinics.models import Clinic
from apps.subscriptions.models import Subscription
from apps.doctors.models import Doctor, DoctorClinic, DoctorSchedule
from apps.patients.models import Patient
from apps.appointments.models import Appointment

def create_clinic(name="Test Clinic"):
    clinic = Clinic.objects.create(name=name, domain=f"{name.lower().replace(' ', '')}.test.com")
    return clinic

def create_user(email, role, clinic=None, password="password123"):
    user = User.objects.create_user(email=email, password=password, role=role, clinic=clinic)
    return user

def create_doctor_with_schedule(clinic, email="doctor@test.com", password="password123"):
    user = create_user(email=email, role="DOCTOR", clinic=clinic, password=password)
    doctor = Doctor.objects.create(user=user, specialization="General")
    doctor_clinic = DoctorClinic.objects.create(doctor=doctor, clinic=clinic)

    for i in range(7):
        DoctorSchedule.objects.create(
            doctor_clinic=doctor_clinic,
            day_of_week=i,
            start_time=time(9, 0),
            end_time=time(17, 0),
            slot_duration=30
        )
    return doctor_clinic

def create_patient(email="patient@test.com", password="password123"):
    user = create_user(email=email, role="PATIENT", password=password)
    patient = Patient.objects.create(user=user, date_of_birth="1990-01-01", phone="1234567890")
    return patient

def setup_test_environment():
    clinic_a = create_clinic(name="Clinic A")
    clinic_b = create_clinic(name="Clinic B")

    admin_a = create_user(email="admin_a@test.com", role="CLINIC_ADMIN", clinic=clinic_a)
    admin_b = create_user(email="admin_b@test.com", role="CLINIC_ADMIN", clinic=clinic_b)

    doctor_a = create_doctor_with_schedule(clinic_a, email="doc_a@test.com")
    doctor_b = create_doctor_with_schedule(clinic_b, email="doc_b@test.com")

    patient_1 = create_patient(email="patient1@test.com")
    patient_2 = create_patient(email="patient2@test.com")

    return {
        "clinic_a": clinic_a,
        "clinic_b": clinic_b,
        "admin_a": admin_a,
        "admin_b": admin_b,
        "doctor_a": doctor_a,
        "doctor_b": doctor_b,
        "patient_1": patient_1,
        "patient_2": patient_2,
    }
