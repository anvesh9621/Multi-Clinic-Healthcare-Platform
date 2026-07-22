from django.test import TestCase
from rest_framework.test import APIClient
from apps.core.test_utils import setup_test_environment

class PrescriptionTemplateTests(TestCase):
    def setUp(self):
        self.env = setup_test_environment()
        self.client = APIClient()
        self.doctor_a = self.env["doctor_a"]

    def test_prescription_template_creation(self):
        """
        Ensures a doctor can successfully create a prescription template
        without hitting a 500 error due to incorrect related_names.
        """
        # Authenticate as the user associated with doctor_a
        self.client.force_authenticate(user=self.doctor_a.doctor.user)

        payload = {
            "name": "Standard Cold and Flu",
            "medication_name": "Paracetamol",
            "dosage": "500mg",
            "frequency": "Twice a day",
            "duration": "5 days",
            "notes": "Take after meals"
        }

        response = self.client.post("/api/records/prescription-templates/", payload)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["name"], "Standard Cold and Flu")
