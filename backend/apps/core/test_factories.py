import pytest
from apps.core.factories import (
    ClinicFactory,
    SubscriptionFactory,
    UserFactory,
    PatientFactory,
    DoctorFactory,
    ReceptionistFactory,
    ClinicAdminFactory,
    SuperAdminFactory,
    DoctorClinicFactory,
    PatientProfileFactory,
    AppointmentFactory,
)
from apps.accounts.models import User


@pytest.mark.django_db
class TestCoreFactories:
    def test_clinic_factory(self):
        clinic = ClinicFactory()
        assert clinic.id is not None
        assert "Clinic" in clinic.name

    def test_subscription_factory(self):
        subscription = SubscriptionFactory()
        assert subscription.id is not None
        assert subscription.status == "active"
        assert subscription.clinic is not None

    def test_user_roles(self):
        patient_user = PatientFactory()
        assert patient_user.role == User.RoleChoices.PATIENT
        assert hasattr(patient_user, "patient_profile")

        doctor_user = DoctorFactory()
        assert doctor_user.role == User.RoleChoices.DOCTOR
        assert hasattr(doctor_user, "doctor_profile")

        receptionist = ReceptionistFactory()
        assert receptionist.role == User.RoleChoices.RECEPTIONIST
        assert receptionist.clinic is not None

        clinic_admin = ClinicAdminFactory()
        assert clinic_admin.role == User.RoleChoices.CLINIC_ADMIN
        assert clinic_admin.clinic is not None

        super_admin = SuperAdminFactory()
        assert super_admin.role == User.RoleChoices.SUPER_ADMIN
        assert super_admin.is_staff is True
        assert super_admin.is_superuser is True

    def test_doctor_clinic_factory(self):
        dc = DoctorClinicFactory()
        assert dc.id is not None
        assert dc.doctor is not None
        assert dc.clinic is not None

    def test_appointment_factory(self):
        appointment = AppointmentFactory()
        assert appointment.id is not None
        assert appointment.clinic is not None
        assert appointment.doctor_clinic is not None
        assert appointment.patient is not None
