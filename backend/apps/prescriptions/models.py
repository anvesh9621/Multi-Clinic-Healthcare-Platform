from django.db import models


class Prescription(models.Model):

    medical_record = models.ForeignKey(
        "records.MedicalRecord",
        on_delete=models.CASCADE,
        related_name="prescriptions"
    )

    medication_name = models.CharField(max_length=255)

    dosage = models.CharField(max_length=100)

    instructions = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.medication_name