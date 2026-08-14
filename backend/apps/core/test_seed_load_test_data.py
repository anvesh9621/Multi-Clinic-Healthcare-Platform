import io
import pytest
from django.core.management import call_command

from apps.accounts.models import User
from apps.appointments.models import Appointment
from apps.billing.models import Invoice
from apps.clinics.models import Clinic
from apps.doctors.models import Doctor, DoctorClinic, DoctorSchedule
from apps.patients.models import Patient
from apps.records.models import MedicalRecord
from apps.subscriptions.models import Subscription


@pytest.mark.django_db
class TestSeedLoadTestDataCommand:
    def test_seed_load_test_data_execution(self):
        out = io.StringIO()
        call_command(
            "seed_load_test_data",
            clinics=3,
            doctors_per_clinic=2,
            patients=15,
            appointments=30,
            days_past=10,
            days_future=5,
            stdout=out,
        )
        output_str = out.getvalue()
        assert "Seeding Load Test Data" in output_str
        assert "Load Test Data Seeding Complete" in output_str

        # Verify Clinics & Subscriptions
        assert Clinic.objects.count() == 3
        assert Subscription.objects.filter(status="active").count() == 3
        assert User.objects.filter(role=User.RoleChoices.CLINIC_ADMIN).count() == 3
        assert User.objects.filter(role=User.RoleChoices.RECEPTIONIST).count() == 3

        # Verify Doctors, DoctorClinics, and Schedules
        assert Doctor.objects.count() == 6
        assert DoctorClinic.objects.count() == 6
        assert DoctorSchedule.objects.count() == 6 * 7

        # Verify Patients
        assert Patient.objects.count() == 15
        assert User.objects.filter(role=User.RoleChoices.PATIENT).count() == 15

        # Verify Appointments
        assert Appointment.objects.count() == 30

        # Verify appointments have all foreign keys and non-null time_ranges
        from django.db import connection
        for appt in Appointment.objects.all():
            assert appt.clinic is not None
            assert appt.doctor_clinic is not None
            assert appt.patient is not None
            assert appt.created_by is not None
            assert appt.start_time is not None
            assert appt.end_time is not None
            if connection.vendor == "postgresql":
                assert appt.time_range is not None


        # Verify completed appointments have medical records & invoices
        completed_appts = Appointment.objects.filter(status=Appointment.StatusChoices.COMPLETED)
        if completed_appts.exists():
            for appt in completed_appts:
                assert hasattr(appt, "medical_record")
                assert Invoice.objects.filter(appointment=appt, status="paid").exists()
