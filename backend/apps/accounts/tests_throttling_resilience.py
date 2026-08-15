import pytest
from unittest.mock import patch
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory
from apps.accounts.throttling import (
    BaseCustomRateThrottle,
    LoginEmailRateThrottle,
    PatientOTPRateThrottle,
    MFAStrictRateThrottle,
)


class DummyTestThrottle(BaseCustomRateThrottle):
    scope = "dummy"
    rate = "5/15m"

    def get_cache_key(self, request, view):
        return "throttle_dummy_key"


@pytest.mark.django_db
class TestThrottlingResilience:
    """
    Tests proving that throttle classes fail OPEN when the cache backend (Redis)
    is unreachable or raises an exception, ensuring authentication & OTP flows
    do not crash with 500 Internal Server Error.
    """

    def test_base_throttle_fails_open_on_cache_get_exception(self):
        throttle = DummyTestThrottle()
        factory = APIRequestFactory()
        request = factory.get("/test/")

        with patch.object(throttle.cache, "get", side_effect=Exception("Redis connection refused")):
            # Must fail open (return True) instead of raising unhandled exception
            assert throttle.allow_request(request, None) is True

    def test_base_throttle_fails_open_on_cache_set_exception(self):
        throttle = DummyTestThrottle()
        factory = APIRequestFactory()
        request = factory.get("/test/")

        with patch.object(throttle.cache, "get", return_value=[]), \
             patch.object(throttle.cache, "set", side_effect=Exception("Redis connection refused")):
            # Must fail open (return True) instead of raising unhandled exception
            assert throttle.allow_request(request, None) is True

    def test_patient_otp_request_endpoint_fails_open_when_cache_down(self):
        client = APIClient()
        url = reverse("patient-otp-request")
        payload = {"phone": "+1234567890"}

        # Simulate Redis connection failure across django.core.cache.cache
        with patch("django.core.cache.cache.get", side_effect=Exception("Redis connection refused")):
            response = client.post(url, payload, format="json")
            # Endpoint must not fail with 500 Internal Server Error
            assert response.status_code != status.HTTP_500_INTERNAL_SERVER_ERROR
            assert response.status_code in [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST]

    def test_login_endpoint_fails_open_when_cache_down(self):
        client = APIClient()
        url = reverse("token_obtain_pair")
        payload = {"email": "test@example.com", "password": "wrongpassword"}

        with patch("django.core.cache.cache.get", side_effect=Exception("Redis connection refused")):
            response = client.post(url, payload, format="json")
            # Endpoint must return standard 400 bad credentials, not 500 crash
            assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_mfa_verify_endpoint_fails_open_when_cache_down(self):
        client = APIClient()
        url = reverse("mfa-verify")
        payload = {"pending_token": "invalid.token.here", "code": "123456"}

        with patch("django.core.cache.cache.get", side_effect=Exception("Redis connection refused")):
            response = client.post(url, payload, format="json")
            # Endpoint must return standard 400 validation error, not 500 crash
            assert response.status_code == status.HTTP_400_BAD_REQUEST
