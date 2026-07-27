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
from .models import ClinicAdminInvitation


class ClinicAdminInvitationSerializer(serializers.ModelSerializer):
    clinic_name = serializers.CharField(source="clinic.name", read_only=True)

    class Meta:
        model = ClinicAdminInvitation
        fields = ["id", "clinic_name", "email", "status", "created_at", "expires_at"]
        read_only_fields = ["id", "clinic_name", "status", "created_at", "expires_at"]


class ClinicAdminCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    clinic_id = serializers.PrimaryKeyRelatedField(
        queryset=Clinic.objects.all(),
        source="clinic"
    )

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate_clinic_id(self, value):
        if User.objects.filter(clinic=value, role=User.RoleChoices.CLINIC_ADMIN).exists():
            raise serializers.ValidationError("This clinic already has a Clinic Admin assigned.")
        return value

    def create(self, validated_data):
        import django.core.mail as mail
        from django.conf import settings

        clinic = validated_data["clinic"]
        email = validated_data["email"]

        # Cancel any existing pending invitation for this email/clinic
        ClinicAdminInvitation.objects.filter(clinic=clinic, email=email, status="PENDING").update(status="CANCELLED")

        invite = ClinicAdminInvitation.objects.create(
            clinic=clinic,
            email=email
        )

        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
        invite_url = f"{frontend_url}/admin/invite/{invite.token}"

        print("\n" + "=" * 80, flush=True)
        print(f"CLINIC ADMIN INVITE LINK GENERATED FOR: {invite.email}", flush=True)
        print(f"LINK: {invite_url}", flush=True)
        print("=" * 80 + "\n", flush=True)

        mail.send_mail(
            subject=f"You're invited to manage {clinic.name} as Clinic Admin",
            message=(
                f"Hello,\n\n"
                f"You have been invited to manage {clinic.name} as Clinic Admin on MediClinic.\n"
                f"Click the link below to set your password and accept your invitation:\n\n"
                f"{invite_url}\n\n"
                f"This link will expire in 48 hours.\n\n"
                f"— MediClinic Team"
            ),
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@mediclinic.com"),
            recipient_list=[invite.email],
        )

        return invite


class ClinicAdminAcceptInviteSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True, default="")
    last_name = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_token(self, value):
        try:
            invite = ClinicAdminInvitation.objects.get(token=value)
            if not invite.is_valid:
                raise serializers.ValidationError("This invitation has expired or has already been used.")
            return value
        except ClinicAdminInvitation.DoesNotExist:
            raise serializers.ValidationError("Invalid invitation token.")

    def save(self):
        from django.db import transaction

        token = self.validated_data["token"]

        with transaction.atomic():
            invite = ClinicAdminInvitation.objects.get(token=token)

            user = User.objects.filter(email=invite.email).first()
            if user:
                raise serializers.ValidationError(
                    "This email is already registered to an existing account. "
                    "Please contact support if you believe this is an error."
                )

            user = User.objects.create_user(
                email=invite.email,
                password=self.validated_data["password"],
                role=User.RoleChoices.CLINIC_ADMIN,
                clinic=invite.clinic,
                first_name=self.validated_data.get("first_name", ""),
                last_name=self.validated_data.get("last_name", ""),
            )

            invite.status = "ACCEPTED"
            invite.save()

        return user
