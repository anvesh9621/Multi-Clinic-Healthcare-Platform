from django.db import transaction
from django.utils import timezone
from datetime import datetime

from .models import Appointment
from apps.doctors.models import DoctorSchedule

from datetime import datetime, timedelta
from django.utils.timezone import make_aware
from .models import Appointment
from apps.doctors.models import DoctorSchedule, DoctorClinic, DoctorLeave



def book_appointment(
    *,
    clinic,
    doctor_clinic,
    patient,
    created_by,
    appointment_date,
    start_time,
    end_time,
    reason=None,
):
    """
    Books appointment with full validation.
    Database-level overlap protection handles race conditions.
    """

    # Step 1: Validate doctor schedule and leaves for that day

    # Check for leaves
    leave_exists = DoctorLeave.objects.filter(
        doctor_clinic=doctor_clinic,
        start_date__lte=appointment_date,
        end_date__gte=appointment_date,
    ).exists()

    if leave_exists:
        raise ValueError("Doctor is on leave on this day.")

    weekday = appointment_date.weekday()

    schedule = DoctorSchedule.objects.filter(
        doctor_clinic=doctor_clinic,
        day_of_week=weekday
    ).first()

    if not schedule:
        raise ValueError("Doctor is not available on this day.")

    # Step 2: Validate time is within schedule
    start_datetime_naive = datetime.combine(appointment_date, start_time)
    end_datetime_naive = start_datetime_naive + timedelta(minutes=schedule.slot_duration)
    end_time_actual = end_datetime_naive.time()

    if not (schedule.start_time <= start_time and end_time_actual <= schedule.end_time):
        raise ValueError("Appointment time outside doctor's schedule.")

    # Step 3: Validate slot alignment
    total_minutes = (
        start_datetime_naive
        - datetime.combine(appointment_date, schedule.start_time)
    ).total_seconds() / 60

    if total_minutes % schedule.slot_duration != 0:
        raise ValueError("Invalid slot alignment.")

    # Step 4: Construct datetime range
    start_datetime = make_aware(start_datetime_naive)
    end_datetime = make_aware(end_datetime_naive)

    # Step 5: Save inside atomic transaction
    with transaction.atomic():
        appointment = Appointment.objects.create(
            clinic=clinic,
            doctor_clinic=doctor_clinic,
            patient=patient,
            created_by=created_by,
            appointment_date=appointment_date,
            start_time=start_time,
            end_time=end_time_actual,
            time_range=(start_datetime, end_datetime),
            reason=reason,
        )

    return appointment




def reschedule_appointment(*, appointment, new_date, new_start_time, new_end_time, reason=None, user=None):
    """
    Validates and performs an appointment reschedule.
    """
    doctor_clinic = appointment.doctor_clinic
    
    # Validation step: Cannot reschedule completed or cancelled appts
    if appointment.status in [Appointment.StatusChoices.COMPLETED, Appointment.StatusChoices.CANCELLED]:
        raise ValueError("Cannot reschedule a completed or cancelled appointment.")
        
    # Validation step: Check leaves
    leave_exists = DoctorLeave.objects.filter(
        doctor_clinic=doctor_clinic,
        start_date__lte=new_date,
        end_date__gte=new_date,
    ).exists()

    if leave_exists:
        raise ValueError("Doctor is on leave on this day.")

    weekday = new_date.weekday()
    schedule = DoctorSchedule.objects.filter(
        doctor_clinic=doctor_clinic,
        day_of_week=weekday
    ).first()

    if not schedule:
        raise ValueError("Doctor is not available on this day.")

    # Validation step: Check if time is within schedule
    start_datetime_naive = datetime.combine(new_date, new_start_time)
    end_datetime_naive = start_datetime_naive + timedelta(minutes=schedule.slot_duration)
    actual_new_end_time = end_datetime_naive.time()

    if not (schedule.start_time <= new_start_time and actual_new_end_time <= schedule.end_time):
        raise ValueError("Appointment time outside doctor's schedule.")

    # Validation step: Check slot alignment
    total_minutes = (
        datetime.combine(new_date, new_start_time)
        - datetime.combine(new_date, schedule.start_time)
    ).total_seconds() / 60

    if total_minutes % schedule.slot_duration != 0:
        raise ValueError("Invalid slot alignment.")

    start_datetime = make_aware(start_datetime_naive)
    end_datetime = make_aware(end_datetime_naive)

    with transaction.atomic():
        appointment.appointment_date = new_date
        appointment.start_time = new_start_time
        appointment.end_time = actual_new_end_time
        appointment.time_range = (start_datetime, end_datetime)
        
        # Depending on workflow, rescheduling might flip status back to scheduled
        if appointment.status == Appointment.StatusChoices.IN_PROGRESS:
             raise ValueError("Cannot reschedule an in-progress appointment.")
             
        # Reset to scheduled in case it was confirmed or no-show
        appointment.status = Appointment.StatusChoices.SCHEDULED
        
        if reason:
            appointment.reason = reason
            
        appointment.save()

    return appointment

def notify_running_late(*, doctor_clinic, delay_minutes, user=None):
    """
    Simulates sending an SMS/Email to all patients waiting on this day.
    """
    today = timezone.localtime().date()
    now_time = timezone.localtime().time()
    
    upcoming_appointments = Appointment.objects.filter(
        doctor_clinic=doctor_clinic,
        appointment_date=today,
        start_time__gte=now_time,
        status__in=[Appointment.StatusChoices.SCHEDULED, Appointment.StatusChoices.CONFIRMED]
    ).select_related("patient__user", "clinic")
    
    count = 0
    from apps.notifications.utils import send_appointment_email, send_twilio_sms
    
    for app in upcoming_appointments:
        patient_email = app.patient.user.email
        patient_phone = app.patient.phone
        clinic_name = app.clinic.name
        doctor_last_name = doctor_clinic.doctor.user.last_name
        
        msg = f"Hi {app.patient.user.first_name}, due to unforeseen circumstances, Dr. {doctor_last_name} at {clinic_name} is running approximately {delay_minutes} minutes late. Your appointment scheduled for {app.start_time.strftime('%H:%M')} will be slightly delayed. We appreciate your patience."

        send_appointment_email(patient_email, "MediClinic: Appointment Delay Notice", msg)
        
        if patient_phone:
            send_twilio_sms(patient_phone, msg)
        
        count += 1
        
    return count

# Transition Logic

def change_appointment_status(*, appointment, new_status, user, follow_up_date=None):
    """
    Handles controlled status transitions.
    """

    allowed_transitions = {
        "SCHEDULED": ["CONFIRMED", "CANCELLED", "IN_PROGRESS"],
        "CONFIRMED": ["COMPLETED", "CANCELLED", "NO_SHOW", "IN_PROGRESS"],
        "IN_PROGRESS": ["COMPLETED"],
        "COMPLETED": [],
        "CANCELLED": [],
        "NO_SHOW": [],
    }

    current_status = appointment.status

    if new_status not in allowed_transitions.get(current_status, []):
        raise ValueError(
            f"Invalid transition from {current_status} to {new_status}"
        )

    appointment.status = new_status
    
    update_fields = ["status"]
    
    if follow_up_date:
        appointment.follow_up_date = follow_up_date
        update_fields.append("follow_up_date")
        
    appointment.save(update_fields=update_fields)

    return appointment


def get_available_slots(*, doctor_clinic_id, date):
    """
    Returns available time slots for a doctor on a given date.
    """

    doctor_clinic = DoctorClinic.objects.get(id=doctor_clinic_id)

    # Check leaves first
    leave_exists = DoctorLeave.objects.filter(
        doctor_clinic=doctor_clinic,
        start_date__lte=date,
        end_date__gte=date,
    ).exists()

    if leave_exists:
        return []

    weekday = date.weekday()  # 0 = Monday

    schedule = DoctorSchedule.objects.filter(
        doctor_clinic=doctor_clinic,
        day_of_week=weekday,
    ).first()

    if not schedule:
        return []

    start = schedule.start_time
    end = schedule.end_time
    slot_duration = schedule.slot_duration

    current_time = datetime.combine(date, start)
    end_time = datetime.combine(date, end)

    all_slots = []

    while current_time + timedelta(minutes=slot_duration) <= end_time:
        all_slots.append(current_time.time())
        current_time += timedelta(minutes=slot_duration)

    # Fetch existing appointments
    booked_appointments = Appointment.objects.filter(
        doctor_clinic=doctor_clinic,
        appointment_date=date,
    ).values_list("start_time", flat=True)

    available_slots = [
        slot.strftime("%H:%M")
        for slot in all_slots
        if slot not in booked_appointments
    ]

    return available_slots


