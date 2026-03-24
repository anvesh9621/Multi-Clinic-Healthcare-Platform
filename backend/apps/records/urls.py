from django.urls import path
from .views import (
    MedicalRecordCreateUpdateView,
    PrescriptionCreateView,
    PatientHistoryView,
    PrescriptionTemplateViewSet,
    PrescriptionTemplateDetailView,
)

urlpatterns = [
    # Medical Records & Consultations
    path('consultation/', MedicalRecordCreateUpdateView.as_view(), name='record-create'),
    path('consultation/<int:appointment_id>/', MedicalRecordCreateUpdateView.as_view(), name='record-update'),
    
    # Prescriptions
    path('prescriptions/', PrescriptionCreateView.as_view(), name='prescription-create'),
    
    # Templates
    path('templates/', PrescriptionTemplateViewSet.as_view(), name='template-list-create'),
    path('templates/<int:pk>/', PrescriptionTemplateDetailView.as_view(), name='template-detail'),
    
    # Patient History Timeline
    path('history/patient/<int:patient_id>/', PatientHistoryView.as_view(), name='patient-history'),
]