from django.utils import timezone
from datetime import timedelta
from django.db.models import Count, Q
from apps.appointments.models import Appointment
from apps.patients.models import Patient
from apps.doctors.models import DoctorClinic


def get_clinic_dashboard_stats(clinic):

    today = timezone.now().date()
    week_start = today - timedelta(days=7)

    appt_stats = Appointment.objects.filter(clinic=clinic).aggregate(
        appointments_today=Count("id", filter=Q(appointment_date=today)),
        appointments_this_week=Count("id", filter=Q(appointment_date__gte=week_start)),
        completed_today=Count("id", filter=Q(appointment_date=today, status="COMPLETED")),
        cancelled_today=Count("id", filter=Q(appointment_date=today, status="CANCELLED")),
    )

    total_patients = Patient.objects.filter(
        appointments__clinic=clinic
    ).distinct().count()

    total_doctors = DoctorClinic.objects.filter(
        clinic=clinic
    ).distinct().count()

    return {
        "appointments_today": appt_stats["appointments_today"],
        "appointments_this_week": appt_stats["appointments_this_week"],
        "completed_today": appt_stats["completed_today"],
        "cancelled_today": appt_stats["cancelled_today"],
        "total_patients": total_patients,
        "total_doctors": total_doctors,
    }


def get_doctor_workload(clinic):

    workload = (
        Appointment.objects.filter(clinic=clinic)
        .values(
            "doctor_clinic__doctor__user__email"
        )
        .annotate(total_appointments=Count("id"))
        .order_by("-total_appointments")
    )

    results = []

    for item in workload:
        results.append({
            "doctor": item["doctor_clinic__doctor__user__email"],
            "appointments": item["total_appointments"]
        })

    return results



def get_appointment_trend(clinic):

    today = timezone.now().date()
    start_date = today - timedelta(days=6)

    queryset = (
        Appointment.objects
        .filter(
            clinic=clinic,
            appointment_date__gte=start_date
        )
        .values("appointment_date")
        .annotate(total=Count("id"))
        .order_by("appointment_date")
    )

    results = []

    for i in range(7):
        date = start_date + timedelta(days=i)

        match = next(
            (x for x in queryset if x["appointment_date"] == date),
            None
        )

        results.append({
            "date": date.strftime("%Y-%m-%d"),
            "appointments": match["total"] if match else 0
        })

    return results