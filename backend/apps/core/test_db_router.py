import pytest
from django.db import router
from apps.core.db_router import DatabaseRouter
from apps.accounts.models import User


@pytest.mark.django_db
class TestDatabaseRouter:
    def test_database_router_methods_return_none(self):
        r = DatabaseRouter()
        assert r.db_for_read(User) is None
        assert r.db_for_write(User) is None
        assert r.allow_relation(User(), User()) is None
        assert r.allow_migrate("default", "accounts") is None

    def test_django_router_defaults_to_default_database(self, settings):
        settings.DATABASE_ROUTERS = ["apps.core.db_router.DatabaseRouter"]
        assert router.db_for_read(User) == "default"
        assert router.db_for_write(User) == "default"
        assert router.allow_migrate("default", "accounts") is True
