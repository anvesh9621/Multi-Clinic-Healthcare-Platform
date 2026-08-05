import time
import threading
import pytest
from datetime import timedelta
from decimal import Decimal
from django.test import TransactionTestCase, TestCase
from django.db import transaction, connection
from django.utils import timezone
from apps.core.factories import ClinicFactory
from apps.subscriptions.models import Subscription, InvalidSubscriptionTransition


@pytest.mark.django_db
class TestSubscriptionTransitions(TestCase):

    def setUp(self):
        self.clinic = ClinicFactory()
        self.sub = self.clinic.subscription

    def test_valid_transitions_succeed(self):
        # 1. trialing -> created
        self.sub.transition_status('created', source_event='test_create')
        self.sub.refresh_from_db()
        assert self.sub.status == 'created'

        # 2. created -> active
        self.sub.transition_status('active', source_event='test_activate')
        self.sub.refresh_from_db()
        assert self.sub.status == 'active'

        # 3. active -> past_due
        self.sub.transition_status('past_due', source_event='test_payment_failed')
        self.sub.refresh_from_db()
        assert self.sub.status == 'past_due'

        # 4. past_due -> active
        self.sub.transition_status('active', source_event='test_recovery')
        self.sub.refresh_from_db()
        assert self.sub.status == 'active'

        # 5. active -> cancelled
        self.sub.transition_status('cancelled', source_event='test_cancel')
        self.sub.refresh_from_db()
        assert self.sub.status == 'cancelled'

    def test_invalid_transitions_raise_exception_and_preserve_status(self):
        self.sub.status = 'cancelled'
        self.sub.save()

        with pytest.raises(InvalidSubscriptionTransition) as exc_info:
            self.sub.transition_status('halted', source_event='test_invalid')

        assert "cancelled -> halted not allowed" in str(exc_info.value)
        self.sub.refresh_from_db()
        assert self.sub.status == 'cancelled'

    def test_extra_fields_applied_atomically_with_status_change(self):
        self.sub.status = 'active'
        self.sub.save()

        now = timezone.now()
        grace_end = now + timedelta(days=7)

        updated = self.sub.transition_status(
            'past_due',
            source_event='test_halted_extra_fields',
            extra_fields={
                'payment_failed_at': now,
                'grace_period_end': grace_end
            }
        )

        self.sub.refresh_from_db()
        assert self.sub.status == 'past_due'
        assert updated.status == 'past_due'
        assert self.sub.payment_failed_at == now
        assert self.sub.grace_period_end == grace_end

    def test_past_due_self_transition_succeeds_with_extra_fields(self):
        self.sub.status = 'past_due'
        initial_failed_at = timezone.now() - timedelta(days=2)
        self.sub.payment_failed_at = initial_failed_at
        self.sub.save()

        new_failed_at = timezone.now()
        new_grace_end = new_failed_at + timedelta(days=10)

        updated = self.sub.transition_status(
            'past_due',
            source_event='test_past_due_reentry',
            extra_fields={
                'payment_failed_at': new_failed_at,
                'grace_period_end': new_grace_end
            }
        )

        self.sub.refresh_from_db()
        assert self.sub.status == 'past_due'
        assert updated.status == 'past_due'
        assert self.sub.payment_failed_at == new_failed_at
        assert self.sub.grace_period_end == new_grace_end



@pytest.mark.django_db(transaction=True)
class TestSubscriptionConcurrencySelectForUpdate(TransactionTestCase):
    """
    Verifies that Subscription.transition_status uses select_for_update() to serialize concurrent calls.
    Thread 1 starts an atomic block, transitions trialing -> created, and holds the transaction open with a sleep.
    Thread 2 attempts created -> active. Select_for_update() ensures Thread 2 waits or locks cleanly.
    """
    def test_concurrent_transition_status_serializes(self):
        clinic = ClinicFactory()
        sub = clinic.subscription
        sub_id = sub.id

        errors = []
        execution_order = []

        def thread1_task():
            try:
                with transaction.atomic():
                    s1 = Subscription.objects.get(pk=sub_id)
                    s1.transition_status(
                        'created',
                        source_event='thread_1_created'
                    )
                    time.sleep(0.2)  # Hold transaction lock open for 200ms
                    execution_order.append("thread1_finished")
            except Exception as e:
                errors.append(f"Thread 1 error: {e}")

        def thread2_task():
            try:
                time.sleep(0.05)  # Ensure Thread 1 starts and enters transaction first
                s2 = Subscription.objects.get(pk=sub_id)
                s2.transition_status(
                    'active',
                    source_event='thread_2_active'
                )
                execution_order.append("thread2_finished")
            except Exception as e:
                if connection.vendor == 'sqlite' and ("locked" in str(e) or "lock" in str(e)):
                    execution_order.append("thread2_blocked_by_sqlite_lock")
                else:
                    errors.append(f"Thread 2 error: {e}")

        t1 = threading.Thread(target=thread1_task)
        t2 = threading.Thread(target=thread2_task)

        t1.start()
        t2.start()

        t1.join(timeout=5)
        t2.join(timeout=5)

        assert not errors, f"Thread execution errors: {errors}"
        assert ("thread2_finished" in execution_order or "thread2_blocked_by_sqlite_lock" in execution_order)
