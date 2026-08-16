from django.urls import path
from .views import (
    MedicalRecordCreateUpdateView,
    PrescriptionCreateView,
    DoctorPatientHistoryView,
    PatientOwnHistoryView,
    PrescriptionTemplateViewSet,
    PrescriptionTemplateDetailView,
)
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status as drf_status
from rest_framework.exceptions import PermissionDenied


class PatientHistoryDispatchView(APIView):
    """
    Thin URL-level dispatcher for /history/patient/<patient_id>/.

    Keeps the original single URL stable while internally delegating to the
    role-appropriate view class (DoctorPatientHistoryView or PatientOwnHistoryView).
    This avoids breaking any existing frontend/client integrations.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, patient_id, **kwargs):
        if request.user.role == "DOCTOR":
            view = DoctorPatientHistoryView.as_view()
        elif request.user.role == "PATIENT":
            view = PatientOwnHistoryView.as_view()
        else:
            raise PermissionDenied("Access denied for this role.")
        return view(request._request, patient_id=patient_id, **kwargs)


urlpatterns = [
    # Medical Records & Consultations
    path('consultation/', MedicalRecordCreateUpdateView.as_view(), name='record-create'),
    path('consultation/<int:appointment_id>/', MedicalRecordCreateUpdateView.as_view(), name='record-update'),

    # Prescriptions
    path('prescriptions/', PrescriptionCreateView.as_view(), name='prescription-create'),

    # Templates
    path('templates/', PrescriptionTemplateViewSet.as_view(), name='template-list-create'),
    path('templates/<int:pk>/', PrescriptionTemplateDetailView.as_view(), name='template-detail'),

    # Patient History Timeline — single URL dispatches to role-appropriate view
    path('history/patient/me/', PatientOwnHistoryView.as_view(), {'patient_id': 'me'}, name='patient-history-me'),
    path('history/patient/<int:patient_id>/', PatientHistoryDispatchView.as_view(), name='patient-history'),

    # Explicit per-role URLs (e.g. for new frontends or direct API consumers)
    path('history/patient/<int:patient_id>/doctor/', DoctorPatientHistoryView.as_view(), name='patient-history-doctor'),
    path('history/patient/<int:patient_id>/own/', PatientOwnHistoryView.as_view(), name='patient-history-own'),
]