# pyre-ignore-all-errors
from rest_framework import serializers
from apps.accounts.models import User
from .models import DoctorClinic, Doctor, DoctorSchedule, DoctorLeave, DoctorInvitation
from apps.clinics.models import Clinic


class ClinicListSerializer(serializers.ModelSerializer):
    doctor_count = serializers.SerializerMethodField()

    class Meta:
        model = Clinic
        fields = ['id', 'name', 'address', 'is_active', 'doctor_count', 'latitude', 'longitude']

    def get_doctor_count(self, obj):
        return DoctorClinic.objects.filter(clinic=obj).count()


class DoctorClinicSerializer(serializers.ModelSerializer):
    doctor_email = serializers.CharField(source="doctor.user.email")
    first_name = serializers.CharField(source="doctor.user.first_name")
    last_name = serializers.CharField(source="doctor.user.last_name")
    specialization = serializers.CharField(source="doctor.specialization")
    experience_years = serializers.IntegerField(source="doctor.experience_years")
    qualifications = serializers.CharField(source="doctor.qualifications", default="")
    about = serializers.CharField(source="doctor.about", default="")
    languages_spoken = serializers.ListField(source="doctor.languages_spoken", child=serializers.CharField(), default=list)
    profile_photo = serializers.ImageField(source="doctor.profile_photo", default=None)
    clinic_id = serializers.IntegerField(source="clinic.id")
    clinic_name = serializers.CharField(source="clinic.name")

    class Meta:
        model = DoctorClinic
        fields = [
            "id", "doctor_email", "first_name", "last_name",
            "specialization", "experience_years", "qualifications", "about",
            "languages_spoken", "profile_photo", "consultation_fee",
            "clinic_id", "clinic_name",
        ]


class DoctorDetailSerializer(serializers.ModelSerializer):
    """Full doctor profile — used for the doctor's own profile view."""
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    doctor_clinic_id = serializers.SerializerMethodField()
    consultation_fee = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

    class Meta:
        model = Doctor
        fields = [
            "id", "email", "first_name", "last_name",
            "specialization", "experience_years", "qualifications",
            "about", "languages_spoken", "education",
            "profile_photo", "is_verified",
            "doctor_clinic_id", "consultation_fee",
            "average_rating", "review_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "email", "first_name", "last_name", "is_verified", "created_at", "updated_at"]

    def get_doctor_clinic_id(self, obj):
        dc = obj.clinic_associations.first()
        return dc.id if dc else None

    def get_consultation_fee(self, obj):
        dc = obj.clinic_associations.first()
        return float(dc.consultation_fee) if dc else None

    def get_average_rating(self, obj):
        from django.db.models import Avg
        avg = obj.reviews.aggregate(Avg('rating'))['rating__avg']
        return round(float(avg), 1) if avg else 0.0

    def get_review_count(self, obj):
        return obj.reviews.count()


class DoctorProfileUpdateSerializer(serializers.Serializer):
    """Doctor updating their own profile. Includes both User and Doctor fields."""
    first_name = serializers.CharField(required=False)
    last_name = serializers.CharField(required=False)
    specialization = serializers.CharField(required=False)
    experience_years = serializers.IntegerField(required=False, min_value=0)
    qualifications = serializers.CharField(required=False, allow_blank=True)
    about = serializers.CharField(required=False, allow_blank=True)
    languages_spoken = serializers.ListField(child=serializers.CharField(), required=False)
    education = serializers.ListField(child=serializers.DictField(), required=False)
    consultation_fee = serializers.DecimalField(required=False, max_digits=10, decimal_places=2)

    def update(self, doctor, validated_data):
        user = doctor.user
        user.first_name = validated_data.get("first_name", user.first_name)
        user.last_name = validated_data.get("last_name", user.last_name)
        user.save()

        doctor.specialization = validated_data.get("specialization", doctor.specialization)
        doctor.experience_years = validated_data.get("experience_years", doctor.experience_years)
        doctor.qualifications = validated_data.get("qualifications", doctor.qualifications)
        doctor.about = validated_data.get("about", doctor.about)
        doctor.languages_spoken = validated_data.get("languages_spoken", doctor.languages_spoken)
        doctor.education = validated_data.get("education", doctor.education)
        doctor.save()

        consultation_fee = validated_data.get("consultation_fee")
        if consultation_fee is not None:
            dc = doctor.clinic_associations.first()
            if dc:
                dc.consultation_fee = consultation_fee
                dc.save()

        return doctor


class DoctorScheduleSerializer(serializers.ModelSerializer):
    doctor_clinic_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = DoctorSchedule
        fields = ["id", "doctor_clinic_id", "day_of_week", "start_time", "end_time", "slot_duration"]

    def create(self, validated_data):
        doctor_clinic = DoctorClinic.objects.get(id=validated_data["doctor_clinic_id"])
        return DoctorSchedule.objects.create(
            doctor_clinic=doctor_clinic,
            day_of_week=validated_data["day_of_week"],
            start_time=validated_data["start_time"],
            end_time=validated_data["end_time"],
            slot_duration=validated_data["slot_duration"]
        )


class DoctorLeaveSerializer(serializers.ModelSerializer):
    doctor_clinic_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = DoctorLeave
        fields = ["id", "doctor_clinic_id", "start_date", "end_date", "reason"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        doctor_clinic = DoctorClinic.objects.get(id=validated_data["doctor_clinic_id"])
        return DoctorLeave.objects.create(
            doctor_clinic=doctor_clinic,
            start_date=validated_data["start_date"],
            end_date=validated_data["end_date"],
            reason=validated_data.get("reason", "")
        )


class DoctorInvitationSerializer(serializers.ModelSerializer):
    clinic_name = serializers.CharField(source="clinic.name", read_only=True)

    class Meta:
        model = DoctorInvitation
        fields = ["id", "clinic_name", "email", "specialization", "status", "created_at", "expires_at"]
        read_only_fields = ["id", "clinic_name", "status", "created_at", "expires_at"]


class BulkDoctorInviteSerializer(serializers.Serializer):
    """Used by Clinic Admin to send multiple invitations at once."""
    emails = serializers.ListField(child=serializers.EmailField(), min_length=1)
    specialization = serializers.CharField()

    def create(self, validated_data):
        import django.core.mail as mail
        from django.conf import settings

        request = self.context["request"]
        clinic = request.user.clinic
        emails = validated_data["emails"]
        specialization = validated_data["specialization"]

        invitations = []
        for email in emails:
            # Check if pending invite already exists
            invite = DoctorInvitation.objects.filter(clinic=clinic, email=email, status="PENDING").first()
            if not invite:
                invite = DoctorInvitation.objects.create(
                    clinic=clinic,
                    email=email,
                    specialization=specialization
                )
            # We append it either way so we can re-print/re-send the email
            invitations.append(invite)

        # Build invite URL (reads FRONTEND_URL from settings)
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
        
        for invite in invitations:
            invite_url = f"{frontend_url}/invite/{invite.token}"
            
            # Print to terminal for easy copying in development mode!
            print("\n" + "="*80, flush=True)
            print(f"CLINIC INVITE LINK GENERATED FOR: {invite.email}", flush=True)
            print(f"LINK: {invite_url}", flush=True)
            print("="*80 + "\n", flush=True)
            
            mail.send_mail(
                subject=f"You're invited to join {clinic.name}",
                message=(
                    f"Hello,\n\n"
                    f"You have been invited to join Mediclinic by {clinic.name}.\n"
                    f"Click the link below to create your doctor account:\n\n"
                    f"{invite_url}\n\n"
                    f"This link will expire in 48 hours.\n\n"
                    f"— MediClinic Team"
                ),
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@mediclinic.com"),
                recipient_list=[invite.email],
            )

        return invitations


class DoctorAcceptInviteSerializer(serializers.Serializer):
    """Used by Doctor to accept an invite and set up their full profile."""
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField()
    last_name = serializers.CharField(required=False, allow_blank=True, default="")
    phone = serializers.CharField(required=False, allow_blank=True, default="")
    
    # Doctor Profile
    specialization = serializers.CharField()
    experience_years = serializers.IntegerField(required=False, default=0, min_value=0)
    qualifications = serializers.CharField(required=False, allow_blank=True, default="")
    languages_spoken = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    bio = serializers.CharField(required=False, allow_blank=True, default="")
    education = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    
    # DoctorClinic Link
    consultation_fee = serializers.DecimalField(required=False, max_digits=10, decimal_places=2, default=500)

    def validate_token(self, value):
        try:
            invite = DoctorInvitation.objects.get(token=value)
            if not invite.is_valid:
                raise serializers.ValidationError("This invitation has expired or has already been used.")
            return value
        except DoctorInvitation.DoesNotExist:
            raise serializers.ValidationError("Invalid invitation token.")

    def save(self):
        token = self.validated_data["token"]
        invite = DoctorInvitation.objects.get(token=token)

        user = User.objects.create_user(
            email=invite.email,
            password=self.validated_data["password"],
            role="DOCTOR",
            clinic=invite.clinic,
            first_name=self.validated_data["first_name"],
            last_name=self.validated_data.get("last_name", "")
        )

        doctor = Doctor.objects.create(
            user=user,
            specialization=self.validated_data["specialization"],
            experience_years=self.validated_data.get("experience_years", 0),
            qualifications=self.validated_data.get("qualifications", ""),
            languages_spoken=self.validated_data.get("languages_spoken", []),
            about=self.validated_data.get("bio", ""),
            education=self.validated_data.get("education", [])
        )

        DoctorClinic.objects.create(
            doctor=doctor,
            clinic=invite.clinic,
            consultation_fee=self.validated_data.get("consultation_fee", 500)
        )

        invite.status = "ACCEPTED"
        invite.save()
        
        return user


class DoctorReviewSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.user.get_full_name", read_only=True)

    class Meta:
        from .models import DoctorReview
        model = DoctorReview
        fields = ["id", "doctor", "patient", "appointment", "rating", "comment", "created_at", "patient_name"]
        read_only_fields = ["id", "patient", "created_at", "patient_name"]

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return value
