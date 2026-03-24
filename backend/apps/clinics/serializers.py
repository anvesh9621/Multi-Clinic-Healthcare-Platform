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
