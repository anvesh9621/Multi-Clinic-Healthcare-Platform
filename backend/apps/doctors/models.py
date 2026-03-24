from django.db import models
from django.utils import timezone
import uuid
from datetime import timedelta


class Doctor(models.Model):
    """Full doctor profile. One doctor can be associated with multiple clinics."""

    user = models.OneToOneField(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="doctor_profile"
    )

    # Core profile (required on creation)
    specialization = models.CharField(max_length=255)

    # Extended profile (filled by the doctor later)
    experience_years = models.PositiveIntegerField(default=0)
    qualifications = models.TextField(blank=True, help_text="e.g. MBBS, MD, DNB")
    about = models.TextField(blank=True, help_text="Long-form bio shown on public profile")
    languages_spoken = models.JSONField(default=list, blank=True, help_text="Array of language strings")
    education = models.JSONField(default=list, blank=True, help_text="Array of {degree, institution, year}")
    profile_photo = models.ImageField(upload_to="doctor_photos/", null=True, blank=True)

    # Legacy – kept for backwards compat
    bio = models.TextField(blank=True, null=True)

    is_verified = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Dr. {self.user.get_full_name() or self.user.email}"


class DoctorClinic(models.Model):
    """Bridge table linking a Doctor to a Clinic. Holds clinic-specific data."""

    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.CASCADE,
        related_name="clinic_associations"
    )
    clinic = models.ForeignKey(
        "clinics.Clinic",
        on_delete=models.CASCADE,
        related_name="doctor_associations"
    )
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2, default=500)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("doctor", "clinic")

    def __str__(self):
        return f"{self.doctor} @ {self.clinic.name}"


class DoctorSchedule(models.Model):
    """Weekly recurring schedule for a doctor at a specific clinic."""

    doctor_clinic = models.ForeignKey(
        DoctorClinic,
        on_delete=models.CASCADE,
        related_name="schedules"
    )
    day_of_week = models.IntegerField()  # 0=Monday … 6=Sunday
    start_time = models.TimeField()
    end_time = models.TimeField()
    slot_duration = models.IntegerField()  # minutes

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.doctor_clinic} - Day {self.day_of_week}"


class DoctorLeave(models.Model):
    """Time off or leaves requested by a doctor."""

    doctor_clinic = models.ForeignKey(
        DoctorClinic,
        on_delete=models.CASCADE,
        related_name="leaves"
    )
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField(blank=True, null=True, help_text="Reason for time off (optional)")

    def __str__(self):
        return f"{self.doctor_clinic} leave: {self.start_date} to {self.end_date}"


class DoctorInvitation(models.Model):
    """
    Invitation to join a clinic as a Doctor.
    The doctor must finish setting up their profile to convert this.
    """
    STATUS_CHOICES = (
        ("PENDING", "Pending"),
        ("ACCEPTED", "Accepted"),
        ("EXPIRED", "Expired"),
        ("CANCELLED", "Cancelled"),
    )

    clinic = models.ForeignKey(
        "clinics.Clinic",
        on_delete=models.CASCADE,
        related_name="doctor_invitations"
    )
    email = models.EmailField()
    specialization = models.CharField(max_length=255)
    
    token = models.CharField(max_length=64, default=uuid.uuid4, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        # Avoid spamming the same email if one is already pending
        unique_together = ("clinic", "email", "status")

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=48)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        return self.status == "PENDING" and self.expires_at > timezone.now()

    def __str__(self):
        return f"Invite: {self.email} to {self.clinic.name} ({self.status})"


class DoctorReview(models.Model):
    """Review and rating left by a patient for a doctor."""
    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.CASCADE,
        related_name="reviews"
    )
    patient = models.ForeignKey(
        "patients.Patient",
        on_delete=models.CASCADE,
        related_name="doctor_reviews"
    )
    appointment = models.ForeignKey(
        "appointments.Appointment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="doctor_reviews",
        help_text="Optional link to the specific visit"
    )
    rating = models.PositiveIntegerField(
        help_text="Rating from 1 to 5"
    )
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("doctor", "patient", "appointment")
        ordering = ["-created_at"]

    def __str__(self):
        return f"Review for {self.doctor} by {self.patient} - {self.rating} stars"

