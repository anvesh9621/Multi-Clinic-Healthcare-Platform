# pyre-ignore-all-errors
from rest_framework import serializers
from .models import MedicalRecord, Prescription, PrescriptionItem, PrescriptionTemplate

class PrescriptionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionItem
        fields = ['id', 'medicine_name', 'dosage', 'frequency', 'duration_days', 'instructions']


class PrescriptionSerializer(serializers.ModelSerializer):
    items = PrescriptionItemSerializer(many=True)

    class Meta:
        model = Prescription
        fields = ['id', 'medical_record', 'items', 'created_at']
        read_only_fields = ['created_at']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        prescription = Prescription.objects.create(**validated_data)
        for item_data in items_data:
            PrescriptionItem.objects.create(prescription=prescription, **item_data)
        return prescription


class MedicalRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.user.get_full_name", read_only=True)
    doctor_name = serializers.CharField(source="doctor_clinic.doctor.user.get_full_name", read_only=True)
    doctor_id = serializers.IntegerField(source="doctor_clinic.doctor.id", read_only=True)
    prescriptions = PrescriptionSerializer(many=True, read_only=True, source='prescription_set')

    class Meta:
        model = MedicalRecord
        fields = [
            'id', 'appointment', 'patient', 'doctor_clinic', 'patient_name', 'doctor_name', 'doctor_id',
            'symptoms', 'diagnosis', 'doctor_notes', 'private_notes', 
            'vitals_temperature', 'vitals_blood_pressure', 'prescriptions', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class PrescriptionTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionTemplate
        fields = ['id', 'doctor_clinic', 'name', 'items', 'created_at']
        read_only_fields = ['created_at', 'doctor_clinic']