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
  Save
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default function ConsultPage(props: { params: Promise<{ appointmentId: string }> }) {
  const params = use(props.params);
  const { appointmentId } = params;
  const { user } = useContext(AuthContext);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Appointment/Patient context
  const [appointment, setAppointment] = useState<any>(null);
  const [patientHistory, setPatientHistory] = useState<any[]>([]);

  // Form State
  const [symptoms, setSymptoms] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [doctorNotes, setDoctorNotes] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  
  // Vitals (Could be pre-filled by receptionist)
  const [vitalsTemp, setVitalsTemp] = useState("");
  const [vitalsBp, setVitalsBp] = useState("");
  
  // Follow up
  const [followUpDate, setFollowUpDate] = useState("");

  // Prescription Items
  const [prescriptionItems, setPrescriptionItems] = useState<any[]>([
    { medicine_name: "", dosage: "", frequency: "", duration_days: "", instructions: "" }
  ]);
  
  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  useEffect(() => {
    if (user && user.role !== "DOCTOR") {
      router.push("/dashboard");
      return;
    }
    fetchData();
  }, [user, appointmentId]);

  const fetchData = async () => {
    try {
      // 1. Fetch the appointment details
      const appResp = await apiClient.get(`/appointments/${appointmentId}/`);
      const appt = appResp.data;
      setAppointment(appt);

      // 2. Mark as IN_PROGRESS if it's still SCHEDULED or CONFIRMED
      if (appt.status === "SCHEDULED" || appt.status === "CONFIRMED") {
        try {
          await apiClient.patch(`/appointments/${appointmentId}/`, { status: "IN_PROGRESS" });
        } catch {
          // Non-fatal – may already be IN_PROGRESS on page refresh
        }
      }

      // 3. Fetch patient history
      const histResp = await apiClient.get(`/records/history/patient/${appt.patient}/`);
      setPatientHistory(histResp.data);

      // 4. Fetch Rx Templates for the dropdown
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
    
    // Replace current items if empty, otherwise append
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
      // 1. Save Medical Record
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

      // 2. Save Prescription (if any items have a name)
      const validMeds = prescriptionItems.filter(p => p.medicine_name.trim() !== "");
      if (validMeds.length > 0) {
        // Backend duration_days expects integer
        const cleanMeds = validMeds.map(m => ({
          ...m,
          duration_days: parseInt(m.duration_days) || 1
        }));
        
        await apiClient.post(`/records/prescriptions/`, {
          medical_record: medicalRecordId,
          items: cleanMeds
        });
      }

      // 3. Mark appointment complete (and save follow-up if set)
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

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 -m-6 p-6">
      
      {/* ── HEADER ── */}
      <header className="bg-white shadow-sm border border-gray-100 rounded-2xl p-4 flex items-center justify-between mb-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/doctor" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="h-8 w-px bg-gray-200"></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{appointment?.patient_name || `Patient #${appointment?.patient}`}</h1>
            <p className="text-sm text-gray-500 font-medium">{appointment?.reason || "General Consultation"} • Started {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
          </div>
        </div>
        
        <button 
          onClick={handleFinishConsultation}
          disabled={saving}
          className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl font-semibold shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle2 className="w-4 h-4" />}
          Finish & Save
        </button>
      </header>

      {/* ── 3-PANEL LAYOUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
        
        {/* PANEL 1: PATIENT CONTEXT (Left - 3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-6 h-full overflow-y-auto pb-6">
          
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm shrink-0">
            <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" /> Patient Profile
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-sm text-gray-500">ID</span>
                <span className="text-sm font-medium text-gray-900">PT-{appointment?.patient}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-sm text-gray-500">Age</span>
                <span className="text-sm font-medium text-gray-900">Adult</span> {/* Requires backend age field */}
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-sm text-gray-500">Gender</span>
                <span className="text-sm font-medium text-gray-900">M</span> {/* Requires backend gender */}
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-sm text-gray-500">Known Allergies</span>
                <span className="text-sm font-medium text-red-600 bg-red-50 p-2 rounded shrink-0">Penicillin, Peanuts</span> {/* Mock */}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-500" /> Today's Vitals
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500">Temp (°F)</label>
                <input 
                  type="number" step="0.1"
                  value={vitalsTemp} onChange={e => setVitalsTemp(e.target.value)}
                  className="w-full mt-1 border-b-2 border-gray-100 focus:border-blue-500 pb-1 text-lg font-medium text-gray-900 focus:outline-none bg-transparent"
                  placeholder="98.6"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Blood Pressure</label>
                <input 
                  type="text" 
                  value={vitalsBp} onChange={e => setVitalsBp(e.target.value)}
                  className="w-full mt-1 border-b-2 border-gray-100 focus:border-blue-500 pb-1 text-lg font-medium text-gray-900 focus:outline-none bg-transparent"
                  placeholder="120/80"
                />
              </div>
            </div>
          </div>
          
        </div>

        {/* PANEL 2: CONSULTATION FORM (Center - 6 cols) */}
        <div className="lg:col-span-6 bg-white border border-gray-100 rounded-2xl shadow-sm h-full overflow-y-auto custom-scrollbar">
          
          <div className="p-6 border-b border-gray-100">
             <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-blue-600" /> Clinical Notes
             </h2>
             
             <div className="space-y-5">
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Chief Complaints / Symptoms</label>
                  <textarea 
                    value={symptoms}
                    onChange={e => setSymptoms(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] text-sm"
                    placeholder="E.g. Fever for 3 days, body ache..."
                  />
               </div>
               
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Diagnosis</label>
                  <input 
                    type="text"
                    value={diagnosis}
                    onChange={e => setDiagnosis(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                    placeholder="E.g. Viral Pharyngitis"
                  />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Rx Notes (Public)</label>
                    <textarea 
                      value={doctorNotes}
                      onChange={e => setDoctorNotes(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] text-sm"
                      placeholder="Visible on prescription..."
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-red-700 mb-1">Private Notes</label>
                    <textarea 
                      value={privateNotes}
                      onChange={e => setPrivateNotes(e.target.value)}
                      className="w-full border border-red-200 bg-red-50/30 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[80px] text-sm placeholder:text-red-300"
                      placeholder="Only visible to clinic staff..."
                    />
                 </div>
               </div>
             </div>
          </div>

          <div className="p-6 bg-blue-50/30 min-h-[300px]">
             <div className="flex justify-between items-center mb-4 relative">
               <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-blue-600" /> Prescription
               </h2>
               
               <div className="flex items-center gap-3 relative">
                 {isSavingTemplate ? (
                   <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-lg border border-indigo-200 shadow-sm">
                     <input 
                       type="text" 
                       placeholder="Template Name..." 
                       value={newTemplateName}
                       onChange={e => setNewTemplateName(e.target.value)}
                       className="text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded border border-gray-100"
                       autoFocus
                     />
                     <button onClick={handleSaveAsTemplate} className="text-xs font-bold text-indigo-700 hover:text-indigo-900 px-2 py-1 bg-indigo-50 rounded">Save</button>
                     <button onClick={() => setIsSavingTemplate(false)} className="text-xs text-gray-500 hover:text-gray-700 px-1">Cancel</button>
                   </div>
                 ) : (
                   <button 
                     onClick={() => setIsSavingTemplate(true)}
                     className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                   >
                     <Save className="w-4 h-4" /> Save as Template
                   </button>
                 )}
                 
                 <div className="w-px h-5 bg-blue-200"></div>

                 <button 
                   onClick={() => setShowTemplates(!showTemplates)}
                   className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors border border-blue-100"
                 >
                   <Pill className="w-4 h-4" /> Load Template
                 </button>
                 
                 {showTemplates && (
                   <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden z-20">
                     <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 font-bold text-xs text-gray-500 uppercase tracking-wider">
                       My Templates
                     </div>
                     <div className="max-h-60 overflow-y-auto">
                       {templates.length === 0 ? (
                         <div className="p-4 text-center text-sm text-gray-400">No templates found. <br/><Link href="/dashboard/doctor/templates" className="text-blue-600 font-semibold hover:underline mt-1 inline-block">Create one</Link></div>
                       ) : (
                         templates.map(t => (
                           <button 
                             key={t.id}
                             onClick={() => applyTemplate(t.id)}
                             className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors"
                           >
                             <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                             <div className="text-xs text-gray-500 mt-0.5">{t.items?.length || 0} meds</div>
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
                 <div key={idx} className="flex flex-wrap md:flex-nowrap gap-2 bg-white p-2 rounded-lg border border-blue-100 shadow-sm items-center">
                    <input 
                      type="text" placeholder="Medicine Name" 
                      value={item.medicine_name} onChange={e => updateMedicine(idx, 'medicine_name', e.target.value)}
                      className="flex-[2] min-w-[140px] border-none bg-transparent text-sm font-medium px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                    />
                    <input 
                      type="text" placeholder="Dosage" 
                      value={item.dosage} onChange={e => updateMedicine(idx, 'dosage', e.target.value)}
                      className="flex-1 min-w-[80px] border-none bg-transparent text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                    />
                    <input 
                      type="text" placeholder="Frequency" 
                      value={item.frequency} onChange={e => updateMedicine(idx, 'frequency', e.target.value)}
                      className="flex-1 min-w-[80px] border-none bg-transparent text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                      title="e.g. 1-0-1 or Twice a day"
                    />
                    <input 
                      type="number" placeholder="Days" 
                      value={item.duration_days} onChange={e => updateMedicine(idx, 'duration_days', e.target.value)}
                      className="w-16 border-none bg-transparent text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded text-center"
                    />
                    <button 
                      onClick={() => removeMedicine(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
               ))}
               
               <button onClick={addMedicineRow} className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1">
                 <Plus className="w-4 h-4" /> Add Medicine
               </button>
             </div>
             
             <div className="mt-8 pt-6 border-t border-gray-200/60 flex items-center gap-4">
               <CalendarDays className="w-5 h-5 text-gray-400" />
               <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Follow-up Recommendation</label>
                  <input 
                    type="date"
                    value={followUpDate}
                    onChange={e => setFollowUpDate(e.target.value)}
                    className="border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
               </div>
             </div>
          </div>
        </div>

        {/* PANEL 3: PATIENT HISTORY (Right - 3 cols) */}
        <div className="lg:col-span-3 bg-white border border-gray-100 rounded-2xl shadow-sm h-full overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" /> Past History
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {patientHistory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center mt-4">No previous records found.</p>
            ) : (
              patientHistory.map((record) => (
                <div key={record.id} className="border border-gray-100 rounded-xl p-4 hover:border-blue-200 transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-gray-500">{format(new Date(record.created_at), "MMM d, yyyy")}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">Record</span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">{record.diagnosis || "No specific diagnosis"}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2">{record.symptoms}</p>
                  
                  <button className="w-full mt-3 py-1.5 bg-gray-50 text-blue-600 text-xs font-semibold rounded group-hover:bg-blue-50 transition-colors">
                    View Details
                  </button>
                  {record.prescriptions?.length > 0 && record.prescriptions[0].items?.length > 0 && (
                    <button 
                      onClick={() => copyPreviousPrescription(record)}
                      className="w-full mt-2 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded group-hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1"
                    >
                      <Pill className="w-3.5 h-3.5" /> Copy Prescription
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
