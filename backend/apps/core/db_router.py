"""
Database Router Scaffold for Read-Replica Support.

This router implements Django's database router interface (db_for_read, db_for_write,
allow_relation, allow_migrate).

Currently, this is inert scaffolding: all methods return None, deferring entirely to
Django's default database alias ('default').

When a read-replica database instance is provisioned in a future phase (gated by
measured connection/read bottlenecks during Phase 6 load testing), db_for_read can
be updated to return 'replica' for eligible read-only models/views while db_for_write
and critical read-after-write operations remain pinned to 'default'.
"""
import logging

logger = logging.getLogger(__name__)


class DatabaseRouter:
    """
    Database router to support future master/replica database splitting.
    Currently acts as a no-op deferring to Django's default routing.
    """

    def db_for_read(self, model, **hints):
        """
        Reads are currently routed to 'default' (by returning None).
        In the future, eligible read models can return 'replica' if configured in DATABASES.
        """
        return None

    def db_for_write(self, model, **hints):
        """
        All writes are permanently routed to 'default'.
        """
        return None

    def allow_relation(self, obj1, obj2, **hints):
        """
        Allow relations between objects in the same database or across default/replica.
        Returning None defers to Django default checks.
        """
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        Migrations should only run on the primary 'default' database.
        Returning None allows standard migration routing.
        """
        return None
