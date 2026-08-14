import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.utils import timezone

from django.utils.timezone import make_aware

from apps.accounts.models import User
from apps.appointments.models import Appointment
from apps.billing.models import Invoice
from apps.clinics.models import Clinic
from apps.core.factories import (
    AppointmentFactory,
    ClinicAdminFactory,
    ClinicFactory,
    DoctorClinicFactory,
    DoctorFactory,
    DoctorProfileFactory,
    DoctorScheduleFactory,
    PatientFactory,
    PatientProfileFactory,
    ReceptionistFactory,
    SubscriptionFactory,
)
from apps.doctors.models import Doctor, DoctorClinic, DoctorSchedule
from apps.patients.models import Patient
from apps.records.models import MedicalRecord, Prescription, PrescriptionItem


CLINIC_PRESETS = [
    {"name": "Apollo City Care Clinic", "address": "101 Jubilee Hills Road, Hyderabad"},
    {"name": "MaxHealth Multispecialty Center", "address": "45 MG Road, Bangalore"},
    {"name": "Fortis Wellness Hospital", "address": "12 Connaught Place, New Delhi"},
    {"name": "Manipal Care Hub", "address": "78 Marine Drive, Mumbai"},
    {"name": "CarePlus Medical Institute", "address": "22 Park Street, Kolkata"},
]

SPECIALIZATIONS = [
    ("General Medicine", 400),
    ("Cardiology", 800),
    ("Dermatology", 600),
    ("Pediatrics", 500),
    ("Orthopedics", 700),
    ("Neurology", 900),
    ("Ophthalmology", 500),
    ("Psychiatry", 750),
    ("Gynecology", 650),
    ("ENT", 450),
]

DOCTOR_NAMES = [
    ("Ananya", "Sharma"),
    ("Rajesh", "Verma"),
    ("Priya", "Patel"),
    ("Vikram", "Rao"),
    ("Sneha", "Reddy"),
    ("Amit", "Gupta"),
    ("Sunita", "Nair"),
    ("Rohan", "Mehta"),
    ("Pooja", "Iyer"),
    ("Deepak", "Joshi"),
    ("Neha", "Kapoor"),
    ("Sanjay", "Malhotra"),
    ("Kavita", "Deshmukh"),
    ("Arjun", "Choudhury"),
    ("Meera", "Menon"),
    ("Vivek", "Saxena"),
    ("Shweta", "Bose"),
    ("Manoj", "Tiwari"),
    ("Divya", "Pillai"),
    ("Karan", "Singhania"),
]

PATIENT_FIRST_NAMES = [
    "Aarav", "Aditi", "Akhil", "Alok", "Amrita", "Anand", "Anjali", "Ankit",
    "Bhavna", "Chetan", "Deepa", "Dev", "Dinesh", "Gaurav", "Geeta", "Harish",
    "Ishaan", "Jyoti", "Kiran", "Komal", "Lalit", "Madhuri", "Manish", "Mayank",
    "Naveen", "Nisha", "Nitin", "Pallavi", "Pankaj", "Pranav", "Radha", "Rahul",
    "Ramesh", "Rashmi", "Ravi", "Reena", "Ritesh", "Ritu", "Rohit", "Sameer",
    "Sandhya", "Sanjay", "Santosh", "Sarita", "Saurabh", "Seema", "Shalini", "Shashi",
    "Shikha", "Shiv", "Shobha", "Shruti", "Siddharth", "Smita", "Sonali", "Sourabh",
    "Subhash", "Sudhir", "Sujata", "Sumit", "Sunil", "Suresh", "Surya", "Swati",
    "Tanvi", "Tarun", "Umesh", "Vaibhav", "Varun", "Vikas", "Vinay", "Vineet",
    "Vipin", "Vishal", "Yash", "Yogesh"
]

PATIENT_LAST_NAMES = [
    "Agarwal", "Bhatia", "Chauhan", "Das", "Dutta", "Goyal", "Jain", "Kashyap",
    "Kumar", "Mahajan", "Mishra", "Mukherjee", "Pandey", "Prasad", "Ranganathan",
    "Reddy", "Roy", "Sengupta", "Shah", "Sharma", "Shukla", "Singh", "Srivastava",
    "Tripathi", "Venkatesh", "Verma", "Yadav"
]

REASONS_AND_DIAGNOSES = [
    ("Routine health checkup and hypertension review", "Essential hypertension - well controlled", "Mild fatigue"),
    ("Severe headache and photophobia for 3 days", "Tension headache with ocular strain", "Headache, light sensitivity"),
    ("Persistent dry cough, mild fever, and sore throat", "Upper respiratory tract infection", "Cough, throat irritation, 99.4F"),
    ("Bilateral knee joint pain after jogging", "Patellofemoral pain syndrome", "Localized knee ache and stiffness"),
    ("Pruritic erythematous rash on bilateral forearms", "Contact dermatitis", "Itching, redness on forearms"),
    ("Occasional palpitation and chest tightness during exertion", "Sinus tachycardia - stress related", "Palpitations, mild anxiety"),
    ("Annual comprehensive diabetic screening", "Type 2 Diabetes Mellitus - regular review", "Asymptomatic, routine review"),
    ("Eye dryness and blurred vision while using computer", "Computer vision syndrome / dry eye", "Eye fatigue, burning sensation"),
    ("Pediatric growth milestone checkup and vaccination", "Healthy child - normal development", "Routine visit"),
    ("Abdominal cramping and intermittent bloating", "Mild irritable bowel syndrome", "Bloating, epigastric discomfort"),
]

DAILY_SLOTS = [
    (time(9, 0), time(9, 30)),
    (time(9, 30), time(10, 0)),
    (time(10, 0), time(10, 30)),
    (time(10, 30), time(11, 0)),
    (time(11, 0), time(11, 30)),
    (time(11, 30), time(12, 0)),
    (time(12, 0), time(12, 30)),
    (time(12, 30), time(13, 0)),
    (time(14, 0), time(14, 30)),
    (time(14, 30), time(15, 0)),
    (time(15, 0), time(15, 30)),
    (time(15, 30), time(16, 0)),
    (time(16, 0), time(16, 30)),
    (time(16, 30), time(17, 0)),
]


class Command(BaseCommand):
    help = "Seed realistic volume for local load testing (clinics, doctors, receptionists, patients, appointments)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clinics",
            type=int,
            default=4,
            help="Number of clinics to seed (default: 4, range 1-5).",
        )
        parser.add_argument(
            "--doctors-per-clinic",
            type=int,
            default=4,
            help="Number of doctors per clinic (default: 4).",
        )
        parser.add_argument(
            "--patients",
            type=int,
            default=75,
            help="Number of patient profiles to seed (default: 75).",
        )
        parser.add_argument(
            "--appointments",
            type=int,
            default=300,
            help="Number of appointments to seed across dates and statuses (default: 300).",
        )
        parser.add_argument(
            "--days-past",
            type=int,
            default=30,
            help="Number of days in the past for historical appointments (default: 30).",
        )
        parser.add_argument(
            "--days-future",
            type=int,
            default=14,
            help="Number of days in the future for scheduled appointments (default: 14).",
        )

    def handle(self, *args, **options):
        num_clinics = max(1, min(options["clinics"], len(CLINIC_PRESETS)))
        num_doctors_per_clinic = max(1, options["doctors_per_clinic"])
        num_patients = max(1, options["patients"])
        num_appointments = max(1, options["appointments"])
        days_past = max(1, options["days_past"])
        days_future = max(1, options["days_future"])

        self.stdout.write(self.style.NOTICE("=== Seeding Load Test Data ==="))
        self.stdout.write(
            f"Config: {num_clinics} clinics, {num_doctors_per_clinic} docs/clinic, "
            f"{num_patients} patients, {num_appointments} appointments."
        )

        # ── 1. Create Clinics, Subscriptions, Admins, & Receptionists ──────────
        created_clinics = []
        created_doctor_clinics = []
        receptionist_users = []

        doc_name_idx = 0

        for c_idx in range(num_clinics):
            preset = CLINIC_PRESETS[c_idx]
            clinic = ClinicFactory(
                name=preset["name"],
                address=preset["address"],
                is_active=True,
            )
            created_clinics.append(clinic)

            # Subscription
            SubscriptionFactory(
                clinic=clinic,
                status="active",
                plan="professional" if c_idx % 2 == 0 else "enterprise",
            )

            # Clinic Admin
            admin_email = f"admin.clinic{clinic.id}@mediclinic.example.com"
            ClinicAdminFactory(
                clinic=clinic,
                email=admin_email,
                first_name="Admin",
                last_name=f"Clinic{clinic.id}",
            )

            # Receptionist
            recept_email = f"receptionist.clinic{clinic.id}@mediclinic.example.com"
            receptionist = ReceptionistFactory(
                clinic=clinic,
                email=recept_email,
                first_name="Staff",
                last_name=f"Clinic{clinic.id}",
            )
            receptionist_users.append(receptionist)

            # ── 2. Create Doctors & Schedules for Clinic ───────────────────────
            for d_idx in range(num_doctors_per_clinic):
                spec_name, fee = SPECIALIZATIONS[d_idx % len(SPECIALIZATIONS)]
                first_name, last_name = DOCTOR_NAMES[doc_name_idx % len(DOCTOR_NAMES)]
                doc_name_idx += 1

                doc_email = f"dr.{first_name.lower()}.{last_name.lower()}.c{clinic.id}.d{d_idx}@mediclinic.example.com"
                
                doc_user = DoctorFactory(
                    email=doc_email,
                    first_name=first_name,
                    last_name=last_name,
                    clinic=clinic,
                )

                doc_profile = DoctorProfileFactory(
                    user=doc_user,
                    specialization=spec_name,
                    consultation_fee=fee,
                    experience_years=random.randint(3, 25),
                    qualifications="MBBS, MD" if d_idx % 2 == 0 else "MBBS, MS",
                    bio=f"Dr. {first_name} {last_name} is an experienced {spec_name} specialist with extensive clinical experience.",
                )

                doc_clinic = DoctorClinicFactory(
                    doctor=doc_profile,
                    clinic=clinic,
                    consultation_fee=fee,
                )
                created_doctor_clinics.append(doc_clinic)

                # Weekly Schedule: 7 days, 09:00 - 17:00, 30-min slots
                for day in range(7):
                    DoctorScheduleFactory(
                        doctor_clinic=doc_clinic,
                        day_of_week=day,
                        start_time=time(9, 0),
                        end_time=time(17, 0),
                        slot_duration=30,
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Created {len(created_clinics)} clinics with {len(created_doctor_clinics)} doctor-clinic links and weekly schedules."
            )
        )

        # ── 3. Create Patients ────────────────────────────────────────────────
        created_patients = []
        for p_idx in range(num_patients):
            first = PATIENT_FIRST_NAMES[p_idx % len(PATIENT_FIRST_NAMES)]
            last = PATIENT_LAST_NAMES[p_idx % len(PATIENT_LAST_NAMES)]
            p_email = f"patient.{p_idx + 1}@mediclinic.example.com"
            p_phone = f"+9198{random.randint(10000000, 99999999)}"

            p_user = PatientFactory(
                email=p_email,
                first_name=first,
                last_name=last,
            )
            p_profile = PatientProfileFactory(
                user=p_user,
                phone=p_phone,
                date_of_birth=date(random.randint(1965, 2005), random.randint(1, 12), random.randint(1, 28)),
                gender="MALE" if p_idx % 2 == 0 else "FEMALE",
                blood_group=random.choice(["A+", "B+", "O+", "AB+", "O-", "A-"]),
                address=f"Flat {random.randint(101, 909)}, Health Enclave, City",
            )
            created_patients.append(p_profile)

        self.stdout.write(self.style.SUCCESS(f"✓ Created {len(created_patients)} patient accounts & profiles."))

        # ── 4. Generate Non-Overlapping Appointment Slots ─────────────────────
        today = timezone.localdate() if timezone.is_aware(timezone.now()) else date.today()

        # Build candidate slot pool: list of (doctor_clinic, appt_date, (start_time, end_time))
        candidate_slots = []
        total_days = list(range(-days_past, days_future + 1))

        for dc in created_doctor_clinics:
            for day_offset in total_days:
                appt_date = today + timedelta(days=day_offset)
                for slot_start, slot_end in DAILY_SLOTS:
                    candidate_slots.append((dc, appt_date, slot_start, slot_end))

        # Sample target number of unique slots
        sample_count = min(num_appointments, len(candidate_slots))
        selected_slots = random.sample(candidate_slots, sample_count)

        # Sort chronologically for clean insertion
        selected_slots.sort(key=lambda s: (s[1], s[2]))

        created_appointments_count = 0
        created_records_count = 0
        created_invoices_count = 0

        with transaction.atomic():
            for dc, appt_date, slot_start, slot_end in selected_slots:
                patient = random.choice(created_patients)
                created_by_user = patient.user if random.random() > 0.3 else random.choice(receptionist_users)
                reason_item = random.choice(REASONS_AND_DIAGNOSES)
                reason_text = reason_item[0]
                diagnosis_text = reason_item[1]
                symptoms_text = reason_item[2]

                # Determine status by date
                if appt_date < today:
                    # Past appointment
                    rand_val = random.random()
                    if rand_val < 0.78:
                        status = Appointment.StatusChoices.COMPLETED
                    elif rand_val < 0.90:
                        status = Appointment.StatusChoices.CANCELLED
                    else:
                        status = Appointment.StatusChoices.NO_SHOW
                elif appt_date == today:
                    # Today
                    rand_val = random.random()
                    if rand_val < 0.30:
                        status = Appointment.StatusChoices.COMPLETED
                    elif rand_val < 0.50:
                        status = Appointment.StatusChoices.IN_PROGRESS
                    elif rand_val < 0.75:
                        status = Appointment.StatusChoices.WAITING
                    elif rand_val < 0.90:
                        status = Appointment.StatusChoices.CONFIRMED
                    else:
                        status = Appointment.StatusChoices.SCHEDULED
                else:
                    # Future
                    rand_val = random.random()
                    if rand_val < 0.65:
                        status = Appointment.StatusChoices.CONFIRMED
                    elif rand_val < 0.95:
                        status = Appointment.StatusChoices.SCHEDULED
                    else:
                        status = Appointment.StatusChoices.CANCELLED

                start_dt = make_aware(datetime.combine(appt_date, slot_start))
                end_dt = make_aware(datetime.combine(appt_date, slot_end))
                time_range = (start_dt, end_dt) if connection.vendor == "postgresql" else None

                payment_flow = "pay_now" if random.random() > 0.4 else "pay_at_clinic"

                appointment = AppointmentFactory(
                    clinic=dc.clinic,
                    doctor_clinic=dc,
                    patient=patient,
                    created_by=created_by_user,
                    appointment_date=appt_date,
                    start_time=slot_start,
                    end_time=slot_end,
                    time_range=time_range,
                    status=status,
                    reason=reason_text,
                    payment_flow=payment_flow,
                )

                created_appointments_count += 1

                # If COMPLETED, generate a MedicalRecord and paid Invoice for realistic read views
                if status == Appointment.StatusChoices.COMPLETED:
                    MedicalRecord.objects.create(
                        appointment=appointment,
                        patient=patient,
                        doctor_clinic=dc,
                        symptoms=symptoms_text,
                        diagnosis=diagnosis_text,
                        doctor_notes=f"Patient advised rest and follow up if symptoms persist. Diagnosis: {diagnosis_text}.",
                        private_notes="Routine consultation completed successfully.",
                        vitals_temperature=Decimal(f"{random.uniform(98.0, 99.8):.1f}"),
                        vitals_blood_pressure=random.choice(["120/80", "118/76", "124/82", "130/85"]),
                    )
                    created_records_count += 1

                    fee = Decimal(dc.consultation_fee or 500)
                    Invoice.objects.create(
                        clinic=dc.clinic,
                        patient=patient,
                        appointment=appointment,
                        amount=fee,
                        gst_amount=Decimal("0.00"),
                        total_amount=fee,
                        status="paid",
                        payment_method=random.choice(["upi", "card", "cash", "netbanking"]),
                    )
                    created_invoices_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Created {created_appointments_count} appointments "
                f"({created_records_count} medical records, {created_invoices_count} invoices)."
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"=== Load Test Data Seeding Complete ==="
            )
        )
