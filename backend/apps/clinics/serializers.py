from rest_framework import serializers
from apps.accounts.models import User

class ReceptionistSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'created_at']
        
class ReceptionistCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def create(self, validated_data):
        request = self.context["request"]
        clinic = request.user.clinic

        # Create Receptionist User
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            role=User.RoleChoices.RECEPTIONIST,
            clinic=clinic
        )

        return user

class ClinicRegistrationSerializer(serializers.Serializer):
    clinic_name = serializers.CharField(max_length=255)
    clinic_address = serializers.CharField()
    admin_email = serializers.EmailField()
    admin_password = serializers.CharField(write_only=True)
    admin_first_name = serializers.CharField(max_length=150)
    admin_last_name = serializers.CharField(max_length=150)
    subscription_plan = serializers.CharField(max_length=20, required=False, default="BASIC")

    def validate_admin_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        from .models import Clinic
        from django.db import transaction

        with transaction.atomic():
            # Create Clinic
            clinic = Clinic.objects.create(
                name=validated_data["clinic_name"],
                address=validated_data["clinic_address"],
                subscription_plan=validated_data.get("subscription_plan", "BASIC")
            )

            # Create Clinic Admin User
            user = User.objects.create_user(
                email=validated_data["admin_email"],
                password=validated_data["admin_password"],
                first_name=validated_data["admin_first_name"],
                last_name=validated_data["admin_last_name"],
                role=User.RoleChoices.CLINIC_ADMIN,
                clinic=clinic
            )

            return {
                "clinic": clinic,
                "admin": user
            }

class SuperAdminClinicCreateSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import Clinic
        model = Clinic
        fields = ['id', 'name', 'address', 'subscription_plan']
