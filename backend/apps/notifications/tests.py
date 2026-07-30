from django.test import TestCase
from rest_framework.test import APIClient
from apps.core.factories import UserFactory
from apps.notifications.models import Notification


class NotificationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = UserFactory()
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
            message='Another test notification.'
        )
        response = self.client.post('/api/notifications/mark-all-read/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Notification.objects.filter(recipient=self.user, is_read=False).count(), 0)
