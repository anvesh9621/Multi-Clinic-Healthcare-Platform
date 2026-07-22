from django.db import models
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import RangeOperators
from django.contrib.postgres.fields import DateTimeRangeField
from django.db.models import F


class Appointment(models.Model):

    class StatusChoices(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Scheduled"
        CONFIRMED = "CONFIRMED", "Confirmed"
        WAITING = "WAITING", "Waiting in Clinic"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"
        NO_SHOW = "NO_SHOW", "No Show"

    clinic = models.ForeignKey(
        "clinics.Clinic",
        on_delete=models.CASCADE,
        related_name="appointments"
    )

    doctor_clinic = models.ForeignKey(
        "doctors.DoctorClinic",
        on_delete=models.CASCADE,
        related_name="appointments"
    )

    patient = models.ForeignKey(
        "patients.Patient",
        on_delete=models.CASCADE,
        related_name="appointments"
    )

    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_appointments"
    )

    appointment_date = models.DateField()

    start_time = models.TimeField()
    end_time = models.TimeField()

    # This is the authoritative field for overlap prevention
    time_range = DateTimeRangeField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.SCHEDULED
    )

    reason = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    queue_token = models.CharField(max_length=20, blank=True, null=True)
    
    payment_flow = models.CharField(
        max_length=20,
        choices=[
            ('not_applicable', 'Not Applicable'),
            ('pay_now', 'Pay Now'),
            ('pay_at_clinic', 'Pay at Clinic'),
        ],
        default='not_applicable'
    )
    
    follow_up_date = models.DateField(blank=True, null=True, help_text="Suggested follow-up date by doctor")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["appointment_date"]),
            models.Index(fields=["clinic"]),
            models.Index(fields=["doctor_clinic"]),
            models.Index(fields=["status"]),
        ]
        
        unique_together = ("clinic", "appointment_date", "queue_token")

        constraints = [
            ExclusionConstraint(
                name="prevent_overlapping_appointments",
                expressions=[
                    ("doctor_clinic", RangeOperators.EQUAL),
                    ("time_range", RangeOperators.OVERLAPS),
                ],
                condition=models.Q(status__in=["SCHEDULED", "CONFIRMED", "WAITING", "IN_PROGRESS"])
            )
        ]

    def __str__(self):
        return f"{self.patient} - {self.appointment_date} - {self.start_time}"

    def save(self, *args, **kwargs):
        if not self.queue_token:
            import random, string
            max_retries = 10
            for _ in range(max_retries):
                letters = ''.join(random.choices(string.ascii_uppercase, k=1))
                numbers = ''.join(random.choices(string.digits, k=3))
                candidate_token = f"{letters}-{numbers}"
                
                # Check if this token is already used in this clinic on this date
                exists = Appointment.objects.filter(
                    clinic=self.clinic,
                    appointment_date=self.appointment_date,
                    queue_token=candidate_token
                ).exists()
                
                if not exists:
                    self.queue_token = candidate_token
                    break
            else:
                # If we somehow loop 10 times without a unique token
                raise ValueError("Could not generate a unique queue token. Please try again.")

        super().save(*args, **kwargs)