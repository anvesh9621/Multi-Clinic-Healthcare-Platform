"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { JitsiMeeting } from "@jitsi/react-sdk";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { getAppointmentById } from "@/services/appointments";
import { toast } from "react-hot-toast";

export default function TelemedicineRoom() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = Number(params?.id);
  
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appointmentId) return;
    
    // Quick fetch for the appointment to get meeting link or room ID
    getAppointmentById(appointmentId)
      .then((data: any) => {
        setAppointment(data);
        if (!data.is_virtual) {
          toast.error("This is an in-person appointment.");
          router.push("/dashboard");
        }
      })
      .catch((err: any) => {
        console.error(err);
        toast.error("Failed to load appointment details.");
      })
      .finally(() => setLoading(false));
  }, [appointmentId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          <p className="text-gray-500 font-medium">Entering secure virtual room...</p>
        </div>
      </div>
    );
  }

  if (!appointment) return null;

  // The backend generates links like https://meet.jit.si/mediclinic-{room_id}
  // We can parse the roomName straight from the link
  const link = appointment.meeting_link;
  const roomName = link ? link.split("meet.jit.si/")[1] : `mediclinic-backup-${appointmentId}`;

  return (
    <div className="h-[calc(100vh-64px)] w-full flex flex-col bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 py-3 px-6 flex items-center justify-between text-white">
        <div>
          <h2 className="font-semibold text-lg">Virtual Consultation</h2>
          <p className="text-gray-400 text-sm">Doctor: {appointment.doctor_name}</p>
        </div>
        <button 
          onClick={() => router.back()}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors text-sm"
        >
          Leave Call
        </button>
      </div>
      
      <div className="flex-1 w-full bg-black relative">
        <JitsiMeeting
          domain="meet.jit.si"
          roomName={roomName}
          configOverwrite={{
            startWithAudioMuted: true,
            disableModeratorIndicator: true,
            prejoinPageEnabled: false,
            disableDeepLinking: true,
          }}
          interfaceConfigOverwrite={{
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            HIDE_INVITE_MORE_HEADER: true,
          }}
          userInfo={{
            displayName: "Patient",
            email: "patient@mediclinic.com"
          }}
          onApiReady={(externalApi) => {
            // Can add listeners here
          }}
          getIFrameRef={(iframeRef) => {
            iframeRef.style.height = '100%';
            iframeRef.style.width = '100%';
          }}
        />
      </div>
    </div>
  );
}
