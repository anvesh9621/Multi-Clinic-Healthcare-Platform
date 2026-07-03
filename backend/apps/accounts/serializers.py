from rest_framework import serializers
from .models import User


class MeSerializer(serializers.ModelSerializer):
    clinic_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "role", "first_name", "last_name", "gender", "clinic_id"]

    def get_clinic_id(self, obj):
        return obj.clinic.id if obj.clinic else None


from apps.clinics.models import Clinic
from django.contrib.auth.password_validation import validate_password

class ClinicAdminCreateSerializer(serializers.ModelSerializer):
    clinic_id = serializers.PrimaryKeyRelatedField(
        queryset=Clinic.objects.all(),
        source="clinic",
        write_only=True
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password]
    )

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "password", "clinic_id"]

    def validate_clinic_id(self, value):
        if User.objects.filter(clinic=value, role=User.RoleChoices.CLINIC_ADMIN).exists():
            raise serializers.ValidationError("This clinic already has a Clinic Admin assigned.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            role=User.RoleChoices.CLINIC_ADMIN,
            clinic=validated_data["clinic"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", "")
        )
        return user
