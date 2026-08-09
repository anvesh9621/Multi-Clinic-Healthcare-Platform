import pytest
from datetime import timedelta
from django.utils import timezone
from django.test import TestCase
from apps.subscriptions.models import Subscription
from apps.subscriptions.tasks import process_subscription_dunning
from apps.core.factories import ClinicFactory, UserFactory
from apps.notifications.models import Notification


@pytest.mark.django_db
class TestSubscriptionDunningTask(TestCase):

    def _create_clinic_and_subscription(self, status='past_due', payment_failed_at=None, grace_period_end=None, dunning_stage='none'):
        clinic = ClinicFactory()
        admin_user = UserFactory(clinic=clinic, role='CLINIC_ADMIN')
        sub, _ = Subscription.objects.get_or_create(clinic=clinic)
        sub.status = status
        sub.payment_failed_at = payment_failed_at
        sub.grace_period_end = grace_period_end
        sub.dunning_stage = dunning_stage
        sub.save()
        return clinic, admin_user, sub

    def test_dunning_day_1_transition_and_notification(self):
        now = timezone.now()
        clinic, admin_user, sub = self._create_clinic_and_subscription(
            status='past_due',
            payment_failed_at=now - timedelta(days=1, hours=2),
            grace_period_end=now + timedelta(days=6),
            dunning_stage='none'
        )

        process_subscription_dunning()
        sub.refresh_from_db()

        assert sub.dunning_stage == 'day_1'
        assert Notification.objects.filter(recipient=admin_user, title__icontains="Payment issue").exists()

    def test_dunning_progressive_advancement_to_day_3(self):
        now = timezone.now()
        clinic, admin_user, sub = self._create_clinic_and_subscription(
            status='past_due',
            payment_failed_at=now - timedelta(days=3, hours=2),
            grace_period_end=now + timedelta(days=4),
            dunning_stage='day_1'
        )

        process_subscription_dunning()
        sub.refresh_from_db()

        assert sub.dunning_stage == 'day_3'
        assert Notification.objects.filter(recipient=admin_user, title__icontains="Action needed").exists()

    def test_dunning_does_not_retrigger_already_completed_stage(self):
        now = timezone.now()
        clinic, admin_user, sub = self._create_clinic_and_subscription(
            status='past_due',
            payment_failed_at=now - timedelta(days=3, hours=2),
            grace_period_end=now + timedelta(days=4),
            dunning_stage='day_3'
        )

        process_subscription_dunning()
        sub.refresh_from_db()

        assert sub.dunning_stage == 'day_3'

    def test_dunning_day_7_final_transitions_to_halted_when_grace_period_expired(self):
        now = timezone.now()
        clinic, admin_user, sub = self._create_clinic_and_subscription(
            status='past_due',
            payment_failed_at=now - timedelta(days=8),
            grace_period_end=now - timedelta(hours=1),
            dunning_stage='day_5'
        )

        process_subscription_dunning()
        sub.refresh_from_db()

        assert sub.dunning_stage == 'day_7_final'
        assert sub.status == 'halted'
        assert Notification.objects.filter(recipient=admin_user, title__icontains="Final notice").exists()
