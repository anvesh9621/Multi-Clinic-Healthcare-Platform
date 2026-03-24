from apps.doctors.serializers import BulkDoctorInviteSerializer
from apps.accounts.models import User

user = User.objects.filter(role='CLINIC_ADMIN').first()
class DummyRequest: pass
req = DummyRequest()
req.user = user
req.META = {'REMOTE_ADDR': '127.0.0.1'}
data = {'emails': ['test_print_output3@gmail.com'], 'specialization': 'Cardiology'}
serializer = BulkDoctorInviteSerializer(data=data, context={'request': req})
print('Valid:', serializer.is_valid())
try:
    serializer.save()
    print("Save Success")
except Exception as e:
    print("Error during save:", e)
