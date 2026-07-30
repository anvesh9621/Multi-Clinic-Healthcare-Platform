import factory
from factory import SubFactory, LazyAttribute, Sequence
from datetime import date, time, timedelta

from apps.clinics.models import Clinic
from apps.accounts.models import User
from apps.patients.models import Patient
from apps.doctors.models import Doctor, DoctorClinic
from apps.subscriptions.models import Subscription
from apps.appointments.models import Appointment


class ClinicFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Clinic

    name = Sequence(lambda n: f"Clinic {n}")
    address = Sequence(lambda n: f"{n} Health St, Medical City")
    subscription_plan = "BASIC"


class SubscriptionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Subscription

    clinic = SubFactory(ClinicFactory)
    status = "active"
    plan = "starter"

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        clinic = kwargs.get('clinic')
        status = kwargs.get('status', 'active')
        plan = kwargs.get('plan', 'starter')
        if clinic and hasattr(clinic, 'subscription'):
            sub = clinic.subscription
            sub.status = status
            sub.plan = plan
            sub.save()
            return sub
        return super()._create(model_class, *args, **kwargs)


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = Sequence(lambda n: f"user{n}@example.com")
    first_name = Sequence(lambda n: f"FirstName{n}")
    last_name = Sequence(lambda n: f"LastName{n}")
    role = User.RoleChoices.PATIENT
    password = factory.PostGenerationMethodCall('set_password', 'password123')
    is_active = True
    is_staff = False
    is_superuser = False


class PatientFactory(UserFactory):
    role = User.RoleChoices.PATIENT

    @factory.post_generation
    def create_profile(self, create, extracted, **kwargs):
        if not create:
            return
        if not hasattr(self, 'patient_profile'):
            Patient.objects.get_or_create(
                user=self,
                defaults={'phone': kwargs.get('phone', '+919876543210')}
            )


class DoctorFactory(UserFactory):
    role = User.RoleChoices.DOCTOR

    @factory.post_generation
    def create_profile(self, create, extracted, **kwargs):
        if not create:
            return
        if not hasattr(self, 'doctor_profile'):
            Doctor.objects.get_or_create(
                user=self,
                defaults={'specialization': kwargs.get('specialization', 'General Medicine')}
            )


class ReceptionistFactory(UserFactory):
    role = User.RoleChoices.RECEPTIONIST
    clinic = SubFactory(ClinicFactory)


class ClinicAdminFactory(UserFactory):
    role = User.RoleChoices.CLINIC_ADMIN
    clinic = SubFactory(ClinicFactory)


class SuperAdminFactory(UserFactory):
    role = User.RoleChoices.SUPER_ADMIN
    is_staff = True
    is_superuser = True


class DoctorProfileFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Doctor
        django_get_or_create = ('user',)

    user = SubFactory(DoctorFactory)
    specialization = "General Medicine"


class DoctorClinicFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = DoctorClinic

    doctor = SubFactory(DoctorProfileFactory)
    clinic = SubFactory(ClinicFactory)
    consultation_fee = 500


class PatientProfileFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Patient
        django_get_or_create = ('user',)

    user = SubFactory(PatientFactory)
    phone = "+919876543210"


class AppointmentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Appointment

    doctor_clinic = SubFactory(DoctorClinicFactory)
    clinic = LazyAttribute(lambda o: o.doctor_clinic.clinic)
    patient = SubFactory(PatientProfileFactory)
    created_by = LazyAttribute(lambda o: o.patient.user)
    appointment_date = LazyAttribute(lambda o: date.today() + timedelta(days=1))
    start_time = time(10, 0)
    end_time = time(10, 30)
    status = Appointment.StatusChoices.SCHEDULED
