from datetime import timedelta
from django.utils import timezone
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework import status
from apps.accounts.models import User, EmailOTP
from apps.core.factories import PatientFactory


class PatientOTPRequestTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.request_url = "/api/accounts/patient/otp/request/"
        self.existing_patient = PatientFactory(email="existing_patient@example.com")
        self.new_email = "newpatient@example.com"

    def test_otp_request_generates_code(self):
        """OTP request generates a 6-digit code in the database."""
        response = self.client.post(self.request_url, {"email": self.new_email, "purpose": "REGISTER"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])

        otp_record = EmailOTP.objects.filter(user_email=self.new_email, purpose="REGISTER").first()
        self.assertIsNotNone(otp_record)
        self.assertEqual(len(otp_record.code), 6)
        self.assertTrue(otp_record.code.isdigit())

    def test_cooldown_blocks_immediate_rerequest(self):
        """60-second cooldown blocks immediate re-request for the same email and purpose."""
        res1 = self.client.post(self.request_url, {"email": self.new_email, "purpose": "REGISTER"})
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Immediate second request is blocked by 60s cooldown
        res2 = self.client.post(self.request_url, {"email": self.new_email, "purpose": "REGISTER"})
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("60 seconds", res2.data["error"])

    def test_rate_limit_blocks_excessive_requests(self):
        """5 per hour rate limit blocks 6th OTP request."""
        now = timezone.now()
        # Create 5 historical OTP records created >60s ago in the last hour
        for i in range(5):
            otp = EmailOTP.objects.create(
                user_email=self.new_email,
                code=f"12340{i}",
                purpose="REGISTER",
                expires_at=now + timedelta(minutes=10)
            )
            EmailOTP.objects.filter(id=otp.id).update(created_at=now - timedelta(minutes=10 + i))

        # 6th request within an hour must be blocked by the hourly rate limit
        response = self.client.post(self.request_url, {"email": self.new_email, "purpose": "REGISTER"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Maximum OTP request limit reached", response.data["error"])

    def test_register_rejected_for_existing_email(self):
        """REGISTER purpose is rejected if email is already registered."""
        response = self.client.post(self.request_url, {"email": self.existing_patient.email, "purpose": "REGISTER"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already exists", response.data["error"])

    def test_login_rejected_for_nonexisting_email(self):
        """LOGIN purpose is rejected if email does not exist in the system."""
        response = self.client.post(self.request_url, {"email": "nonexistent@example.com", "purpose": "LOGIN"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No account found", response.data["error"])


class PatientOTPVerifyTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.verify_url = "/api/accounts/patient/otp/verify/"
        self.existing_patient = PatientFactory(email="existing_login@example.com")
        self.new_email = "newverify@example.com"
        self.now = timezone.now()

    def test_correct_code_succeeds(self):
        """Valid OTP code succeeds."""
        EmailOTP.objects.create(
            user_email=self.new_email,
            code="123456",
            purpose="REGISTER",
            expires_at=self.now + timedelta(minutes=10)
        )
        payload = {
            "email": self.new_email,
            "code": "123456",
            "purpose": "REGISTER",
            "first_name": "New",
            "last_name": "Patient",
            "phone": "9876543210"
        }
        response = self.client.post(self.verify_url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])

    def test_wrong_code_increments_attempts_and_fails(self):
        """Incorrect code increments attempts counter and fails."""
        otp_record = EmailOTP.objects.create(
            user_email=self.new_email,
            code="123456",
            purpose="REGISTER",
            expires_at=self.now + timedelta(minutes=10)
        )
        response = self.client.post(self.verify_url, {
            "email": self.new_email,
            "code": "999999",
            "purpose": "REGISTER"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Incorrect verification code", response.data["error"])

        otp_record.refresh_from_db()
        self.assertEqual(otp_record.attempts, 1)

    def test_excessive_attempts_invalidates_code(self):
        """Reaching 5 attempts invalidates the code for subsequent verification."""
        otp_record = EmailOTP.objects.create(
            user_email=self.new_email,
            code="123456",
            purpose="REGISTER",
            attempts=5,
            expires_at=self.now + timedelta(minutes=10)
        )
        # Even with the correct code, 5 previous failed attempts invalidate the code
        response = self.client.post(self.verify_url, {
            "email": self.new_email,
            "code": "123456",
            "purpose": "REGISTER"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Maximum verification attempts exceeded", response.data["error"])

    def test_expired_code_fails(self):
        """Expired code fails even if correct code is provided."""
        EmailOTP.objects.create(
            user_email=self.new_email,
            code="123456",
            purpose="REGISTER",
            expires_at=self.now - timedelta(minutes=1)
        )
        response = self.client.post(self.verify_url, {
            "email": self.new_email,
            "code": "123456",
            "purpose": "REGISTER"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid or expired", response.data["error"])

    def test_code_cannot_be_reused(self):
        """Code cannot be reused after successful verification (single-use)."""
        EmailOTP.objects.create(
            user_email=self.existing_patient.email,
            code="123456",
            purpose="LOGIN",
            expires_at=self.now + timedelta(minutes=10)
        )
        payload = {
            "email": self.existing_patient.email,
            "code": "123456",
            "purpose": "LOGIN"
        }
        res1 = self.client.post(self.verify_url, payload)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Second verification with the same code fails because is_used=True
        res2 = self.client.post(self.verify_url, payload)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("invalid or expired", res2.data.get("error", "").lower())

    def test_successful_register_creates_user_with_unusable_password(self):
        """Successful REGISTER creates a User with has_usable_password() returning False."""
        EmailOTP.objects.create(
            user_email=self.new_email,
            code="123456",
            purpose="REGISTER",
            expires_at=self.now + timedelta(minutes=10)
        )
        payload = {
            "email": self.new_email,
            "code": "123456",
            "purpose": "REGISTER",
            "first_name": "Test",
            "last_name": "Patient"
        }
        response = self.client.post(self.verify_url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        user = User.objects.get(email=self.new_email)
        self.assertFalse(user.has_usable_password())

    def test_successful_login_issues_jwt(self):
        """Successful LOGIN issues valid access and refresh JWT tokens."""
        EmailOTP.objects.create(
            user_email=self.existing_patient.email,
            code="654321",
            purpose="LOGIN",
            expires_at=self.now + timedelta(minutes=10)
        )
        payload = {
            "email": self.existing_patient.email,
            "code": "654321",
            "purpose": "LOGIN"
        }
        response = self.client.post(self.verify_url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
