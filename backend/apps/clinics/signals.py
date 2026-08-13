from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from apps.clinics.models import Clinic


def invalidate_clinic_caches(clinic_id=None):
    """
    Invalidates cache entries for PublicClinicListView, ClinicListView,
    and PublicClinicDoctorsView when a Clinic is saved or deleted.
    """
    try:
        if hasattr(cache, "delete_pattern"):
            cache.delete_pattern("public_clinics:*")
            cache.delete_pattern("clinic_list:*")
            if clinic_id:
                cache.delete_pattern(f"public_clinic_doctors:{clinic_id}:*")
        else:
            cache.delete("public_clinics:")
            cache.delete("clinic_list:")
            if clinic_id:
                cache.delete(f"public_clinic_doctors:{clinic_id}:")
    except Exception:
        cache.delete("public_clinics:")
        cache.delete("clinic_list:")
        if clinic_id:
            cache.delete(f"public_clinic_doctors:{clinic_id}:")


@receiver(post_save, sender=Clinic)
@receiver(post_delete, sender=Clinic)
def on_clinic_changed(sender, instance, **kwargs):
    invalidate_clinic_caches(clinic_id=instance.id)
