from django.db import models


class AuditLog(models.Model):

    class ActionChoices(models.TextChoices):
        CREATE = "CREATE", "Create"
        UPDATE = "UPDATE", "Update"
        DELETE = "DELETE", "Delete"
        BOOK = "BOOK", "Book Appointment"
        CANCEL = "CANCEL", "Cancel Appointment"
        LOGIN = "LOGIN", "Login"
        LOGOUT = "LOGOUT", "Logout"

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_logs"
    )

    clinic = models.ForeignKey(
        "clinics.Clinic",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs"
    )

    action_type = models.CharField(
        max_length=20,
        choices=ActionChoices.choices
    )

    object_type = models.CharField(max_length=100)

    object_id = models.IntegerField(null=True, blank=True)

    description = models.TextField(blank=True, null=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)

    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["timestamp"]),
            models.Index(fields=["user"]),
            models.Index(fields=["clinic"]),
            models.Index(fields=["action_type"]),
        ]

    def __str__(self):
        return f"{self.timestamp} | {self.user} | {self.action_type} | {self.object_type}"