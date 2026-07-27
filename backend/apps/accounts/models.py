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

        email = self.normalize_email(email.strip()).lower()

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
    expires_at = models.DateTimeField()

    def save(self, *args, **kwargs):
        if not self.expires_at:
            from django.utils import timezone
            from datetime import timedelta
            self.expires_at = timezone.now() + timedelta(hours=48)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        from django.utils import timezone
        return not self.is_used and self.expires_at > timezone.now()

    def __str__(self):
        return f"Invite for {self.user.email} ({'used' if self.is_used else 'pending'})"


class ClinicAdminInvitation(models.Model):
    STATUS_CHOICES = (
        ("PENDING", "Pending"),
        ("ACCEPTED", "Accepted"),
        ("EXPIRED", "Expired"),
        ("CANCELLED", "Cancelled"),
    )

    clinic = models.ForeignKey(
        "clinics.Clinic",
        on_delete=models.CASCADE,
        related_name="admin_invitations"
    )
    email = models.EmailField()
    token = models.CharField(max_length=64, default=uuid.uuid4, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        unique_together = ("clinic", "email", "status")

    def save(self, *args, **kwargs):
        if not self.expires_at:
            from django.utils import timezone
            from datetime import timedelta
            self.expires_at = timezone.now() + timedelta(hours=48)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        from django.utils import timezone
        return self.status == "PENDING" and self.expires_at > timezone.now()

    def __str__(self):
        return f"Clinic Admin Invite: {self.email} to {self.clinic.name} ({self.status})"


class EmailOTP(models.Model):
    PURPOSE_CHOICES = [
        ("REGISTER", "Registration"),
        ("LOGIN", "Login"),
    ]

    user_email = models.EmailField()
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    is_used = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            from django.utils import timezone
            from datetime import timedelta
            self.expires_at = timezone.now() + timedelta(minutes=10)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        from django.utils import timezone
        return not self.is_used and self.attempts < 5 and self.expires_at > timezone.now()

    def __str__(self):
        return f"OTP for {self.user_email} ({self.purpose}): {self.code}"


class StaffMFA(models.Model):
    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="mfa")
    secret = models.CharField(max_length=32)
    is_enabled = models.BooleanField(default=False)
    backup_codes = models.JSONField(default=list)  # hashed, never plaintext
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"MFA for {self.user.email} ({'enabled' if self.is_enabled else 'pending'})"
