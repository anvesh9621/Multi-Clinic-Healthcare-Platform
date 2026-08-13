from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from apps.doctors.models import Doctor, DoctorClinic


def invalidate_doctor_caches(clinic_id=None):
    """
    Invalidates cache entries for PublicDoctorListView, PublicSpecialtyListView,
    PublicClinicDoctorsView, PublicClinicListView, and ClinicListView when
    a Doctor or DoctorClinic instance changes.
    """
    try:
        if hasattr(cache, "delete_pattern"):
            cache.delete_pattern("public_doctors:*")
            cache.delete_pattern("public_specialties:*")
            cache.delete_pattern("public_clinics:*")
            cache.delete_pattern("clinic_list:*")
            if clinic_id:
                cache.delete_pattern(f"public_clinic_doctors:{clinic_id}:*")
            else:
                cache.delete_pattern("public_clinic_doctors:*")
        else:
            cache.delete("public_doctors:")
            cache.delete("public_specialties:")
            cache.delete("public_clinics:")
            cache.delete("clinic_list:")
            if clinic_id:
                cache.delete(f"public_clinic_doctors:{clinic_id}:")
    except Exception:
        cache.delete("public_doctors:")
        cache.delete("public_specialties:")
        cache.delete("public_clinics:")
        cache.delete("clinic_list:")
        if clinic_id:
            cache.delete(f"public_clinic_doctors:{clinic_id}:")


@receiver(post_save, sender=Doctor)
@receiver(post_delete, sender=Doctor)
def on_doctor_changed(sender, instance, **kwargs):
    invalidate_doctor_caches()


@receiver(post_save, sender=DoctorClinic)
@receiver(post_delete, sender=DoctorClinic)
def on_doctor_clinic_changed(sender, instance, **kwargs):
    clinic_id = getattr(instance, 'clinic_id', None)
    invalidate_doctor_caches(clinic_id=clinic_id)
