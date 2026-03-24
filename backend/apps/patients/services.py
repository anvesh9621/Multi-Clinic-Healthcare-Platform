from django.db import transaction
from apps.accounts.models import User
from .models import Patient

def register_patient(
    *,
    email,
    password,
    phone,
    clinic=None,
    first_name="",
    last_name="",
    gender=None,
    date_of_birth=None,
    address="",
    emergency_contact=""
):
    """
    Registers a new patient securely within a transaction.
    Creates both User and Patient models.
    clinic is optional — patients can self-register globally without a clinic.
    """
    with transaction.atomic():
        # Create user
        user = User.objects.create_user(
            email=email,
            password=password,
            role=User.RoleChoices.PATIENT,
            clinic=clinic,
            first_name=first_name,
            last_name=last_name,
            gender=gender,
        )

        # Create patient profile
        patient = Patient.objects.create(
            user=user,
            phone=phone,
            date_of_birth=date_of_birth,
            address=address,
            emergency_contact=emergency_contact
        )

    return patient
