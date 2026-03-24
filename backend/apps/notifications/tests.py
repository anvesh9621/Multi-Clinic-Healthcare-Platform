from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.notifications.models import Notification

User = get_user_model()

class NotificationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email='test_user123@example.com', password='password123')
        self.client.force_authenticate(user=self.user)

        self.notification = Notification.objects.create(
            recipient=self.user,
            notification_type='SYSTEM',
            title='Test Alert',
            message='This is a test notification.'
        )

    def test_get_notifications(self):
        response = self.client.get('/api/notifications/')
        self.assertEqual(response.status_code, 200)
        # Assuming pagination isn't strictly altering the response structure, 
        # but if viewset returns a list directly or a paginated dict.
        # Usually standard GenericViewSet returns list if no pagination class is set globally.
        data = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['title'], 'Test Alert')
        self.assertFalse(data[0]['is_read'])

    def test_mark_read(self):
        response = self.client.patch(f'/api/notifications/{self.notification.id}/', {'is_read': True}, format='json')
        self.assertEqual(response.status_code, 200)
        self.notification.refresh_from_db()
        self.assertTrue(self.notification.is_read)

    def test_mark_all_read(self):
        Notification.objects.create(
            recipient=self.user,
            notification_type='SYSTEM',
            title='Test Alert 2',
            message='Another test.',
            is_read=False
        )
        response = self.client.post('/api/notifications/mark-all-read/')
        self.assertEqual(response.status_code, 200)
        
        unread = Notification.objects.filter(recipient=self.user, is_read=False).count()
        self.assertEqual(unread, 0)
