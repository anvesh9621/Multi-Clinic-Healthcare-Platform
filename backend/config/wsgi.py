"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os
import sys
import types

# Monkeypatch for razorpay compatibility with modern python environments
if 'pkg_resources' not in sys.modules:
    m = types.ModuleType('pkg_resources')
    class FakeDistribution:
        def __init__(self, version="1.4.1"):
            self.version = version
    class DistributionNotFound(Exception):
        pass
    m.require = lambda *args, **kwargs: [FakeDistribution()]
    m.DistributionNotFound = DistributionNotFound
    sys.modules['pkg_resources'] = m

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()
