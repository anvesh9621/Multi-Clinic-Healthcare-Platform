from apps.core.test_tenancy import TenantIsolationTestCase
from apps.inventory.models import InventoryItem


class InventoryTenancyTests(TenantIsolationTestCase):
    def setUp(self):
        super().setUp()
        self.item_a = InventoryItem.objects.create(
            clinic=self.clinic_a,
            name="Syringes 5ml",
            sku="SYR-A-001",
            quantity=100
        )
        self.item_b = InventoryItem.objects.create(
            clinic=self.clinic_b,
            name="Bandages 2inch",
            sku="BND-B-001",
            quantity=50
        )

    def test_inventory_list_isolation(self):
        """InventoryItemViewSet: Clinic A admin cannot see Clinic B inventory items."""
        self.assert_clinic_a_cannot_see_clinic_b_data("/api/inventory/", self.item_b.id)

    def test_inventory_detail_isolation_get(self):
        """InventoryItemViewSet: Direct GET by ID blocked for Clinic B inventory item."""
        self.assert_direct_id_access_blocked(f"/api/inventory/{self.item_b.id}/", expected_status=(403, 404))

    def test_inventory_detail_isolation_delete(self):
        """InventoryItemViewSet: Direct DELETE by ID blocked for Clinic B inventory item."""
        self.assert_direct_id_access_blocked(f"/api/inventory/{self.item_b.id}/", expected_status=(403, 404), method="delete")
