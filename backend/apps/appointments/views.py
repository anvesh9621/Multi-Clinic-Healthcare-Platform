from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import ListAPIView, UpdateAPIView, RetrieveAPIView
from rest_framework.exceptions import PermissionDenied, NotFound
from rest_framework.permissions import IsAuthenticated
from datetime import datetime

from .serializers import (
    AppointmentBookingSerializer,
    AppointmentListSerializer,
    AppointmentStatusUpdateSerializer,
    ReceptionistAppointmentBookingSerializer,
    AppointmentRescheduleSerializer,
    RunningLateSerializer,
)
from .services import (
    book_appointment,
    change_appointment_status,
    get_available_slots,
    reschedule_appointment,
    notify_running_late,
)
from .models import Appointment

from apps.doctors.models import DoctorClinic
from apps.patients.models import Patient
from apps.accounts.permissions import IsPatient, IsDoctor, IsClinicAdminOrReceptionist
from apps.audit.services import log_action
from apps.audit.models import AuditLog


class BookAppointmentView(APIView):
    permission_classes = [IsPatient]

    def post(self, request):
        serializer = AppointmentBookingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        doctor_clinic = DoctorClinic.objects.get(id=data["doctor_clinic_id"])
        clinic = doctor_clinic.clinic
        patient = Patient.objects.get(user=request.user)

        if doctor_clinic.clinic_id != clinic.id:
            raise ValueError("Doctor does not belong to this clinic.")

        import traceback
        try:
            appointment = book_appointment(
                clinic=clinic,
                doctor_clinic=doctor_clinic,
                patient=patient,
                created_by=request.user,
                appointment_date=data["appointment_date"],
                start_time=data["start_time"],
                end_time=data["end_time"],
                reason=data.get("reason"),
            )
        except Exception as e:
            return Response({"detail": f"Server Error: {str(e)}", "trace": traceback.format_exc()}, status=status.HTTP_400_BAD_REQUEST)

        log_action(
            user=request.user,
            clinic=clinic,
            action_type=AuditLog.ActionChoices.BOOK,
            object_type="Appointment",
            object_id=appointment.id,
            description="Appointment booked",
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response(
            {
                "success": True,
                "appointment_id": appointment.id,
            },
            status=status.HTTP_201_CREATED,
        )


class ReceptionistBookAppointmentView(APIView):
    permission_classes = [IsClinicAdminOrReceptionist]

    def post(self, request):
        serializer = ReceptionistAppointmentBookingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        doctor_clinic = DoctorClinic.objects.get(id=data["doctor_clinic_id"])
        clinic = doctor_clinic.clinic
        
        # Verify the clinic matches the receptionist's clinic
        if clinic != request.user.clinic:
            raise ValueError("Doctor does not belong to your clinic.")

        # Find the patient requested. We fetch by ID to allow booking for any patient in the DB.
        patient = Patient.objects.get(id=data["patient_id"])

        appointment = book_appointment(
            clinic=clinic,
            doctor_clinic=doctor_clinic,
            patient=patient,
            created_by=request.user,
            appointment_date=data["appointment_date"],
            start_time=data["start_time"],
            end_time=data["end_time"],
            reason=data.get("reason"),
        )

        log_action(
            user=request.user,
            clinic=clinic,
            action_type=AuditLog.ActionChoices.BOOK,
            object_type="Appointment",
            object_id=appointment.id,
            description=f"Appointment booked for Patient {patient.user.email} by Reception",
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response(
            {
                "success": True,
                "appointment_id": appointment.id,
                "message": "Appointment booked successfully by Receptionist.",
            },
            status=status.HTTP_201_CREATED,
        )


class AppointmentListView(ListAPIView):
    serializer_class = AppointmentListSerializer

    def get_queryset(self):
        user = self.request.user

        if user.role == "SUPER_ADMIN":
            return Appointment.objects.all()

        if user.role == "PATIENT":
            return Appointment.objects.filter(patient__user=user)

        if user.role == "DOCTOR":
            return Appointment.objects.filter(
                doctor_clinic__doctor__user=user
            )

        if user.role in ["CLINIC_ADMIN", "RECEPTIONIST"]:
            return Appointment.objects.filter(clinic=user.clinic)

        return Appointment.objects.none()


class AppointmentDetailView(APIView):
    """
    GET  /appointments/<pk>/  — Retrieve a single appointment's full detail.
    PATCH /appointments/<pk>/ — Update status and/or follow_up_date.
    """
    permission_classes = [IsAuthenticated]

    def _get_appointment(self, pk, user):
        appointment = Appointment.objects.filter(id=pk).first()
        if not appointment:
            raise NotFound("Appointment not found.")

        # Permission check
        if user.role == "SUPER_ADMIN":
            return appointment
        if user.role == "PATIENT" and appointment.patient.user != user:
            raise PermissionDenied("Unauthorized access.")
        if user.role == "DOCTOR" and appointment.doctor_clinic.doctor.user != user:
            raise PermissionDenied("Unauthorized access.")
        if user.role in ["CLINIC_ADMIN", "RECEPTIONIST"] and appointment.clinic != user.clinic:
            raise PermissionDenied("Unauthorized access.")

        return appointment

    def get(self, request, pk):
        appointment = self._get_appointment(pk, request.user)
        serializer = AppointmentListSerializer(appointment)
        return Response(serializer.data)

    def patch(self, request, pk):
        appointment = self._get_appointment(pk, request.user)

        # Allow updating status and follow_up_date
        new_status = request.data.get("status")
        follow_up_date = request.data.get("follow_up_date")

        if new_status:
            valid_statuses = [c[0] for c in Appointment.StatusChoices.choices]
            if new_status not in valid_statuses:
                return Response({"error": f"Invalid status '{new_status}'."}, status=status.HTTP_400_BAD_REQUEST)
            updated = change_appointment_status(
                appointment=appointment,
                new_status=new_status,
                user=request.user,
                follow_up_date=follow_up_date,
            )
        elif follow_up_date is not None:
            appointment.follow_up_date = follow_up_date or None
            appointment.save(update_fields=["follow_up_date"])
            updated = appointment
        else:
            updated = appointment

        serializer = AppointmentListSerializer(updated)
        return Response(serializer.data)


class AppointmentStatusUpdateView(UpdateAPIView):
    serializer_class = AppointmentStatusUpdateSerializer
    queryset = Appointment.objects.all()

    def get_object(self):
        appointment = super().get_object()
        user = self.request.user

        if user.role == "SUPER_ADMIN":
            return appointment

        if user.role == "PATIENT":
            if appointment.patient.user != user:
                raise PermissionDenied("Unauthorized access.")

        elif user.role == "DOCTOR":
            if appointment.doctor_clinic.doctor.user != user:
                raise PermissionDenied("Unauthorized access.")

        elif user.role in ["CLINIC_ADMIN", "RECEPTIONIST"]:
            if appointment.clinic != user.clinic:
                raise PermissionDenied("Unauthorized access.")

        return appointment

    def patch(self, request, *args, **kwargs):
        appointment = self.get_object()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_appointment = change_appointment_status(
            appointment=appointment,
            new_status=serializer.validated_data["status"],
            user=request.user,
            follow_up_date=serializer.validated_data.get("follow_up_date")
        )

        log_action(
            user=request.user,
            clinic=updated_appointment.clinic,
            action_type=AuditLog.ActionChoices.UPDATE,
            object_type="Appointment",
            object_id=updated_appointment.id,
            description=f"Status changed to {updated_appointment.status}",
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response(
            {
                "success": True,
                "status": updated_appointment.status,
            }
        )


class SlotAvailabilityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        doctor_clinic_id = request.query_params.get("doctor_clinic_id")
        date_str = request.query_params.get("date")

        if not doctor_clinic_id or not date_str:
            raise ValueError("doctor_clinic_id and date are required.")

        date = datetime.strptime(date_str, "%Y-%m-%d").date()

        slots = get_available_slots(
            doctor_clinic_id=int(doctor_clinic_id),
            date=date,
        )

        return Response(
            {
                "success": True,
                "available_slots": slots,
            }
        )


class DoctorRescheduleAppointmentView(APIView):
    permission_classes = [IsDoctor]

    def post(self, request, pk):
        appointment = Appointment.objects.filter(id=pk).first()
        if not appointment:
            return Response({"error": "Appointment not found."}, status=status.HTTP_404_NOT_FOUND)
            
        if appointment.doctor_clinic.doctor.user != request.user:
            raise PermissionDenied("You can only reschedule your own appointments.")

        serializer = AppointmentRescheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            rescheduled = reschedule_appointment(
                appointment=appointment,
                new_date=data["appointment_date"],
                new_start_time=data["start_time"],
                new_end_time=data["end_time"],
                reason=data.get("reason"),
                user=request.user
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        log_action(
            user=request.user,
            clinic=rescheduled.clinic,
            action_type=AuditLog.ActionChoices.UPDATE,
            object_type="Appointment",
            object_id=rescheduled.id,
            description="Appointment rescheduled by doctor",
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response({"success": True, "message": "Appointment rescheduled successfully"})


class DoctorRunningLateView(APIView):
    permission_classes = [IsDoctor]

    def post(self, request):
        serializer = RunningLateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        doctor_clinic = DoctorClinic.objects.filter(doctor__user=request.user).first()
        if not doctor_clinic:
             return Response({"error": "No clinic association found."}, status=status.HTTP_400_BAD_REQUEST)

        delay = serializer.validated_data["delay_minutes"]
        count = notify_running_late(doctor_clinic=doctor_clinic, delay_minutes=delay, user=request.user)

        return Response({
            "success": True, 
            "message": f"Delay notifications sent to {count} patient(s)."
        })



