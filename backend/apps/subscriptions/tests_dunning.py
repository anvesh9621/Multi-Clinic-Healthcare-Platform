import pytest
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.test import TestCase
from apps.subscriptions.models import Subscription, DunningRecoveryLog
from apps.subscriptions.tasks import process_subscription_dunning
from apps.billing.tasks import compute_daily_payment_metrics
from apps.billing.models import PaymentMetricSnapshot
from apps.billing.webhooks import handle_subscription_charged
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

    def test_dunning_day_1_and_idempotency(self):
        now = timezone.now()
        clinic, admin_user, sub = self._create_clinic_and_subscription(
            status='past_due',
            payment_failed_at=now - timedelta(days=1, hours=2),
            grace_period_end=now + timedelta(days=6),
            dunning_stage='none'
        )

        # First run: sets day_1 and sends notification
        process_subscription_dunning()
        sub.refresh_from_db()
        assert sub.dunning_stage == 'day_1'
        initial_notif_count = Notification.objects.filter(recipient=admin_user).count()
        assert initial_notif_count == 1

        # Second run on same day: target_index <= current_index -> does not re-send
        process_subscription_dunning()
        sub.refresh_from_db()
        assert sub.dunning_stage == 'day_1'
        assert Notification.objects.filter(recipient=admin_user).count() == initial_notif_count

    def test_dunning_sequential_progression(self):
        now = timezone.now()
        clinic, admin_user, sub = self._create_clinic_and_subscription(
            status='past_due',
            payment_failed_at=now - timedelta(days=1, hours=1),
            grace_period_end=now + timedelta(days=6),
            dunning_stage='none'
        )

        # Stage 1: Day 1
        process_subscription_dunning()
        sub.refresh_from_db()
        assert sub.dunning_stage == 'day_1'

        # Stage 2: Day 3
        sub.payment_failed_at = now - timedelta(days=3, hours=1)
        sub.save()
        process_subscription_dunning()
        sub.refresh_from_db()
        assert sub.dunning_stage == 'day_3'

        # Stage 3: Day 5
        sub.payment_failed_at = now - timedelta(days=5, hours=1)
        sub.save()
        process_subscription_dunning()
        sub.refresh_from_db()
        assert sub.dunning_stage == 'day_5'

        # Stage 4: Day 7 Final & Halted
        sub.payment_failed_at = now - timedelta(days=7, hours=1)
        sub.grace_period_end = now - timedelta(minutes=5)
        sub.save()
        process_subscription_dunning()
        sub.refresh_from_db()
        assert sub.dunning_stage == 'day_7_final'
        assert sub.status == 'halted'

    def test_dunning_recovery_from_day_3(self):
        now = timezone.now()
        clinic, admin_user, sub = self._create_clinic_and_subscription(
            status='past_due',
            payment_failed_at=now - timedelta(days=4),
            grace_period_end=now + timedelta(days=3),
            dunning_stage='day_3'
        )
        sub.razorpay_subscription_id = "sub_test_recover_day3"
        sub.save()

        sub_entity = {
            'id': 'sub_test_recover_day3',
            'current_end': int((now + timedelta(days=30)).timestamp()),
            'current_start': int(now.timestamp()),
        }
        payment_entity = {
            'id': 'pay_test_recover_day3',
            'amount': 99900,
        }

        handle_subscription_charged(sub_entity, payment_entity)
        sub.refresh_from_db()

        assert sub.status == 'active'
        assert sub.dunning_stage == 'none'
        assert sub.payment_failed_at is None
        assert sub.grace_period_end is None

        recovery_log = DunningRecoveryLog.objects.filter(subscription=sub).first()
        assert recovery_log is not None
        assert recovery_log.dunning_stage_reached == 'day_3'

    def test_normal_subscription_charge_does_not_create_false_recovery(self):
        now = timezone.now()
        clinic, admin_user, sub = self._create_clinic_and_subscription(
            status='active',
            payment_failed_at=None,
            grace_period_end=None,
            dunning_stage='none'
        )
        sub.razorpay_subscription_id = "sub_test_normal_paid"
        sub.save()

        sub_entity = {
            'id': 'sub_test_normal_paid',
            'current_end': int((now + timedelta(days=30)).timestamp()),
            'current_start': int(now.timestamp()),
        }
        payment_entity = {
            'id': 'pay_test_normal_paid',
            'amount': 99900,
        }

        handle_subscription_charged(sub_entity, payment_entity)
        sub.refresh_from_db()

        assert sub.status == 'active'
        assert sub.dunning_stage == 'none'

        # Must NOT create a DunningRecoveryLog entry for normal on-time payment
        assert DunningRecoveryLog.objects.filter(subscription=sub).count() == 0

    def test_metrics_task_counts_dunning_recoveries_for_target_day(self):
        now = timezone.now()
        yesterday_dt = now - timedelta(days=1)
        yesterday_date = yesterday_dt.date()

        clinic1, _, sub1 = self._create_clinic_and_subscription()
        clinic2, _, sub2 = self._create_clinic_and_subscription()
        clinic3, _, sub3 = self._create_clinic_and_subscription()

        # 1. Recovery yesterday (should be counted)
        log_yesterday = DunningRecoveryLog.objects.create(
            subscription=sub1, dunning_stage_reached='day_3'
        )
        DunningRecoveryLog.objects.filter(pk=log_yesterday.pk).update(recovered_at=yesterday_dt)

        # 2. Recovery 2 days ago (excluded)
        log_2days = DunningRecoveryLog.objects.create(
            subscription=sub2, dunning_stage_reached='day_1'
        )
        DunningRecoveryLog.objects.filter(pk=log_2days.pk).update(recovered_at=now - timedelta(days=2))

        # 3. Recovery today (excluded)
        log_today = DunningRecoveryLog.objects.create(
            subscription=sub3, dunning_stage_reached='day_5'
        )
        DunningRecoveryLog.objects.filter(pk=log_today.pk).update(recovered_at=now)

        compute_daily_payment_metrics()
        snapshot = PaymentMetricSnapshot.objects.get(date=yesterday_date)

        assert snapshot.dunning_recoveries == 1
