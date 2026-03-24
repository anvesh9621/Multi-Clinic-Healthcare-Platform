# pyre-ignore-all-errors
from django.db import models
from apps.appointments.models import Appointment
from apps.patients.models import Patient
from apps.doctors.models import DoctorClinic

class MedicalRecord(models.Model):
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name="medical_record")
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="medical_records")
    doctor_clinic = models.ForeignKey(DoctorClinic, on_delete=models.CASCADE, related_name="medical_records")
    
    symptoms = models.TextField(blank=True)
    diagnosis = models.TextField(blank=True)
    doctor_notes = models.TextField(blank=True, help_text="Public notes visible to patient")
    private_notes = models.TextField(blank=True, help_text="Private notes visible only to doctors/staff")
    
    vitals_temperature = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="in Fahrenheit")
    vitals_blood_pressure = models.CharField(max_length=20, blank=True, help_text="e.g. 120/80")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Record for {self.patient.user.get_full_name()} on {self.created_at.date()}"


class Prescription(models.Model):
    medical_record = models.OneToOneField(MedicalRecord, on_delete=models.CASCADE, related_name="prescription")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Prescription for {self.medical_record.patient.user.get_full_name()} ({self.created_at.date()})"


class PrescriptionItem(models.Model):
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name="items")
    medicine_name = models.CharField(max_length=255)
    dosage = models.CharField(max_length=100)
    frequency = models.CharField(max_length=100)
    duration_days = models.IntegerField(help_text="Number of days")
    instructions = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.medicine_name} - {self.dosage}"


class PrescriptionTemplate(models.Model):
    doctor_clinic = models.ForeignKey(DoctorClinic, on_delete=models.CASCADE, related_name="prescription_templates")
    name = models.CharField(max_length=150, help_text="e.g., Viral Fever Kit")
    items = models.JSONField(help_text="Array of medicine objects: [{medicine_name, dosage, frequency, duration_days, instructions}]")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        unique_together = ('doctor_clinic', 'name')

    def __str__(self):
        return f"{self.name} (Dr. {self.doctor_clinic.doctor.user.get_full_name()})"