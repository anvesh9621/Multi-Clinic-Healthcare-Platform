from rest_framework.test import APITestCase
from apps.core.factories import ClinicFactory, ClinicAdminFactory


class TenantIsolationTestCase(APITestCase):
    """
    Base class for testing that a clinic-scoped endpoint correctly
    isolates data between clinics. Subclasses set `endpoint_name` and
    `factory` and get a standard set of isolation assertions for free.
    """
    def setUp(self):
        self.clinic_a = ClinicFactory()
        self.clinic_b = ClinicFactory()
        self.admin_a = ClinicAdminFactory(clinic=self.clinic_a)
        self.admin_b = ClinicAdminFactory(clinic=self.clinic_b)
        # subclasses create their own clinic-scoped objects here

    def assert_clinic_a_cannot_see_clinic_b_data(self, url, clinic_b_object_id):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(url)
        results = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        ids_returned = [obj["id"] for obj in results]
        self.assertNotIn(clinic_b_object_id, ids_returned)

    def assert_direct_id_access_blocked(self, detail_url, expected_status=(403, 404)):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(detail_url)
        self.assertIn(response.status_code, expected_status)
