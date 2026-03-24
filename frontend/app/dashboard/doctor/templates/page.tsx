"use client";

import { useEffect, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft,
  Plus, 
  Trash2, 
  Save,
  Pill,
  ClipboardList,
  Edit2,
  X
} from "lucide-react";
import Link from "next/link";
import { PageLoader } from "@/components/ui/Skeleton";

interface TemplateItem {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration_days: number | string;
  instructions: string;
}

interface Template {
  id: number;
  name: string;
  items: TemplateItem[];
}

export default function TemplatesPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [items, setItems] = useState<TemplateItem[]>([]);

  useEffect(() => {
    if (user && user.role !== "DOCTOR") {
      router.push("/dashboard");
      return;
    }
    fetchTemplates();
  }, [user, router]);

  const fetchTemplates = async () => {
    try {
      const resp = await apiClient.get("/records/templates/");
      setTemplates(resp.data.results || resp.data);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setCurrentTemplateId(null);
    setTemplateName("");
    setItems([{ medicine_name: "", dosage: "", frequency: "", duration_days: "", instructions: "" }]);
  };

  const handleEdit = (tmpl: Template) => {
    setCurrentTemplateId(tmpl.id);
    setTemplateName(tmpl.name);
    // Ensure items array has at least one empty entry if backend returns empty
    setItems(tmpl.items?.length > 0 ? [...tmpl.items] : [{ medicine_name: "", dosage: "", frequency: "", duration_days: "", instructions: "" }]);
    setIsEditing(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await apiClient.delete(`/records/templates/${id}/`);
      setTemplates(templates.filter(t => t.id !== id));
      if (currentTemplateId === id) resetForm();
    } catch (error) {
      console.error("Failed to delete template", error);
    }
  };

  const handleSave = async () => {
    if (!templateName.trim()) return alert("Please enter a template name.");
    
    // Filter out empty medicines
    const validItems = items.filter(i => i.medicine_name.trim() !== "");
    if (validItems.length === 0) return alert("Please add at least one medicine.");

    // Ensure duration is int
    const cleanItems = validItems.map(m => ({
        ...m,
        duration_days: parseInt(m.duration_days.toString()) || 1
    }));

    try {
      if (currentTemplateId) {
        // Update
        const resp = await apiClient.put(`/records/templates/${currentTemplateId}/`, {
          name: templateName,
          items: cleanItems
        });
        setTemplates(templates.map(t => t.id === currentTemplateId ? resp.data : t));
      } else {
        // Create
        const resp = await apiClient.post(`/records/templates/`, {
          name: templateName,
          items: cleanItems
        });
        setTemplates([...templates, resp.data]);
      }
      resetForm();
    } catch (error: any) {
      console.error("Save failed", error);
      alert(error.response?.data?.name?.[0] || "Failed to save template. Name might already exist.");
    }
  };

  // Medicine Grid Handlers
  const addMedicineRow = () => {
    setItems([...items, { medicine_name: "", dosage: "", frequency: "", duration_days: "", instructions: "" }]);
  };

  const updateMedicine = (index: number, field: keyof TemplateItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeMedicine = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };


  if (loading) return <PageLoader />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* ── HEADER ── */}
      <div className="flex items-center gap-4 border-b border-gray-200 pb-4">
        <Link href="/dashboard/doctor" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" /> My Rx Templates
          </h1>
          <p className="text-gray-500 text-sm">Create quick-fill prescription kits to save time during consultations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* ── LEFT: FORM ── */}
        <div className="md:col-span-8 bg-white border border-gray-100 rounded-2xl shadow-sm p-6 sticky top-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-900">
               {isEditing ? "Edit Template" : "Create New Template"}
            </h2>
            {isEditing && (
              <button onClick={resetForm} className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1">
                <X className="w-4 h-4" /> Cancel Edit
              </button>
            )}
          </div>

          <div className="space-y-6">
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Kit Name *</label>
                <input 
                  type="text" 
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  className="w-full md:w-1/2 border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  placeholder="E.g. Standard Viral Fever, Migraine Protocol..."
                />
             </div>

             <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
               <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                 <Pill className="w-4 h-4 text-slate-500"/> Medications
               </h3>
               
               <div className="space-y-3">
                 {items.map((item, idx) => (
                   <div key={idx} className="flex flex-wrap md:flex-nowrap gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm items-center">
                      <input 
                        type="text" placeholder="Medicine Name" 
                        value={item.medicine_name} onChange={e => updateMedicine(idx, 'medicine_name', e.target.value)}
                        className="flex-[2] min-w-[140px] border-none bg-transparent text-sm font-medium px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                      />
                      <input 
                        type="text" placeholder="Dosage (e.g. 500mg)" 
                        value={item.dosage} onChange={e => updateMedicine(idx, 'dosage', e.target.value)}
                        className="flex-1 min-w-[100px] border-none bg-transparent text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                      />
                      <input 
                        type="text" placeholder="Freq (e.g. 1-1-1)" 
                        value={item.frequency} onChange={e => updateMedicine(idx, 'frequency', e.target.value)}
                        className="flex-1 min-w-[90px] border-none bg-transparent text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                      />
                      <input 
                        type="number" placeholder="Days" 
                        value={item.duration_days} onChange={e => updateMedicine(idx, 'duration_days', e.target.value)}
                        className="w-16 border-none bg-transparent text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-center"
                      />
                      <button 
                        onClick={() => removeMedicine(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                 ))}
                 
                 <button onClick={addMedicineRow} className="mt-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50 transition-colors">
                   <Plus className="w-4 h-4" /> Add Medicine
                 </button>
               </div>
             </div>

             <div className="flex justify-end pt-2">
                <button 
                  onClick={handleSave}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm flex items-center gap-2 transition-colors"
                >
                  <Save className="w-4 h-4" /> Save Template
                </button>
             </div>
          </div>
        </div>

        {/* ── RIGHT: SAVED TEMPLATES ── */}
        <div className="md:col-span-4 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full max-h-[70vh]">
           <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
             <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Saved Templates ({templates.length})</h2>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {templates.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-50"/>
                  <p className="text-sm font-medium">No templates saved yet.</p>
                </div>
              ) : (
                templates.map(t => (
                  <div key={t.id} className={`border rounded-xl p-4 transition-all group ${currentTemplateId === t.id ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-100 hover:border-indigo-200 hover:bg-slate-50'}`}>
                    <div className="flex justify-between items-start mb-2">
                       <h3 className="font-bold text-gray-900 text-sm">{t.name}</h3>
                       <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => handleEdit(t)} className="p-1 text-gray-400 hover:text-indigo-600 bg-white rounded shadow-sm border border-gray-100"><Edit2 className="w-3.5 h-3.5"/></button>
                         <button onClick={() => handleDelete(t.id)} className="p-1 text-gray-400 hover:text-red-600 bg-white rounded shadow-sm border border-gray-100"><Trash2 className="w-3.5 h-3.5"/></button>
                       </div>
                    </div>
                    
                    <div className="space-y-1">
                      {t.items?.slice(0, 3).map((item, idx) => (
                        <p key={idx} className="text-xs text-gray-600 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-indigo-300"></span>
                          <span className="font-medium text-gray-800">{item.medicine_name}</span> {item.dosage}
                        </p>
                      ))}
                      {t.items?.length > 3 && (
                        <p className="text-[10px] font-medium text-gray-400 pl-2">+{t.items.length - 3} more...</p>
                      )}
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>

      </div>
    </div>
  );
}
