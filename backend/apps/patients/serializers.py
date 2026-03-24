from rest_framework import serializers
from .models import Patient, IntakeForm
from apps.accounts.models import User


class PatientRegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    phone = serializers.CharField(max_length=15)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True)
    emergency_contact = serializers.CharField(max_length=15, required=False, allow_blank=True)


class PublicPatientRegistrationSerializer(serializers.Serializer):
    """Used for public self-registration — no clinic required."""
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=15)
    password = serializers.CharField(write_only=True, min_length=8)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.ChoiceField(
        choices=User.GenderChoices.choices,
        required=False,
        allow_blank=True,
        allow_null=True
    )

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value


class PatientListSerializer(serializers.ModelSerializer):
    email = serializers.CharField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    gender = serializers.CharField(source='user.gender', read_only=True)

    class Meta:
        model = Patient
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'gender',
            'phone',
            'date_of_birth',
            'address',
            'emergency_contact',
            'blood_group',
            'allergies',
            'current_medications',
            'profile_completed',
            'created_at',
        ]


class PatientProfileSerializer(serializers.ModelSerializer):
    """Full read-only view of a patient's profile including medical fields."""
    email = serializers.CharField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    gender = serializers.CharField(source='user.gender', read_only=True)

    class Meta:
        model = Patient
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'gender',
            'phone',
            'date_of_birth',
            'address',
            'emergency_contact',
            'blood_group',
            'allergies',
            'current_medications',
            'profile_completed',
            'created_at',
        ]


class PatientProfileUpdateSerializer(serializers.ModelSerializer):
    """Used by the patient to update their own medical profile."""
    # Allow updating name & gender from the User model
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    gender = serializers.ChoiceField(
        choices=User.GenderChoices.choices,
        required=False,
        allow_blank=True,
        allow_null=True
    )

    class Meta:
        model = Patient
        fields = [
            'first_name',
            'last_name',
            'gender',
            'phone',
            'date_of_birth',
            'address',
            'emergency_contact',
            'blood_group',
            'allergies',
            'current_medications',
        ]

    def update(self, instance, validated_data):
        # Pull out User-level fields
        first_name = validated_data.pop('first_name', None)
        last_name = validated_data.pop('last_name', None)
        gender = validated_data.pop('gender', None)

        # Update User model
        user = instance.user
        if first_name is not None:
            user.first_name = first_name
        if last_name is not None:
            user.last_name = last_name
        if gender is not None:
            user.gender = gender
        user.save()

        # Update Patient model fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Mark profile as completed if all key medical fields are filled
        if instance.blood_group and instance.phone:
            instance.profile_completed = True

        instance.save()
        return instance

class IntakeFormSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntakeForm
        fields = [
            'id',
            'patient',
            'appointment',
            'allergies_update',
            'current_medications_update',
            'medical_history_notes',
            'signature_provided',
            'is_completed',
            'completed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'patient', 'appointment', 'is_completed', 'completed_at', 'created_at', 'updated_at']

class IntakeFormUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntakeForm
        fields = [
            'allergies_update',
            'current_medications_update',
            'medical_history_notes',
            'signature_provided',
        ]

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        if instance.signature_provided:
            instance.is_completed = True
            from django.utils import timezone
            if not instance.completed_at:
                instance.completed_at = timezone.now()
                
            # If the user provides allergies/medications here, optionally update their main profile
            if instance.allergies_update:
                instance.patient.allergies = instance.allergies_update
            if instance.current_medications_update:
                instance.patient.current_medications = instance.current_medications_update
            instance.patient.save()

        instance.save()
        return instance
