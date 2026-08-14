import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from apps.doctors.models import Doctor, DoctorClinic

logger = logging.getLogger(__name__)


def _safe_delete(pattern_or_key, is_pattern=False):
    try:
        if is_pattern and hasattr(cache, "delete_pattern"):
            cache.delete_pattern(pattern_or_key)
        else:
            cache.delete(pattern_or_key)
    except Exception as e:
        logger.warning(f"Cache invalidation failed for {pattern_or_key} — {e}")


def invalidate_doctor_caches(clinic_id=None):
    """
    Invalidates cache entries for PublicDoctorListView, PublicSpecialtyListView,
    PublicClinicDoctorsView, PublicClinicListView, and ClinicListView when
    a Doctor or DoctorClinic instance changes.
    """
    _safe_delete("public_doctors:*", is_pattern=True)
    _safe_delete("public_doctors:")
    _safe_delete("public_specialties:*", is_pattern=True)
    _safe_delete("public_specialties:")
    _safe_delete("public_clinics:*", is_pattern=True)
    _safe_delete("public_clinics:")
    _safe_delete("clinic_list:*", is_pattern=True)
    _safe_delete("clinic_list:")
    if clinic_id:
        _safe_delete(f"public_clinic_doctors:{clinic_id}:*", is_pattern=True)
        _safe_delete(f"public_clinic_doctors:{clinic_id}:")
    else:
        _safe_delete("public_clinic_doctors:*", is_pattern=True)
        _safe_delete("public_clinic_doctors:")


@receiver(post_save, sender=Doctor)
@receiver(post_delete, sender=Doctor)
def on_doctor_changed(sender, instance, **kwargs):
    invalidate_doctor_caches()


@receiver(post_save, sender=DoctorClinic)
@receiver(post_delete, sender=DoctorClinic)
def on_doctor_clinic_changed(sender, instance, **kwargs):
    clinic_id = getattr(instance, 'clinic_id', None)
    invalidate_doctor_caches(clinic_id=clinic_id)
