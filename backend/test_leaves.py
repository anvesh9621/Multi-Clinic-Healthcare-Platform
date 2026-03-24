import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User
from rest_framework.test import APIClient
import traceback

def test_api():
    user = User.objects.filter(role="DOCTOR").first()
    if not user:
        print("No doctor user found")
        return
    client = APIClient(SERVER_NAME='localhost')
    client.force_authenticate(user=user)
    urls = ['/api/doctors/profile/']
    for url in urls:
        print(f"Testing {url}")
        import sys
        with open('stderr.txt', 'w') as f:
            old_err = sys.stderr
            sys.stderr = f
            resp = client.get(url, follow=True)
            sys.stderr = old_err
        print(f"Status: {resp.status_code}")
        print(f"Content: {resp.content}")

if __name__ == "__main__":
    test_api()
