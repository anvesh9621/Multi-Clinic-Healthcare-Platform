"use client";

import { useState, useEffect } from "react";
import { Package, Plus, ArrowUpRight, ArrowDownRight, AlertTriangle } from "lucide-react";
import api from "@/services/api";

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
      setItems(res.data);
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

  if (loading) return <div className="p-8 text-gray-500 font-medium">Loading inventory...</div>;

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Package className="w-6 h-6 text-indigo-600" /> Clinic Inventory
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage medical supplies, medicines, and stock operations</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Add New Item
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {items.length === 0 ? (
           <div className="p-16 text-center">
             <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Package className="w-6 h-6 text-gray-400" />
             </div>
             <p className="text-gray-900 font-semibold">No inventory items found</p>
             <p className="text-sm text-gray-500 mt-1">Add your first medicine or supply to begin tracking.</p>
           </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Item (SKU)</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">In Stock</th>
                <th className="px-6 py-4">Unit Price</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(item => {
                const isLowStock = item.quantity <= item.restock_threshold;
                return (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{item.name}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 tracking-wider font-mono bg-gray-100/80 inline-block px-2 py-0.5 rounded">{item.sku}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-bold tracking-wide uppercase text-xs">{item.category || "-"}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-lg ${isLowStock ? 'text-red-600' : 'text-emerald-600'}`}>
                          {item.quantity}
                        </span>
                        <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider bg-gray-100 px-1.5 py-0.5 rounded">{item.unit}</span>
                        {isLowStock && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 px-2 py-1 rounded-md uppercase tracking-wide ml-2">
                            <AlertTriangle className="w-3 h-3" /> Low
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">${item.unit_price}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => { setAdjustingItem(item); setAdjustData({ ...adjustData, transaction_type: "ADD" }); }}
                        className="p-2 text-emerald-600 hover:bg-emerald-100 hover:shadow-sm rounded-lg transition-all"
                        title="Add Stock"
                      >
                        <ArrowUpRight className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => { setAdjustingItem(item); setAdjustData({ ...adjustData, transaction_type: "DEDUCT" }); }}
                        className="p-2 text-rose-600 hover:bg-rose-100 hover:shadow-sm rounded-lg transition-all"
                        title="Deduct Stock"
                      >
                        <ArrowDownRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <form onSubmit={handleCreateSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 bg-gray-50 cursor-pointer text-lg font-bold text-gray-900">Add Inventory Item</div>
            <div className="p-6 space-y-4">
              <input required placeholder="Item Name (e.g. Paracetamol 500mg)" className="w-full rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 px-4 py-3 font-medium transition-colors outline-none" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} />
              <input required placeholder="SKU (e.g. MED-001)" className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono uppercase focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none" value={formData.sku} onChange={e=>setFormData({...formData, sku: e.target.value})} />
              <input placeholder="Category (e.g. Medicine, Equipment)" className="w-full rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 px-4 py-3 font-medium outline-none" value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})} />
              <div className="flex gap-4">
                <input required type="number" placeholder="Initial QTY" className="w-full rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 px-4 py-3 font-medium outline-none" value={formData.quantity} onChange={e=>setFormData({...formData, quantity: parseInt(e.target.value)})} />
                <input required placeholder="Unit (pcs, box)" className="w-full rounded-xl border border-gray-200 px-4 py-3 font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none" value={formData.unit} onChange={e=>setFormData({...formData, unit: e.target.value})} />
              </div>
              <div className="flex gap-4">
                <input required type="number" placeholder="Alert Threshold" className="w-full rounded-xl border border-gray-200 px-4 py-3 font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none title='Restock Alert Threshold'" value={formData.restock_threshold} onChange={e=>setFormData({...formData, restock_threshold: parseInt(e.target.value)})} />
                <input required step="0.01" type="number" placeholder="Unit Price ($)" className="w-full rounded-xl border border-gray-200 px-4 py-3 font-bold focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none" value={formData.unit_price} onChange={e=>setFormData({...formData, unit_price: parseFloat(e.target.value)})} />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button type="button" onClick={()=>setIsAddModalOpen(false)} className="px-5 py-2.5 font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-all">Cancel</button>
              <button type="submit" className="px-6 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm rounded-xl transition-all">Save Item</button>
            </div>
          </form>
        </div>
      )}

      {adjustingItem && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <form onSubmit={handleAdjustSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 bg-gray-50 text-lg font-bold text-gray-900">
              {adjustData.transaction_type === "ADD" ? "Restock" : "Deduct"} {adjustingItem.name}
            </div>
            <div className="p-6 space-y-5">
              <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100">Current Stock: <span className="font-bold text-gray-900 text-lg ml-2">{adjustingItem.quantity} <span className="text-sm text-gray-500 uppercase tracking-wider">{adjustingItem.unit}</span></span></p>
              
              <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                <button type="button" onClick={()=>setAdjustData({...adjustData, transaction_type: "ADD"})} className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${adjustData.transaction_type==="ADD" ? 'bg-white shadow-sm text-emerald-600':'text-gray-500 hover:bg-gray-200/50'}`}>Add Stock</button>
                <button type="button" onClick={()=>setAdjustData({...adjustData, transaction_type: "DEDUCT"})} className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${adjustData.transaction_type==="DEDUCT" ? 'bg-white shadow-sm text-rose-600':'text-gray-500 hover:bg-gray-200/50'}`}>Deduct Stock</button>
              </div>

              <input required type="number" min="1" placeholder="Quantity" className="w-full rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 px-4 py-3 font-bold text-xl outline-none transition-colors" value={adjustData.quantity_change || ""} onChange={e=>setAdjustData({...adjustData, quantity_change: parseInt(e.target.value)})} />
              <input placeholder="Reason (Optional)" className="w-full rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 px-4 py-3 font-medium text-sm outline-none transition-colors" value={adjustData.reason} onChange={e=>setAdjustData({...adjustData, reason: e.target.value})} />
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button type="button" onClick={()=>setAdjustingItem(null)} className="px-5 py-2.5 font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-all">Cancel</button>
              <button type="submit" className={`px-6 py-2.5 font-bold text-white rounded-xl shadow-sm transition-all ${adjustData.transaction_type==="ADD" ? 'bg-emerald-600 hover:bg-emerald-700':'bg-rose-600 hover:bg-rose-700'}`}>Confirm</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
