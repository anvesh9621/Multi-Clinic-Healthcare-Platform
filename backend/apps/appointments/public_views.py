"""
Public (AllowAny) views for the patient self-booking wizard.
These endpoints power Steps 2-4 of the booking flow.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.db.models import Q, Avg, Count
from datetime import datetime

from apps.clinics.models import Clinic
from apps.doctors.models import DoctorClinic, DoctorSchedule, DoctorLeave, Doctor
from apps.appointments.services import get_available_slots


from django.core.cache import cache

class PublicClinicListView(APIView):
    """
    GET /api/public/clinics/
    Returns active clinics that have an active subscription.
    Supports ?search= for filtering by name/address.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        cache_key = f"public_clinics:{request.query_params.urlencode()}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        clinics = Clinic.objects.filter(
            is_active=True,
            subscription__status__in=['trialing', 'active', 'past_due']
        ).select_related('subscription').distinct()

        search = request.query_params.get('search', '').strip()
        if search:
            clinics = clinics.filter(
                Q(name__icontains=search) | Q(address__icontains=search)
            )

        specialty = request.query_params.get('specialty', '').strip()
        if specialty:
            clinics = clinics.filter(
                doctor_associations__is_active=True,
                doctor_associations__doctor__specialization__iexact=specialty
            ).distinct()

        result = []
        for clinic in clinics:
            active_associations = DoctorClinic.objects.filter(
                clinic=clinic, is_active=True
            ).select_related('doctor')

            specialties = list(
                active_associations.values_list(
                    'doctor__specialization', flat=True
                ).distinct()
            )

            result.append({
                'id': clinic.id,
                'name': clinic.name,
                'address': clinic.address,
                'doctor_count': active_associations.count(),
                'specialties': [s for s in specialties if s],
            })

        cache.set(cache_key, result, timeout=300)
        return Response(result)


class PublicClinicDoctorsView(APIView):
    """
    GET /api/public/clinics/{clinic_id}/doctors/
    Returns active doctors at a specific clinic.
    """
    permission_classes = [AllowAny]

    def get(self, request, clinic_id):
        cache_key = f"public_clinic_doctors:{clinic_id}:{request.query_params.urlencode()}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        clinic = get_object_or_404(Clinic, id=clinic_id, is_active=True)

        associations = DoctorClinic.objects.filter(
            clinic=clinic, is_active=True
        ).select_related('doctor__user')

        specialty = request.query_params.get('specialty', '').strip()
        if specialty:
            associations = associations.filter(
                doctor__specialization__iexact=specialty
            )

        result = []
        for dc in associations:
            doctor = dc.doctor
            user = doctor.user

            avg_rating = doctor.reviews.aggregate(Avg('rating'))['rating__avg']
            review_count = doctor.reviews.count()

            photo_url = None
            if doctor.profile_photo:
                photo_url = request.build_absolute_uri(doctor.profile_photo.url)

            result.append({
                'doctor_clinic_id': dc.id,
                'doctor_id': doctor.id,
                'name': f"Dr. {user.get_full_name()}" if user.get_full_name() else f"Dr. {user.email}",
                'specialty': doctor.specialization,
                'consultation_fee': float(dc.consultation_fee),
                'experience_years': doctor.experience_years,
                'qualifications': doctor.qualifications,
                'photo_url': photo_url,
                'average_rating': round(float(avg_rating), 1) if avg_rating else 0.0,
                'review_count': review_count,
            })

        response_data = {
            'clinic_id': clinic.id,
            'clinic_name': clinic.name,
            'doctors': result,
        }
        cache.set(cache_key, response_data, timeout=300)
        return Response(response_data)


class PublicAvailableSlotsView(APIView):
    """
    GET /api/public/doctors/{doctor_clinic_id}/slots/?date=YYYY-MM-DD
    Returns available time slots for a doctor at a clinic on a specific date.
    Reuses the existing get_available_slots() service function.
    """
    permission_classes = [AllowAny]

    def get(self, request, doctor_clinic_id):
        date_str = request.query_params.get('date')
        if not date_str:
            return Response({'error': 'date query parameter is required.'}, status=400)

        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

        dc = get_object_or_404(DoctorClinic, id=doctor_clinic_id, is_active=True)

        slots = get_available_slots(doctor_clinic_id=dc.id, date=target_date)

        return Response({
            'date': date_str,
            'consultation_fee': float(dc.consultation_fee),
            'slots': slots,
            'doctor_clinic_id': dc.id,
        })
