from unittest.mock import patch
from django.test import override_settings
from rest_framework.test import APITestCase
from rest_framework import status
from apps.accounts.models import User
from apps.core.factories import PatientFactory, UserFactory


@override_settings(GOOGLE_OAUTH_CLIENT_ID="test-google-client-id")
class PatientGoogleAuthTests(APITestCase):
    def setUp(self):
        self.auth_url = "/api/accounts/patient/google/"
        self.existing_patient = PatientFactory(email="existing_google_patient@example.com")
        self.existing_doctor = UserFactory(email="doctor_google@example.com", role=User.RoleChoices.DOCTOR)
        self.new_email = "newgooglepatient@example.com"

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_valid_token_for_new_email_creates_patient_user(self, mock_verify):
        """Valid token for new email creates a PATIENT user with an unusable password."""
        mock_verify.return_value = {
            "email": self.new_email,
            "given_name": "Jane",
            "family_name": "Doe",
        }
        response = self.client.post(self.auth_url, {"id_token": "valid-dummy-token"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        user = User.objects.get(email=self.new_email)
        self.assertEqual(user.role, User.RoleChoices.PATIENT)
        self.assertFalse(user.has_usable_password())

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_valid_token_for_existing_patient_logs_in(self, mock_verify):
        """Valid token for an existing PATIENT user logs them in and issues JWT tokens."""
        mock_verify.return_value = {
            "email": self.existing_patient.email,
            "given_name": "Existing",
            "family_name": "Patient",
        }
        response = self.client.post(self.auth_url, {"id_token": "valid-dummy-token"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_valid_token_for_staff_user_is_rejected(self, mock_verify):
        """Valid token for an existing non-PATIENT (staff) email is rejected with 403 Forbidden."""
        mock_verify.return_value = {
            "email": self.existing_doctor.email,
            "given_name": "Dr",
            "family_name": "Smith",
        }
        response = self.client.post(self.auth_url, {"id_token": "valid-dummy-token"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data["success"])
        self.assertIn("only available for patient accounts", response.data["error"])

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_invalid_or_expired_token_is_rejected_cleanly(self, mock_verify):
        """Invalid or expired Google token is rejected cleanly with 400 Bad Request, not 500."""
        mock_verify.side_effect = ValueError("Token expired")
        response = self.client.post(self.auth_url, {"id_token": "expired-dummy-token"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertIn("Invalid or expired Google ID token", response.data["error"])

    def test_missing_id_token_returns_bad_request(self):
        """Request missing id_token parameter returns 400 Bad Request."""
        response = self.client.post(self.auth_url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("id_token is required", response.data["error"])
