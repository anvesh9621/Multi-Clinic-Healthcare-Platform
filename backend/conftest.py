import os
import pytest


def pytest_collection_modifyitems(config, items):
    using_postgres = os.environ.get('USE_POSTGRES_TEST_DB', 'false').lower() in ('true', '1', 'yes')
    if not using_postgres:
        skip_marker = pytest.mark.skip(
            reason="Requires USE_POSTGRES_TEST_DB=true — this test checks "
                   "PostgreSQL-specific ExclusionConstraint/RangeField behavior "
                   "that SQLite cannot enforce. Running it against SQLite would "
                   "silently pass without testing the actual constraint."
        )
        for item in items:
            if "postgres_required" in item.keywords:
                item.add_marker(skip_marker)
