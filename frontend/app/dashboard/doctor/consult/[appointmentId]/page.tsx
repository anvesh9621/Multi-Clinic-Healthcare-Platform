"use client";

import { useEffect, useState, useContext, use } from "react";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  User, 
  Activity, 
  FileText, 
  Pill, 
  Plus, 
  Trash2, 
  Clock, 
  CheckCircle2,
  CalendarDays,
  Save,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

import { Appointment, MedicalRecord, PrescriptionItem, PrescriptionTemplate } from "@/types/api";

export default function ConsultPage(props: { params: Promise<{ appointmentId: string }> }) {
  const params = use(props.params);
  const { appointmentId } = params;
  const { user } = useContext(AuthContext);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Appointment/Patient context
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patientHistory, setPatientHistory] = useState<MedicalRecord[]>([]);

  // Form State
  const [symptoms, setSymptoms] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [doctorNotes, setDoctorNotes] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  
  // Vitals
  const [vitalsTemp, setVitalsTemp] = useState("");
  const [vitalsBp, setVitalsBp] = useState("");
  
  // Follow up
  const [followUpDate, setFollowUpDate] = useState("");

  // Prescription Items
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([
    { medicine_name: "", dosage: "", frequency: "", duration_days: 1, instructions: "" }
  ]);
  
  // Templates
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  useEffect(() => {
    if (user && user.role !== "DOCTOR") {
      router.push("/dashboard");
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, appointmentId]);

  const fetchData = async () => {
    try {
      const appResp = await apiClient.get(`/appointments/${appointmentId}/`);
      const appt = appResp.data;
      setAppointment(appt);

      if (appt.status === "SCHEDULED" || appt.status === "CONFIRMED") {
        try {
          await apiClient.patch(`/appointments/${appointmentId}/`, { status: "IN_PROGRESS" });
        } catch {
          // Non-fatal
        }
      }

      const histResp = await apiClient.get(`/records/history/patient/${appt.patient}/`);
      setPatientHistory(histResp.data);

      const tmplResp = await apiClient.get(`/records/templates/`);
      setTemplates(tmplResp.data.results || tmplResp.data);

    } catch (error) {
      console.error("Failed to load consult data:", error);
    } finally {
      setLoading(false);
    }
  };

  const addMedicineRow = () => {
    setPrescriptionItems([...prescriptionItems, { medicine_name: "", dosage: "", frequency: "", duration_days: "", instructions: "" }]);
  };

  const updateMedicine = (index: number, field: string, value: string) => {
    const newItems = [...prescriptionItems];
    newItems[index][field] = value;
    setPrescriptionItems(newItems);
  };

  const removeMedicine = (index: number) => {
    if (prescriptionItems.length === 1) return;
    const newItems = prescriptionItems.filter((_, i) => i !== index);
    setPrescriptionItems(newItems);
  };

  const applyTemplate = (templateId: number) => {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl || !tmpl.items?.length) return;
    
    const currentEmpty = prescriptionItems.length === 1 && !prescriptionItems[0].medicine_name;
    
    if (currentEmpty) {
      setPrescriptionItems([...tmpl.items]);
    } else {
      setPrescriptionItems([...prescriptionItems, ...tmpl.items]);
    }
    setShowTemplates(false);
  };

  const copyPreviousPrescription = (record: any) => {
    if (!record.prescriptions || record.prescriptions.length === 0) {
      return alert("No prescriptions found in this record.");
    }
    const pastItems = record.prescriptions[0].items || [];
    if (pastItems.length === 0) return;
    
    const currentEmpty = prescriptionItems.length === 1 && !prescriptionItems[0].medicine_name;
    if (currentEmpty) {
      setPrescriptionItems(pastItems.map((i: any) => ({...i, id: undefined})));
    } else {
      setPrescriptionItems([...prescriptionItems, ...pastItems.map((i: any) => ({...i, id: undefined}))]);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim()) return alert("Please enter a template name.");
    
    const validMeds = prescriptionItems.filter(p => p.medicine_name.trim() !== "");
    if (validMeds.length === 0) return alert("Please add at least one medicine to save a template.");

    try {
      const cleanMeds = validMeds.map(m => ({
        ...m,
        duration_days: parseInt(m.duration_days) || 1
      }));
      
      const resp = await apiClient.post(`/records/templates/`, {
        name: newTemplateName,
        items: cleanMeds
      });
      
      setTemplates([...templates, resp.data]);
      setIsSavingTemplate(false);
      setNewTemplateName("");
      alert("Template saved successfully!");
    } catch (error: any) {
      console.error("Failed to save template", error);
      alert(error.response?.data?.name?.[0] || "Failed to save template.");
    }
  };

  const handleFinishConsultation = async () => {
    setSaving(true);
    try {
      const recordPayload = {
        appointment: appointmentId,
        symptoms,
        diagnosis,
        doctor_notes: doctorNotes,
        private_notes: privateNotes,
        vitals_temperature: vitalsTemp ? parseFloat(vitalsTemp) : null,
        vitals_blood_pressure: vitalsBp,
      };
      
      const recordResp = await apiClient.post(`/records/consultation/`, recordPayload);
      const medicalRecordId = recordResp.data.id;

      const validMeds = prescriptionItems.filter(p => p.medicine_name.trim() !== "");
      if (validMeds.length > 0) {
        const cleanMeds = validMeds.map(m => ({
          ...m,
          duration_days: parseInt(m.duration_days) || 1
        }));
        
        await apiClient.post(`/records/prescriptions/`, {
          medical_record: medicalRecordId,
          items: cleanMeds
        });
      }

      await apiClient.patch(`/appointments/${appointmentId}/`, {
        status: "COMPLETED",
        follow_up_date: followUpDate || null
      });

      alert("Consultation finished and saved!");
      router.push("/dashboard/doctor");

    } catch (error) {
      console.error("Failed to save consultation:", error);
      alert("Error saving consultation. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-warm-surface/30">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const textareaClass = "w-full border border-border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-warm-surface text-ink text-sm font-medium transition shadow-sm resize-none";

  return (
    <div className="min-h-screen bg-warm-surface/30 -m-6 p-6">
      {/* ── HEADER ── */}
      <header className="bg-paper shadow-sm border border-border rounded-2xl p-4 flex items-center justify-between mb-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/doctor">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5 text-muted" />
            </Button>
          </Link>
          <div className="h-8 w-px bg-border"></div>
          <div>
            <h1 className="text-xl font-bold text-ink heading-font">{appointment?.patient_name || `Patient #${appointment?.patient}`}</h1>
            <p className="text-sm text-muted font-medium">{appointment?.reason || "General Consultation"} • Started {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
          </div>
        </div>
        
        <Button 
          onClick={handleFinishConsultation}
          disabled={saving}
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          Finish & Save
        </Button>
      </header>

      {/* ── 3-PANEL LAYOUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
        {/* PANEL 1: PATIENT CONTEXT (Left - 3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-6 h-full overflow-y-auto pb-6">
          <Card className="p-5 shrink-0">
            <h2 className="font-bold text-ink text-sm uppercase tracking-wider mb-4 flex items-center gap-2 heading-font">
              <User className="w-4 h-4 text-primary" /> Patient Profile
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-sm text-muted">ID</span>
                <span className="text-sm font-bold text-ink font-mono">PT-{appointment?.patient}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-sm text-muted">Age</span>
                <span className="text-sm font-semibold text-ink">Adult</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-sm text-muted">Gender</span>
                <span className="text-sm font-semibold text-ink">M</span>
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-sm text-muted">Known Allergies</span>
                <span className="text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-xl shrink-0">Penicillin, Peanuts</span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-ink text-sm uppercase tracking-wider mb-4 flex items-center gap-2 heading-font">
              <Activity className="w-4 h-4 text-accent" /> Today's Vitals
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted">Temp (°F)</label>
                <input 
                  type="number" step="0.1"
                  value={vitalsTemp} onChange={e => setVitalsTemp(e.target.value)}
                  className="w-full mt-1 border-b-2 border-border focus:border-primary pb-1 text-lg font-bold text-ink focus:outline-none bg-transparent"
                  placeholder="98.6"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted">Blood Pressure</label>
                <input 
                  type="text" 
                  value={vitalsBp} onChange={e => setVitalsBp(e.target.value)}
                  className="w-full mt-1 border-b-2 border-border focus:border-primary pb-1 text-lg font-bold text-ink focus:outline-none bg-transparent"
                  placeholder="120/80"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* PANEL 2: CONSULTATION FORM (Center - 6 cols) */}
        <Card className="lg:col-span-6 h-full overflow-y-auto custom-scrollbar p-0">
          <div className="p-6 border-b border-border">
             <h2 className="text-xl font-bold text-ink flex items-center gap-2 mb-6 heading-font">
                <FileText className="w-5 h-5 text-primary" /> Clinical Notes
             </h2>
             
             <div className="space-y-5">
               <div>
                  <label className="block text-sm font-bold text-ink mb-1">Chief Complaints / Symptoms</label>
                  <textarea 
                    value={symptoms}
                    onChange={e => setSymptoms(e.target.value)}
                    className={`${textareaClass} min-h-[100px]`}
                    placeholder="E.g. Fever for 3 days, body ache..."
                  />
               </div>
               
               <div>
                  <label className="block text-sm font-bold text-ink mb-1">Diagnosis</label>
                  <Input 
                    type="text"
                    value={diagnosis}
                    onChange={e => setDiagnosis(e.target.value)}
                    placeholder="E.g. Viral Pharyngitis"
                  />
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-bold text-ink mb-1">Rx Notes (Public)</label>
                    <textarea 
                      value={doctorNotes}
                      onChange={e => setDoctorNotes(e.target.value)}
                      className={`${textareaClass} min-h-[80px]`}
                      placeholder="Visible on prescription..."
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-rose-700 mb-1">Private Notes</label>
                    <textarea 
                      value={privateNotes}
                      onChange={e => setPrivateNotes(e.target.value)}
                      className="w-full border border-rose-200 bg-rose-50/50 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 min-h-[80px] text-sm text-ink font-medium placeholder:text-rose-400 shadow-sm resize-none"
                      placeholder="Only visible to clinic staff..."
                    />
                 </div>
               </div>
             </div>
          </div>

          <div className="p-6 bg-warm-surface/40 min-h-[300px]">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 relative">
               <h2 className="text-lg font-bold text-ink flex items-center gap-2 heading-font">
                  <Pill className="w-5 h-5 text-primary" /> Prescription
               </h2>
               
               <div className="flex items-center gap-3 relative">
                 {isSavingTemplate ? (
                   <div className="flex items-center gap-2 bg-paper px-2 py-1.5 rounded-lg border border-border shadow-sm">
                     <input 
                       type="text" 
                       placeholder="Template Name..." 
                       value={newTemplateName}
                       onChange={e => setNewTemplateName(e.target.value)}
                       className="text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary rounded border border-border bg-warm-surface text-ink"
                       autoFocus
                     />
                     <Button size="sm" onClick={handleSaveAsTemplate}>Save</Button>
                     <Button size="sm" variant="ghost" onClick={() => setIsSavingTemplate(false)}>Cancel</Button>
                   </div>
                 ) : (
                   <Button 
                     variant="ghost" 
                     size="sm"
                     onClick={() => setIsSavingTemplate(true)}
                     className="text-primary font-semibold"
                   >
                     <Save className="w-4 h-4 mr-1" /> Save as Template
                   </Button>
                 )}
                 
                 <div className="w-px h-5 bg-border"></div>

                 <Button 
                   variant="secondary"
                   size="sm"
                   onClick={() => setShowTemplates(!showTemplates)}
                 >
                   <Pill className="w-4 h-4 mr-1" /> Load Template
                 </Button>
                 
                 {showTemplates && (
                   <div className="absolute right-0 top-full mt-2 w-56 bg-paper border border-border shadow-xl rounded-xl overflow-hidden z-20">
                     <div className="bg-warm-surface px-3 py-2 border-b border-border font-bold text-xs text-muted uppercase tracking-wider">
                       My Templates
                     </div>
                     <div className="max-h-60 overflow-y-auto">
                       {templates.length === 0 ? (
                         <div className="p-4 text-center text-sm text-muted">No templates found. <br/><Link href="/dashboard/doctor/templates" className="text-primary font-semibold hover:underline mt-1 inline-block">Create one</Link></div>
                       ) : (
                         templates.map(t => (
                           <button 
                             key={t.id}
                             onClick={() => applyTemplate(t.id)}
                             className="w-full text-left px-4 py-3 hover:bg-warm-surface border-b border-border last:border-0 transition-colors"
                           >
                             <div className="font-semibold text-ink text-sm">{t.name}</div>
                             <div className="text-xs text-muted mt-0.5">{t.items?.length || 0} meds</div>
                           </button>
                         ))
                       )}
                     </div>
                   </div>
                 )}
               </div>
             </div>
             
             <div className="space-y-3">
               {prescriptionItems.map((item, idx) => (
                 <div key={idx} className="flex flex-wrap md:flex-nowrap gap-2 bg-paper p-2 rounded-xl border border-border shadow-sm items-center">
                    <input 
                      type="text" placeholder="Medicine Name" 
                      value={item.medicine_name} onChange={e => updateMedicine(idx, 'medicine_name', e.target.value)}
                      className="flex-[2] min-w-[140px] border-none bg-transparent text-sm font-semibold px-2 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-primary rounded"
                    />
                    <input 
                      type="text" placeholder="Dosage" 
                      value={item.dosage} onChange={e => updateMedicine(idx, 'dosage', e.target.value)}
                      className="flex-1 min-w-[80px] border-none bg-transparent text-sm px-2 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-primary rounded"
                    />
                    <input 
                      type="text" placeholder="Frequency" 
                      value={item.frequency} onChange={e => updateMedicine(idx, 'frequency', e.target.value)}
                      className="flex-1 min-w-[80px] border-none bg-transparent text-sm px-2 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-primary rounded"
                      title="e.g. 1-0-1 or Twice a day"
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
             
             <div className="mt-8 pt-6 border-t border-border flex items-center gap-4">
               <CalendarDays className="w-5 h-5 text-muted" />
               <div className="flex-1">
                  <label className="block text-sm font-bold text-ink mb-1">Follow-up Recommendation</label>
                  <Input 
                    type="date"
                    value={followUpDate}
                    onChange={e => setFollowUpDate(e.target.value)}
                    className="w-auto"
                  />
               </div>
             </div>
          </div>
        </Card>

        {/* PANEL 3: PATIENT HISTORY (Right - 3 cols) */}
        <Card className="lg:col-span-3 h-full overflow-hidden flex flex-col p-0">
          <div className="p-5 border-b border-border bg-warm-surface/50">
            <h2 className="font-bold text-ink text-sm uppercase tracking-wider flex items-center gap-2 heading-font">
              <Clock className="w-4 h-4 text-emerald-600" /> Past History
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {patientHistory.length === 0 ? (
              <p className="text-sm text-muted text-center mt-4">No previous records found.</p>
            ) : (
              patientHistory.map((record) => (
                <div key={record.id} className="border border-border rounded-xl p-4 hover:border-primary/30 transition-colors group bg-warm-surface/30">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-muted font-mono">{format(new Date(record.created_at), "MMM d, yyyy")}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full">Record</span>
                  </div>
                  <h3 className="text-sm font-bold text-ink mb-1">{record.diagnosis || "No specific diagnosis"}</h3>
                  <p className="text-xs text-muted line-clamp-2">{record.symptoms}</p>
                  
                  {record.prescriptions?.length > 0 && record.prescriptions[0].items?.length > 0 && (
                    <Button 
                      variant="secondary"
                      size="sm"
                      onClick={() => copyPreviousPrescription(record)}
                      className="w-full mt-3 text-xs"
                    >
                      <Pill className="w-3.5 h-3.5 mr-1" /> Copy Prescription
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
