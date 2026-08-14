import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from apps.clinics.models import Clinic

logger = logging.getLogger(__name__)


def _safe_delete(pattern_or_key, is_pattern=False):
    try:
        if is_pattern and hasattr(cache, "delete_pattern"):
            cache.delete_pattern(pattern_or_key)
        else:
            cache.delete(pattern_or_key)
    except Exception as e:
        logger.warning(f"Cache invalidation failed for {pattern_or_key} — {e}")


def invalidate_clinic_caches(clinic_id=None):
    """
    Invalidates cache entries for PublicClinicListView, ClinicListView,
    and PublicClinicDoctorsView when a Clinic is saved or deleted.
    """
    _safe_delete("public_clinics:*", is_pattern=True)
    _safe_delete("public_clinics:")
    _safe_delete("clinic_list:*", is_pattern=True)
    _safe_delete("clinic_list:")
    if clinic_id:
        _safe_delete(f"public_clinic_doctors:{clinic_id}:*", is_pattern=True)
        _safe_delete(f"public_clinic_doctors:{clinic_id}:")


@receiver(post_save, sender=Clinic)
@receiver(post_delete, sender=Clinic)
def on_clinic_changed(sender, instance, **kwargs):
    invalidate_clinic_caches(clinic_id=instance.id)
