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
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

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
    
    const validItems = items.filter(i => i.medicine_name.trim() !== "");
    if (validItems.length === 0) return alert("Please add at least one medicine.");

    const cleanItems = validItems.map(m => ({
        ...m,
        duration_days: parseInt(m.duration_days.toString()) || 1
    }));

    try {
      if (currentTemplateId) {
        const resp = await apiClient.put(`/records/templates/${currentTemplateId}/`, {
          name: templateName,
          items: cleanItems
        });
        setTemplates(templates.map(t => t.id === currentTemplateId ? resp.data : t));
      } else {
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
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* ── HEADER ── */}
      <div className="flex items-center gap-4 border-b border-border pb-4">
        <Link href="/dashboard/doctor">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5 text-muted" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink heading-font flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" /> My Rx Templates
          </h1>
          <p className="text-muted text-sm">Create quick-fill prescription kits to save time during consultations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* ── LEFT: FORM ── */}
        <Card className="md:col-span-8 p-6 sticky top-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-ink heading-font">
               {isEditing ? "Edit Template" : "Create New Template"}
            </h2>
            {isEditing && (
              <Button variant="ghost" size="sm" onClick={resetForm} className="text-muted">
                <X className="w-4 h-4 mr-1" /> Cancel Edit
              </Button>
            )}
          </div>

          <div className="space-y-6">
             <div>
                <label className="block text-sm font-bold text-ink mb-2">Kit Name *</label>
                <Input 
                  type="text" 
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  className="w-full md:w-3/4"
                  placeholder="E.g. Standard Viral Fever, Migraine Protocol..."
                />
             </div>

             <div className="bg-warm-surface border border-border rounded-xl p-4">
               <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
                 <Pill className="w-4 h-4 text-primary"/> Medications
               </h3>
               
               <div className="space-y-3">
                 {items.map((item, idx) => (
                   <div key={idx} className="flex flex-wrap md:flex-nowrap gap-2 bg-paper p-2 rounded-lg border border-border shadow-sm items-center">
                      <input 
                        type="text" placeholder="Medicine Name" 
                        value={item.medicine_name} onChange={e => updateMedicine(idx, 'medicine_name', e.target.value)}
                        className="flex-[2] min-w-[140px] border-none bg-transparent text-sm font-medium px-2 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-primary rounded"
                      />
                      <input 
                        type="text" placeholder="Dosage (e.g. 500mg)" 
                        value={item.dosage} onChange={e => updateMedicine(idx, 'dosage', e.target.value)}
                        className="flex-1 min-w-[100px] border-none bg-transparent text-sm px-2 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-primary rounded"
                      />
                      <input 
                        type="text" placeholder="Freq (e.g. 1-1-1)" 
                        value={item.frequency} onChange={e => updateMedicine(idx, 'frequency', e.target.value)}
                        className="flex-1 min-w-[90px] border-none bg-transparent text-sm px-2 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-primary rounded"
                      />
                      <input 
                        type="number" placeholder="Days" 
                        value={item.duration_days} onChange={e => updateMedicine(idx, 'duration_days', e.target.value)}
                        className="w-16 border-none bg-transparent text-sm px-2 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-primary rounded text-center"
                      />
                      <Button 
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMedicine(idx)}
                        className="text-muted hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                   </div>
                 ))}
                 
                 <Button variant="ghost" size="sm" onClick={addMedicineRow} className="text-primary font-bold">
                   <Plus className="w-4 h-4 mr-1" /> Add Medicine
                 </Button>
               </div>
             </div>

             <div className="flex justify-end pt-2">
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" /> Save Template
                </Button>
             </div>
          </div>
        </Card>

        {/* ── RIGHT: SAVED TEMPLATES ── */}
        <Card className="md:col-span-4 overflow-hidden flex flex-col h-full max-h-[70vh]">
           <div className="px-5 py-4 border-b border-border bg-warm-surface/50">
             <h2 className="font-bold text-ink text-sm uppercase tracking-wider heading-font">Saved Templates ({templates.length})</h2>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-50"/>
                  <p className="text-sm font-medium">No templates saved yet.</p>
                </div>
              ) : (
                templates.map(t => (
                  <div key={t.id} className={`border rounded-xl p-4 transition-all group ${currentTemplateId === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-warm-surface/50'}`}>
                    <div className="flex justify-between items-start mb-2">
                       <h3 className="font-bold text-ink text-sm">{t.name}</h3>
                       <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button variant="ghost" size="icon" onClick={() => handleEdit(t)} className="h-7 w-7 text-muted hover:text-primary">
                           <Edit2 className="w-3.5 h-3.5"/>
                         </Button>
                         <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} className="h-7 w-7 text-muted hover:text-rose-600">
                           <Trash2 className="w-3.5 h-3.5"/>
                         </Button>
                       </div>
                    </div>
                    
                    <div className="space-y-1">
                      {t.items?.slice(0, 3).map((item, idx) => (
                        <p key={idx} className="text-xs text-muted flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-primary/40"></span>
                          <span className="font-semibold text-ink">{item.medicine_name}</span> {item.dosage}
                        </p>
                      ))}
                      {t.items?.length > 3 && (
                        <p className="text-[10px] font-medium text-muted pl-2">+{t.items.length - 3} more...</p>
                      )}
                    </div>
                  </div>
                ))
              )}
           </div>
        </Card>
      </div>
    </div>
  );
}
