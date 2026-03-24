from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.appointments.models import Appointment
from .models import Notification
from django.contrib.auth import get_user_model

@receiver(post_save, sender=Appointment)
def create_appointment_notification(sender, instance, created, **kwargs):
    User = get_user_model()
    
    # Pre-fetch clinic staff for shared notifications
    clinic_staff = []
    if getattr(instance, 'clinic', None):
        clinic_staff = User.objects.filter(
            clinic=instance.clinic,
            role__in=[User.RoleChoices.CLINIC_ADMIN, User.RoleChoices.RECEPTIONIST]
        )

    if created:
        # 1. Notify the doctor
        if instance.doctor_clinic and instance.doctor_clinic.doctor and instance.doctor_clinic.doctor.user:
            Notification.objects.create(
                recipient=instance.doctor_clinic.doctor.user,
                notification_type='APPOINTMENT',
                title='New Appointment Booked',
                message=f'A new appointment has been scheduled for {instance.appointment_date} at {instance.start_time.strftime("%I:%M %p")}.',
                related_link='/dashboard/doctor/schedule'
            )
        
        # 2. Notify the patient
        if instance.patient and getattr(instance.patient, 'user', None):
            msg = f'Your appointment is confirmed for {instance.appointment_date} at {instance.start_time.strftime("%I:%M %p")}.'
            Notification.objects.create(
                recipient=instance.patient.user,
                notification_type='APPOINTMENT',
                title='Appointment Confirmed',
                message=msg,
                related_link='/dashboard/history'
            )
            
            # Real Omnichannel
            from .utils import send_appointment_email, send_twilio_sms
            send_appointment_email(
                instance.patient.user.email, 
                "MediClinic: Appointment Confirmed", 
                msg
            )
            if instance.patient.phone:
                send_twilio_sms(instance.patient.phone, msg)
        
        # 3. Notify clinic staff (Admins and Receptionists)
        doctor_name = "Unknown"
        if instance.doctor_clinic and instance.doctor_clinic.doctor and instance.doctor_clinic.doctor.user:
            doctor_name = instance.doctor_clinic.doctor.user.get_full_name() or instance.doctor_clinic.doctor.user.email

        for staff in clinic_staff:
            link = '/dashboard/admin/schedules' if staff.role == User.RoleChoices.CLINIC_ADMIN else '/dashboard/receptionist/patients'
            Notification.objects.create(
                recipient=staff,
                notification_type='APPOINTMENT',
                title='New Appointment Booked',
                message=f'A new appointment was booked for Dr. {doctor_name} on {instance.appointment_date} at {instance.start_time.strftime("%I:%M %p")}.',
                related_link=link
            )

    else:
        # Status change notification
        if getattr(instance, 'status', None) == Appointment.StatusChoices.CANCELLED:
            # Notify Patient
            if instance.patient and getattr(instance.patient, 'user', None):
                Notification.objects.create(
                    recipient=instance.patient.user,
                    notification_type='APPOINTMENT',
                    title='Appointment Cancelled',
                    message=f'Your appointment on {instance.appointment_date} has been cancelled.',
                    related_link='/dashboard/history'
                )
            
            # Notify Doctor
            doctor_name = "Unknown"
            if instance.doctor_clinic and instance.doctor_clinic.doctor and instance.doctor_clinic.doctor.user:
                doctor_name = instance.doctor_clinic.doctor.user.get_full_name() or instance.doctor_clinic.doctor.user.email
                Notification.objects.create(
                    recipient=instance.doctor_clinic.doctor.user,
                    notification_type='APPOINTMENT',
                    title='Appointment Cancelled',
                    message=f'An appointment on {instance.appointment_date} has been cancelled.',
                    related_link='/dashboard/doctor/schedule'
                )
            
            # Notify Clinic Staff
            for staff in clinic_staff:
                link = '/dashboard/admin/schedules' if staff.role == User.RoleChoices.CLINIC_ADMIN else '/dashboard/receptionist/patients'
                Notification.objects.create(
                    recipient=staff,
                    notification_type='APPOINTMENT',
                    title='Appointment Cancelled',
                    message=f'An appointment for Dr. {doctor_name} on {instance.appointment_date} was cancelled.',
                    related_link=link
                )

                # Send real SMS/Email to patient on cancellation
                if instance.patient and getattr(instance.patient, 'user', None):
                    from .utils import send_appointment_email, send_twilio_sms
                    msg = f"Your appointment on {instance.appointment_date} has been cancelled."
                    send_appointment_email(instance.patient.user.email, "Appointment Cancelled", msg)
                    if instance.patient.phone:
                        send_twilio_sms(instance.patient.phone, msg)

