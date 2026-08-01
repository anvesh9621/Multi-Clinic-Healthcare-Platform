from rest_framework import serializers
from apps.accounts.models import User
from .models import ReceptionistInvitation, Clinic


class ReceptionistSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'created_at']


class ReceptionistInvitationSerializer(serializers.ModelSerializer):
    clinic_name = serializers.CharField(source="clinic.name", read_only=True)

    class Meta:
        model = ReceptionistInvitation
        fields = ["id", "clinic_name", "email", "status", "created_at", "expires_at"]
        read_only_fields = ["id", "clinic_name", "status", "created_at", "expires_at"]


class ReceptionistCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate(self, data):
        request = self.context["request"]
        clinic = getattr(request.user, "clinic", None)
        if not clinic:
            raise serializers.ValidationError("User does not belong to a clinic.")
        if User.objects.filter(clinic=clinic, role=User.RoleChoices.RECEPTIONIST).exists():
            raise serializers.ValidationError("This clinic already has a Receptionist assigned.")
        return data

    def create(self, validated_data):
        import django.core.mail as mail
        from django.conf import settings

        request = self.context["request"]
        clinic = request.user.clinic
        email = validated_data["email"]

        # Cancel any existing pending invitation for this email/clinic
        ReceptionistInvitation.objects.filter(clinic=clinic, email=email, status="PENDING").update(status="CANCELLED")

        invite = ReceptionistInvitation.objects.create(
            clinic=clinic,
            email=email
        )

        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
        invite_url = f"{frontend_url}/receptionist/invite/{invite.token}"

        print("\n" + "=" * 80, flush=True)
        print(f"RECEPTIONIST INVITE LINK GENERATED FOR: {invite.email}", flush=True)
        print(f"LINK: {invite_url}", flush=True)
        print("=" * 80 + "\n", flush=True)

        mail.send_mail(
            subject=f"You're invited to join {clinic.name} as Receptionist",
            message=(
                f"Hello,\n\n"
                f"You have been invited to join {clinic.name} as a Receptionist on MediClinic.\n"
                f"Click the link below to set your password and accept your invitation:\n\n"
                f"{invite_url}\n\n"
                f"This link will expire in 48 hours.\n\n"
                f"— MediClinic Team"
            ),
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@mediclinic.com"),
            recipient_list=[invite.email],
        )

        return invite


class ReceptionistAcceptInviteSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True, default="")
    last_name = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_token(self, value):
        try:
            invite = ReceptionistInvitation.objects.get(token=value)
            if not invite.is_valid:
                raise serializers.ValidationError("This invitation has expired or has already been used.")
            return value
        except ReceptionistInvitation.DoesNotExist:
            raise serializers.ValidationError("Invalid invitation token.")

    def save(self):
        from django.db import transaction

        token = self.validated_data["token"]

        with transaction.atomic():
            invite = ReceptionistInvitation.objects.get(token=token)

            user = User.objects.filter(email=invite.email).first()
            if user:
                raise serializers.ValidationError(
                    "This email is already registered to an existing account. "
                    "Please contact support if you believe this is an error."
                )

            user = User.objects.create_user(
                email=invite.email,
                password=self.validated_data["password"],
                role=User.RoleChoices.RECEPTIONIST,
                clinic=invite.clinic,
                first_name=self.validated_data.get("first_name", ""),
                last_name=self.validated_data.get("last_name", ""),
            )

            invite.status = "ACCEPTED"
            invite.save()

        return user


class ClinicRegistrationSerializer(serializers.Serializer):
    clinic_name = serializers.CharField(max_length=255)
    clinic_address = serializers.CharField()
    admin_email = serializers.EmailField()
    admin_password = serializers.CharField(write_only=True)
    admin_first_name = serializers.CharField(max_length=150)
    admin_last_name = serializers.CharField(max_length=150)

    def validate_admin_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        from django.db import transaction

        with transaction.atomic():
            clinic = Clinic.objects.create(
                name=validated_data["clinic_name"],
                address=validated_data["clinic_address"],
            )

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
        model = Clinic
        fields = ['id', 'name', 'address']
