"use client";

import { useState, useEffect } from "react";
import { Plus, Receipt, FileText, Trash2 } from "lucide-react";
import api from "@/services/api";

type InvoiceItem = { description: string; amount: string };

export default function ReceptionistBilling() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [selectedPatient, setSelectedPatient] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([{ description: "Consultation Fee", amount: "" }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invRes, patRes] = await Promise.all([
        api.get("/billing/invoices/"),
        api.get("/patients/")
      ]);
      setInvoices(invRes.data);
      setPatients(patRes.data);
    } catch (e) {
      console.error("Failed to load billing data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { description: "", amount: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        patient: selectedPatient,
        items: items.map(i => ({ description: i.description, amount: parseFloat(i.amount) }))
      };
      await api.post("/billing/invoices/", payload);
      setIsModalOpen(false);
      setSelectedPatient("");
      setItems([{ description: "Consultation Fee", amount: "" }]);
      fetchData();
    } catch (error) {
      console.error(error);
      alert("Failed to create invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDraft = items.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);

  if (loading) return <div className="p-8 text-gray-500 font-medium">Loading invoices...</div>;

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Receipt className="w-6 h-6 text-blue-600" /> Clinic Billing
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage patient invoices and payments</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Invoice
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {invoices.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
               <FileText className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-900 font-semibold">No invoices generated yet</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Invoice ID</th>
                <th className="px-6 py-4">Patient ID</th>
                <th className="px-6 py-4">Date Issued</th>
                <th className="px-6 py-4">Total Amount</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">INV-{inv.id.toString().padStart(4, '0')}</td>
                  <td className="px-6 py-4 font-medium text-gray-700">#{inv.patient}</td>
                  <td className="px-6 py-4 text-gray-600">{new Date(inv.issued_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">${inv.total_amount}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase ${
                      inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">Create New Invoice</h2>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="invoice-form" onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
                  <select 
                    required 
                    value={selectedPatient}
                    onChange={(e) => setSelectedPatient(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors bg-white font-medium"
                  >
                    <option value="" disabled>Search or select a patient...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>Patient #{p.id} {p.user?.email ? `(${p.user.email})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                    <label className="block text-sm font-bold text-gray-900">Line Items</label>
                    <button type="button" onClick={handleAddItem} className="text-xs text-blue-600 font-bold hover:text-blue-800 tracking-wide uppercase">
                      + Add Item
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex gap-3 items-center group">
                        <input
                          required
                          type="text"
                          placeholder="Service description"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          className="flex-1 flex-grow-[2] rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                        />
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={item.amount}
                            onChange={(e) => handleItemChange(idx, 'amount', e.target.value)}
                            className="w-full rounded-xl border border-gray-200 pl-7 pr-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                          />
                        </div>
                        <button type="button" onClick={() => handleRemoveItem(idx)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-dashed border-gray-200 flex justify-between items-center text-sm font-bold">
                    <span className="text-gray-500">Draft Total:</span>
                    <span className="text-gray-900">${totalDraft.toFixed(2)}</span>
                  </div>
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                form="invoice-form"
                type="submit"
                disabled={isSubmitting || !selectedPatient || items.length === 0}
                className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Generating..." : "Generate Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
