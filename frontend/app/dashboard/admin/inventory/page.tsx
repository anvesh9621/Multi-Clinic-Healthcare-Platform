"use client";

import { useState, useEffect } from "react";
import { Package, Plus, ArrowUpRight, ArrowDownRight, AlertTriangle } from "lucide-react";
import api from "@/services/api";
import { Button } from "@/components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";

type InventoryItem = {
  id: number;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  restock_threshold: number;
  unit_price: string;
};

export default function InventoryDashboard() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);

  // Form states
  const [formData, setFormData] = useState({ name: "", sku: "", category: "", quantity: 0, unit: "pcs", restock_threshold: 10, unit_price: 0 });
  const [adjustData, setAdjustData] = useState({ transaction_type: "ADD", quantity_change: 0, reason: "" });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const res = await api.get("/inventory/");
      setItems(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/inventory/", formData);
      setIsAddModalOpen(false);
      setFormData({ name: "", sku: "", category: "", quantity: 0, unit: "pcs", restock_threshold: 10, unit_price: 0 });
      fetchInventory();
    } catch (error) {
      alert("Error creating item.");
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    try {
      await api.post(`/inventory/${adjustingItem.id}/adjust-stock/`, adjustData);
      setAdjustingItem(null);
      setAdjustData({ transaction_type: "ADD", quantity_change: 0, reason: "" });
      fetchInventory();
    } catch (error: any) {
      alert(error.response?.data?.error || "Error adjusting stock");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink heading-font flex items-center gap-3">
            <Package className="w-6 h-6 text-primary" /> Clinic Inventory
          </h1>
          <p className="text-sm text-muted mt-1">Manage medical supplies, medicines, and stock operations</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add New Item
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item (SKU)</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>In Stock</TableHead>
            <TableHead>Unit Price</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-16 text-center">
                <div className="w-16 h-16 bg-warm-surface rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-6 h-6 text-muted" />
                </div>
                <p className="text-ink font-semibold">No inventory items found</p>
                <p className="text-sm text-muted mt-1">Add your first medicine or supply to begin tracking.</p>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const isLowStock = item.quantity <= item.restock_threshold;
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-bold text-ink">{item.name}</p>
                    <p className="text-[11px] text-muted tracking-wider font-mono bg-warm-surface border border-border inline-block px-2 py-0.5 rounded mt-0.5">{item.sku}</p>
                  </TableCell>
                  <TableCell className="text-muted font-bold tracking-wide uppercase text-xs">{item.category || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-lg font-mono ${isLowStock ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {item.quantity}
                      </span>
                      <span className="text-muted text-[10px] font-bold uppercase tracking-wider bg-warm-surface border border-border px-1.5 py-0.5 rounded">{item.unit}</span>
                      {isLowStock && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full uppercase tracking-wide ml-2">
                          <AlertTriangle className="w-3 h-3" /> Low
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-ink font-mono">₹{item.unit_price}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => { setAdjustingItem(item); setAdjustData({ ...adjustData, transaction_type: "ADD" }); }}
                      className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                      title="Add Stock"
                    >
                      <ArrowUpRight className="w-5 h-5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => { setAdjustingItem(item); setAdjustData({ ...adjustData, transaction_type: "DEDUCT" }); }}
                      className="text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                      title="Deduct Stock"
                    >
                      <ArrowDownRight className="w-5 h-5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Add Item Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Inventory Item" className="max-w-md">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Item Name *</label>
            <Input required placeholder="Paracetamol 500mg" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">SKU *</label>
            <Input required placeholder="MED-001" className="font-mono uppercase" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Category</label>
            <Input placeholder="Medicine, Equipment, etc." value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-ink mb-1">Initial QTY *</label>
              <Input required type="number" placeholder="100" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink mb-1">Unit *</label>
              <Input required placeholder="pcs, box, etc." value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-ink mb-1">Alert Threshold *</label>
              <Input required type="number" placeholder="10" value={formData.restock_threshold} onChange={e => setFormData({ ...formData, restock_threshold: parseInt(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink mb-1">Unit Price (₹) *</label>
              <Input required step="0.01" type="number" placeholder="50.00" value={formData.unit_price} onChange={e => setFormData({ ...formData, unit_price: parseFloat(e.target.value) })} />
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Item</Button>
          </div>
        </form>
      </Modal>

      {/* Adjust Stock Modal */}
      {adjustingItem && (
        <Modal isOpen={!!adjustingItem} onClose={() => setAdjustingItem(null)} title={`${adjustData.transaction_type === "ADD" ? "Restock" : "Deduct"} ${adjustingItem.name}`} className="max-w-sm">
          <form onSubmit={handleAdjustSubmit} className="space-y-5">
            <p className="text-sm text-muted bg-warm-surface p-3 rounded-xl border border-border">
              Current Stock: <span className="font-bold text-ink text-lg ml-2 font-mono">{adjustingItem.quantity} <span className="text-sm text-muted uppercase tracking-wider">{adjustingItem.unit}</span></span>
            </p>
            
            <div className="flex gap-2 p-1 bg-warm-surface border border-border rounded-xl">
              <Button
                type="button"
                variant={adjustData.transaction_type === "ADD" ? "default" : "ghost"}
                onClick={() => setAdjustData({ ...adjustData, transaction_type: "ADD" })}
                className="flex-1 text-sm font-bold"
              >
                Add Stock
              </Button>
              <Button
                type="button"
                variant={adjustData.transaction_type === "DEDUCT" ? "default" : "ghost"}
                onClick={() => setAdjustData({ ...adjustData, transaction_type: "DEDUCT" })}
                className="flex-1 text-sm font-bold"
              >
                Deduct Stock
              </Button>
            </div>

            <div>
              <label className="block text-sm font-bold text-ink mb-1">Quantity Change *</label>
              <Input required type="number" min="1" placeholder="Quantity" value={adjustData.quantity_change || ""} onChange={e => setAdjustData({ ...adjustData, quantity_change: parseInt(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink mb-1">Reason (Optional)</label>
              <Input placeholder="e.g. Weekly restock" value={adjustData.reason} onChange={e => setAdjustData({ ...adjustData, reason: e.target.value })} />
            </div>
            
            <div className="pt-2 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setAdjustingItem(null)}>Cancel</Button>
              <Button type="submit" className={adjustData.transaction_type === "DEDUCT" ? "bg-rose-600 hover:bg-rose-700 text-white border-none" : ""}>
                Confirm
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
