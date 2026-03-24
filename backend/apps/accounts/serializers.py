from rest_framework import serializers
from .models import User


class MeSerializer(serializers.ModelSerializer):
    clinic_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "role", "first_name", "last_name", "gender", "clinic_id"]

    def get_clinic_id(self, obj):
        return obj.clinic.id if obj.clinic else None


