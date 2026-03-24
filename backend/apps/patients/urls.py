from django.urls import path
from .views import PatientRegistrationView, PatientListView, PatientHistoryView, PatientSelfRegisterView, PatientProfileView
from . import views

urlpatterns = [
    path('', PatientListView.as_view(), name='patient-list'),
    path('register/', PatientRegistrationView.as_view(), name='patient-register'),
    path('self-register/', PatientSelfRegisterView.as_view(), name='patient-self-register'),
    path('profile/', PatientProfileView.as_view(), name='patient-profile'),
    path('<int:pk>/history/', PatientHistoryView.as_view(), name='patient-history'),
    path('intake-form/<int:appointment_id>/', views.IntakeFormView.as_view(), name='intake-form'),
]
