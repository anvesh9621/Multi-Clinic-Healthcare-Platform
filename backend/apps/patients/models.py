from django.db import models


class Patient(models.Model):

    class BloodGroupChoices(models.TextChoices):
        A_POS  = "A+",  "A+"
        A_NEG  = "A-",  "A-"
        B_POS  = "B+",  "B+"
        B_NEG  = "B-",  "B-"
        AB_POS = "AB+", "AB+"
        AB_NEG = "AB-", "AB-"
        O_POS  = "O+",  "O+"
        O_NEG  = "O-",  "O-"

    user = models.OneToOneField(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="patient_profile"
    )

    phone = models.CharField(max_length=15)

    date_of_birth = models.DateField(null=True, blank=True)

    address = models.TextField(blank=True, null=True)

    emergency_contact = models.CharField(max_length=15, blank=True, null=True)

    # Medical Profile Fields
    blood_group = models.CharField(
        max_length=5,
        choices=BloodGroupChoices.choices,
        blank=True,
        null=True
    )

    allergies = models.TextField(
        blank=True,
        null=True,
        help_text="Comma-separated list of known allergies"
    )

    current_medications = models.TextField(
        blank=True,
        null=True,
        help_text="Comma-separated list of current medications"
    )

    profile_completed = models.BooleanField(
        default=False,
        help_text="True once the patient has filled in their medical profile"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.user.email

class IntakeForm(models.Model):
    patient = models.ForeignKey(
        "patients.Patient",
        on_delete=models.CASCADE,
        related_name="intake_forms"
    )
    appointment = models.OneToOneField(
        "appointments.Appointment",
        on_delete=models.CASCADE,
        related_name="intake_form"
    )
    
    allergies_update = models.TextField(blank=True, null=True, help_text="Patient reported allergies")
    current_medications_update = models.TextField(blank=True, null=True, help_text="Patient reported medications")
    medical_history_notes = models.TextField(blank=True, null=True)
    
    signature_provided = models.BooleanField(default=False)
    is_completed = models.BooleanField(default=False)
    
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Intake Form for {self.patient} - {self.appointment.appointment_date}"