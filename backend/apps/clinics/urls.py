from django.urls import path
from .views import CreateReceptionistView, ReceptionistListView

urlpatterns = [
    path('receptionists/', ReceptionistListView.as_view(), name='receptionist-list'),
    path('receptionists/create/', CreateReceptionistView.as_view(), name='receptionist-create'),
]
