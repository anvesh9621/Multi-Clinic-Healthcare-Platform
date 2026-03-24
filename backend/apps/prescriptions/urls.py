from django.urls import path
from .views import CreatePrescriptionView

urlpatterns = [
    path("create/", CreatePrescriptionView.as_view()),
]