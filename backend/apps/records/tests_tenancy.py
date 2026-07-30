from apps.core.test_tenancy import TenantIsolationTestCase
from apps.core.factories import (
    DoctorFactory,
    DoctorClinicFactory,
)
from apps.records.models import PrescriptionTemplate


class RecordsTenancyTests(TenantIsolationTestCase):
    def setUp(self):
        super().setUp()
        self.doctor_user_a = DoctorFactory(clinic=self.clinic_a)
        self.doc_clinic_a = DoctorClinicFactory(doctor=self.doctor_user_a.doctor_profile, clinic=self.clinic_a)

        self.doctor_user_b = DoctorFactory(clinic=self.clinic_b)
        self.doc_clinic_b = DoctorClinicFactory(doctor=self.doctor_user_b.doctor_profile, clinic=self.clinic_b)

        self.template_a = PrescriptionTemplate.objects.create(
            doctor_clinic=self.doc_clinic_a,
            name="Clinic A Fever Kit",
            items=[{"medicine_name": "Paracetamol", "dosage": "500mg", "frequency": "BID", "duration_days": 3}]
        )
        self.template_b = PrescriptionTemplate.objects.create(
            doctor_clinic=self.doc_clinic_b,
            name="Clinic B Cold Kit",
            items=[{"medicine_name": "Cetirizine", "dosage": "10mg", "frequency": "OD", "duration_days": 5}]
        )

    def test_prescription_template_list_isolation(self):
        """PrescriptionTemplateViewSet: Doctor in Clinic A cannot see Clinic B's templates."""
        self.client.force_authenticate(user=self.doctor_user_a)
        response = self.client.get("/api/records/templates/")
        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        template_ids = [t["id"] for t in results]
        self.assertIn(self.template_a.id, template_ids)
        self.assertNotIn(self.template_b.id, template_ids)

    def test_prescription_template_detail_isolation(self):
        """PrescriptionTemplateDetailView: Doctor in Clinic A blocked from viewing Clinic B template directly."""
        self.client.force_authenticate(user=self.doctor_user_a)
        response = self.client.get(f"/api/records/templates/{self.template_b.id}/")
        self.assertIn(response.status_code, (403, 404))
