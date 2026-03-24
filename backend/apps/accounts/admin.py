from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):

    model = User

    list_display = ("email", "role", "clinic", "is_active", "is_staff")
    list_filter = ("role", "clinic", "is_active")

    ordering = ("email",)

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Permissions", {"fields": ("role", "clinic", "is_active", "is_staff", "is_superuser")}),
        ("Important dates", {"fields": ("last_login",)}),  # ❌ no created_at here
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "password1", "password2", "role", "clinic"),
        }),
    )

    search_fields = ("email",)