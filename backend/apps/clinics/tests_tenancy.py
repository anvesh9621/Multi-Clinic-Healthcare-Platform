from apps.core.test_tenancy import TenantIsolationTestCase
from apps.core.factories import ReceptionistFactory
from apps.clinics.models import ReceptionistInvitation


class ClinicTenancyTests(TenantIsolationTestCase):
    def setUp(self):
        super().setUp()
        self.receptionist_a = ReceptionistFactory(clinic=self.clinic_a)
        self.receptionist_b = ReceptionistFactory(clinic=self.clinic_b)

        self.invite_a = ReceptionistInvitation.objects.create(
            clinic=self.clinic_a,
            email="rec_a_invite@test.com"
        )
        self.invite_b = ReceptionistInvitation.objects.create(
            clinic=self.clinic_b,
            email="rec_b_invite@test.com"
        )

    def test_receptionist_list_isolation(self):
        """ReceptionistListView: Clinic A admin cannot see Clinic B receptionist."""
        self.assert_clinic_a_cannot_see_clinic_b_data("/api/clinics/receptionists/", self.receptionist_b.id)

    def test_receptionist_invitation_list_isolation(self):
        """AdminReceptionistInvitationListView: Clinic A admin cannot see Clinic B invitations."""
        self.assert_clinic_a_cannot_see_clinic_b_data("/api/clinics/receptionists/invitations/", self.invite_b.id)
