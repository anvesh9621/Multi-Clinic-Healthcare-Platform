# pyre-ignore-all-errors
from django.db import models
import uuid
from django.contrib.auth.models import (
    AbstractBaseUser,
    PermissionsMixin,
    BaseUserManager
)


class UserManager(BaseUserManager):

    def create_user(self, email, password=None, role=None, clinic=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")

        email = self.normalize_email(email)

        # Only staff roles require clinic (patients can register globally without a clinic)
        if role in [
            User.RoleChoices.CLINIC_ADMIN,
            User.RoleChoices.DOCTOR,
            User.RoleChoices.RECEPTIONIST,
        ] and clinic is None:
            raise ValueError("This role must belong to a clinic")

        user = self.model(
            email=email,
            role=role,
            clinic=clinic,
            **extra_fields
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        user = self.model(
            email=self.normalize_email(email),
            role=User.RoleChoices.SUPER_ADMIN,
            clinic=None,
            is_staff=True,
            is_superuser=True,
            **extra_fields
        )
        user.set_password(password)
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):

    class RoleChoices(models.TextChoices):
        SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
        CLINIC_ADMIN = "CLINIC_ADMIN", "Clinic Admin"
        DOCTOR = "DOCTOR", "Doctor"
        RECEPTIONIST = "RECEPTIONIST", "Receptionist"
        PATIENT = "PATIENT", "Patient"

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150, blank=True, default="")
    last_name = models.CharField(max_length=150, blank=True, default="")

    class GenderChoices(models.TextChoices):
        MALE = "MALE", "Male"
        FEMALE = "FEMALE", "Female"
        OTHER = "OTHER", "Other"

    gender = models.CharField(
        max_length=10,
        choices=GenderChoices.choices,
        blank=True,
        null=True
    )

    role = models.CharField(
        max_length=20,
        choices=RoleChoices.choices
    )

    clinic = models.ForeignKey(
        "clinics.Clinic",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="users"
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email

    def get_short_name(self):
        return self.first_name or self.email.split("@")[0]


class DoctorInviteToken(models.Model):
    """One-time token emailed to a doctor so they can set their password."""
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="invite_token"
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Invite for {self.user.email} ({'used' if self.is_used else 'pending'})"