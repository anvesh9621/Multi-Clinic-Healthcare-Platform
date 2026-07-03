from django.urls import path
from .views import (
    CreateSubscriptionView, SubscriptionStatusView, CancelSubscriptionView,
    VerifySubscriptionView, SubscriptionInvoiceListView, SubscriptionInvoiceDownloadView
)

urlpatterns = [
    path('create/', CreateSubscriptionView.as_view()),
    path('verify/', VerifySubscriptionView.as_view()),
    path('status/', SubscriptionStatusView.as_view()),
    path('cancel/', CancelSubscriptionView.as_view()),
    path('invoices/', SubscriptionInvoiceListView.as_view()),
    path('invoices/<int:pk>/download/', SubscriptionInvoiceDownloadView.as_view()),
]
