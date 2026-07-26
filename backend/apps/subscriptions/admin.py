from django.contrib import admin
from .models import Subscription


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("clinic", "status", "plan", "trial_end", "grace_period_end")
    list_filter = ("status", "plan")
    search_fields = ("clinic__name",)
    autocomplete_fields = ("clinic",)
