from apps.core.test_tenancy import TenantIsolationTestCase
from apps.core.factories import PatientProfileFactory


class PatientTenancyTests(TenantIsolationTestCase):
    def setUp(self):
        super().setUp()
        self.patient_a = PatientProfileFactory(user__clinic=self.clinic_a)
        self.patient_b = PatientProfileFactory(user__clinic=self.clinic_b)

    def test_patient_list_isolation(self):
        """PatientListView: Clinic A admin cannot see Clinic B patient in list."""
        self.assert_clinic_a_cannot_see_clinic_b_data("/api/patients/", self.patient_b.id)

    def test_patient_history_detail_isolation(self):
        """PatientHistoryView: Clinic A admin cannot view history for Clinic B patient."""
        self.assert_direct_id_access_blocked(f"/api/patients/{self.patient_b.id}/history/", expected_status=(403, 404))
