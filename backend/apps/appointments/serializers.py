# pyre-ignore-all-errors
from rest_framework import serializers
from .models import Appointment

class AppointmentBookingSerializer(serializers.Serializer):
    doctor_clinic_id = serializers.IntegerField()
    appointment_date = serializers.DateField()
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    reason = serializers.CharField(required=False, allow_blank=True)
    # Telemedicine
    is_virtual = serializers.BooleanField(default=False, required=False)
    meeting_provider = serializers.ChoiceField(
        choices=Appointment.MeetingProvider.choices,
        required=False,
        allow_null=True,
        allow_blank=True,
    )

class ReceptionistAppointmentBookingSerializer(AppointmentBookingSerializer):
    patient_id = serializers.IntegerField()

class AppointmentRescheduleSerializer(serializers.Serializer):
    appointment_date = serializers.DateField()
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    reason = serializers.CharField(required=False, allow_blank=True)

class RunningLateSerializer(serializers.Serializer):
    delay_minutes = serializers.IntegerField(default=30, min_value=5, max_value=240)

class AppointmentListSerializer(serializers.ModelSerializer):
    doctor_name = serializers.SerializerMethodField()
    doctor_first_name = serializers.CharField(source="doctor_clinic.doctor.user.first_name", read_only=True)
    doctor_last_name = serializers.CharField(source="doctor_clinic.doctor.user.last_name", read_only=True)
    patient_email = serializers.CharField(source="patient.user.email", read_only=True)
    patient_name = serializers.SerializerMethodField()

    def get_doctor_name(self, obj):
        user = obj.doctor_clinic.doctor.user
        return f"Dr. {user.first_name} {user.last_name}".strip() or user.email

    def get_patient_name(self, obj):
        u = obj.patient.user
        full = f"{u.first_name or ''} {u.last_name or ''}".strip()
        return full or u.email

    class Meta:
        model = Appointment
        fields = [
            "id",
            "clinic",
            "doctor_name",
            "doctor_first_name",
            "doctor_last_name",
            "patient",  # Add the patient ID
            "patient_email",
            "patient_name",
            "appointment_date",
            "start_time",
            "end_time",
            "status",
            "reason",
            "queue_token",
            # Telemedicine
            "is_virtual",
            "meeting_provider",
            "meeting_link",
        ]

class AppointmentStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=Appointment.StatusChoices.choices
    )
    follow_up_date = serializers.DateField(required=False, allow_null=True)
