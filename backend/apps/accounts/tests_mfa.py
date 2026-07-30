import jwt
import pyotp
from datetime import datetime, timezone as dt_timezone, timedelta
from django.conf import settings
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework import status
from apps.accounts.models import User, StaffMFA
from apps.accounts.services import generate_mfa_secret, enable_mfa
from apps.core.factories import ClinicFactory, UserFactory, PatientFactory


class StaffMFATests(APITestCase):
    def setUp(self):
        cache.clear()
        self.clinic_a = ClinicFactory()
        self.clinic_b = ClinicFactory()

        # Staff user with no StaffMFA record
        self.doctor = UserFactory(
            clinic=self.clinic_a,
            role=User.RoleChoices.DOCTOR,
            email="doctor_mfa@example.com"
        )
        self.doctor_password = "password123"
        self.doctor.set_password(self.doctor_password)
        self.doctor.save()

        # Patient user
        self.patient = PatientFactory(email="patient_no_mfa@example.com")
        self.patient_password = "password123"
        self.patient.set_password(self.patient_password)
        self.patient.save()

        # Admin users for tenancy reset tests
        self.admin_a = UserFactory(
            clinic=self.clinic_a,
            role=User.RoleChoices.CLINIC_ADMIN,
            email="admin_a@example.com"
        )
        self.admin_b = UserFactory(
            clinic=self.clinic_b,
            role=User.RoleChoices.CLINIC_ADMIN,
            email="admin_b@example.com"
        )

        self.login_url = "/api/token/"
        self.setup_url = "/api/accounts/mfa/setup/"
        self.confirm_url = "/api/accounts/mfa/confirm/"
        self.verify_url = "/api/accounts/mfa/verify/"
        self.recover_url = "/api/accounts/mfa/recover/"
        self.admin_reset_url = "/api/accounts/mfa/admin-reset/"
        self.protected_url = "/api/accounts/me/"

    def test_staff_login_without_mfa_returns_pending_setup_token_and_no_jwt(self):
        """Staff login with no StaffMFA returns pending token scoped to mfa_setup and NO real JWT."""
        response = self.client.post(self.login_url, {
            "email": self.doctor.email,
            "password": self.doctor_password
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get("mfa_required"))
        self.assertTrue(response.data.get("mfa_setup_required"))

        # Core mandatory guarantee: NO real JWT tokens issued
        self.assertNotIn("access", response.data)
        self.assertNotIn("refresh", response.data)

        # Inspect pending_token payload
        pending_token = response.data.get("pending_token")
        self.assertIsNotNone(pending_token)

        payload = jwt.decode(pending_token, settings.SECRET_KEY, algorithms=["HS256"])
        self.assertEqual(payload.get("token_type"), "mfa_pending")
        self.assertEqual(payload.get("action"), "mfa_setup")
        self.assertEqual(payload.get("user_id"), self.doctor.id)

    def test_pending_token_cannot_access_protected_endpoint(self):
        """Using an mfa_setup pending token as Bearer token against protected endpoint is rejected."""
        login_res = self.client.post(self.login_url, {
            "email": self.doctor.email,
            "password": self.doctor_password
        })
        pending_token = login_res.data["pending_token"]

        response = self.client.get(
            self.protected_url,
            HTTP_AUTHORIZATION=f"Bearer {pending_token}"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_complete_mfa_setup_flow(self):
        """Complete setup (generate secret, confirm with valid TOTP code) enables MFA and returns 10 backup codes once."""
        login_res = self.client.post(self.login_url, {
            "email": self.doctor.email,
            "password": self.doctor_password
        })
        pending_token = login_res.data["pending_token"]

        # Step 1: Generate MFA secret
        setup_res = self.client.post(
            self.setup_url,
            {"pending_token": pending_token}
        )
        self.assertEqual(setup_res.status_code, status.HTTP_200_OK)
        secret = setup_res.data["secret"]
        self.assertIsNotNone(secret)

        # Step 2: Confirm with valid TOTP code
        totp_code = pyotp.TOTP(secret).now()
        confirm_res = self.client.post(
            self.confirm_url,
            {"pending_token": pending_token, "code": totp_code}
        )
        self.assertEqual(confirm_res.status_code, status.HTTP_200_OK)
        self.assertTrue(confirm_res.data["success"])

        # Check StaffMFA state
        staff_mfa = StaffMFA.objects.get(user=self.doctor)
        self.assertTrue(staff_mfa.is_enabled)

        # Check 10 backup codes returned exactly once along with JWT tokens
        backup_codes = confirm_res.data.get("backup_codes")
        self.assertIsNotNone(backup_codes)
        self.assertEqual(len(backup_codes), 10)
        self.assertIn("SHOWN_ONLY_ONCE", confirm_res.data.get("backup_codes_notice", ""))
        self.assertIn("access", confirm_res.data)
        self.assertIn("refresh", confirm_res.data)

    def test_staff_login_with_mfa_enabled_returns_pending_verify_token(self):
        """Staff login WITH StaffMFA enabled returns pending token scoped to mfa_verify."""
        secret, _ = generate_mfa_secret(self.doctor)
        enable_mfa(self.doctor, pyotp.TOTP(secret).now())

        login_res = self.client.post(self.login_url, {
            "email": self.doctor.email,
            "password": self.doctor_password
        })
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertTrue(login_res.data.get("mfa_required"))
        self.assertFalse(login_res.data.get("mfa_setup_required"))
        self.assertNotIn("access", login_res.data)

        pending_token = login_res.data.get("pending_token")
        payload = jwt.decode(pending_token, settings.SECRET_KEY, algorithms=["HS256"])
        self.assertEqual(payload.get("action"), "mfa_verify")

    def test_mfa_verify_correct_code_succeeds(self):
        """Correct TOTP code against mfa/verify/ issues real JWT access/refresh pair."""
        secret, _ = generate_mfa_secret(self.doctor)
        enable_mfa(self.doctor, pyotp.TOTP(secret).now())

        login_res = self.client.post(self.login_url, {
            "email": self.doctor.email,
            "password": self.doctor_password
        })
        pending_token = login_res.data["pending_token"]

        correct_code = pyotp.TOTP(secret).now()
        verify_res = self.client.post(self.verify_url, {
            "pending_token": pending_token,
            "code": correct_code
        })
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        self.assertTrue(verify_res.data["success"])
        self.assertIn("access", verify_res.data)
        self.assertIn("refresh", verify_res.data)

    def test_mfa_verify_wrong_code_fails(self):
        """Wrong TOTP code against mfa/verify/ fails with 400 Bad Request."""
        secret, _ = generate_mfa_secret(self.doctor)
        enable_mfa(self.doctor, pyotp.TOTP(secret).now())

        login_res = self.client.post(self.login_url, {
            "email": self.doctor.email,
            "password": self.doctor_password
        })
        pending_token = login_res.data["pending_token"]

        wrong_res = self.client.post(self.verify_url, {
            "pending_token": pending_token,
            "code": "000000"
        })
        self.assertEqual(wrong_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid verification code", wrong_res.data["error"])

    def test_mfa_verify_throttled_after_repeated_failed_attempts(self):
        """5 wrong TOTP attempts trigger MFAStrictRateThrottle (429 Too Many Requests)."""
        secret, _ = generate_mfa_secret(self.doctor)
        enable_mfa(self.doctor, pyotp.TOTP(secret).now())

        login_res = self.client.post(self.login_url, {
            "email": self.doctor.email,
            "password": self.doctor_password
        })
        pending_token = login_res.data["pending_token"]

        for _ in range(5):
            self.client.post(self.verify_url, {
                "pending_token": pending_token,
                "code": "000000"
            })
        throttled_res = self.client.post(self.verify_url, {
            "pending_token": pending_token,
            "code": "000000"
        })
        self.assertEqual(throttled_res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_mfa_verify_expired_pending_token_rejected(self):
        """Expired pending token (past 5 min) is rejected with 400 Bad Request."""
        secret, _ = generate_mfa_secret(self.doctor)
        enable_mfa(self.doctor, pyotp.TOTP(secret).now())

        expired_payload = {
            "token_type": "mfa_pending",
            "user_id": self.doctor.id,
            "email": self.doctor.email,
            "role": self.doctor.role,
            "action": "mfa_verify",
            "exp": datetime.now(dt_timezone.utc) - timedelta(minutes=1),
            "iat": datetime.now(dt_timezone.utc) - timedelta(minutes=6),
        }
        expired_token = jwt.encode(expired_payload, settings.SECRET_KEY, algorithm="HS256")

        expired_res = self.client.post(self.verify_url, {
            "pending_token": expired_token,
            "code": pyotp.TOTP(secret).now()
        })
        self.assertEqual(expired_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Pending MFA session expired", expired_res.data["error"])

    def test_backup_code_recovery(self):
        """Backup code recovery issues JWT, removes code from list, and reflects accurate remaining count."""
        secret, _ = generate_mfa_secret(self.doctor)
        ok, msg, backup_codes = enable_mfa(self.doctor, pyotp.TOTP(secret).now())
        self.assertTrue(ok)
        self.assertEqual(len(backup_codes), 10)

        code_to_use = backup_codes[0]

        # Use valid backup code to recover
        recover_res = self.client.post(self.recover_url, {
            "email": self.doctor.email,
            "backup_code": code_to_use
        })
        self.assertEqual(recover_res.status_code, status.HTTP_200_OK)
        self.assertTrue(recover_res.data["success"])
        self.assertIn("access", recover_res.data)
        self.assertIn("refresh", recover_res.data)
        self.assertEqual(recover_res.data.get("remaining_backup_codes"), 9)

        # Attempt to reuse the same backup code fails
        reuse_res = self.client.post(self.recover_url, {
            "email": self.doctor.email,
            "backup_code": code_to_use
        })
        self.assertEqual(reuse_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid or already used", reuse_res.data["error"])

    def test_mfa_admin_reset_tenancy_isolation(self):
        """Clinic Admin can reset MFA for staff in their OWN clinic, but NOT for staff in a DIFFERENT clinic."""
        # Enable MFA for doctor in Clinic A
        secret_a, _ = generate_mfa_secret(self.doctor)
        enable_mfa(self.doctor, pyotp.TOTP(secret_a).now())

        # Create doctor in Clinic B with MFA enabled
        doctor_b = UserFactory(
            clinic=self.clinic_b,
            role=User.RoleChoices.DOCTOR,
            email="doctor_b@example.com"
        )
        secret_b, _ = generate_mfa_secret(doctor_b)
        enable_mfa(doctor_b, pyotp.TOTP(secret_b).now())

        # Admin A tries to reset MFA for Doctor B (different clinic) -> 403 Forbidden
        self.client.force_authenticate(user=self.admin_a)
        forbidden_res = self.client.post(self.admin_reset_url, {
            "user_id": doctor_b.id
        })
        self.assertEqual(forbidden_res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(forbidden_res.data["success"])
        self.assertTrue(StaffMFA.objects.filter(user=doctor_b).exists())

        # Admin A resets MFA for Doctor A (same clinic) -> 200 OK & StaffMFA deleted
        success_res = self.client.post(self.admin_reset_url, {
            "user_id": self.doctor.id
        })
        self.assertEqual(success_res.status_code, status.HTTP_200_OK)
        self.assertTrue(success_res.data["success"])
        self.assertFalse(StaffMFA.objects.filter(user=self.doctor).exists())

    def test_patient_role_never_triggers_mfa(self):
        """PATIENT role login issues a real JWT directly with no pending token or MFA requirement."""
        response = self.client.post(self.login_url, {
            "email": self.patient.email,
            "password": self.patient_password
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertNotIn("mfa_required", response.data)
        self.assertNotIn("pending_token", response.data)
