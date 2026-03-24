from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):

    list_display = (
        "timestamp",
        "user",
        "clinic",
        "action_type",
        "object_type",
        "object_id",
    )

    search_fields = ("user__email", "object_type")

    list_filter = ("action_type", "clinic")