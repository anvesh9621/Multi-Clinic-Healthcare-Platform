from django.urls import path
from .views import (
    InvoiceListView,
    GeneratePaymentLinkView,
    MarkCashPaidView,
    PatientPayInvoiceView,
    RefundInvoiceView,
    OnboardBankView,
    PlatformSettingsView,
    SuperAdminGenerateSubscriptionLinkView,
)
from .webhooks import razorpay_webhook

urlpatterns = [
    path("webhook/", razorpay_webhook),
    path("platform-settings/", PlatformSettingsView.as_view()),
    path("onboard-bank/", OnboardBankView.as_view()),
    path("invoices/", InvoiceListView.as_view()),
    path("invoices/<int:pk>/generate-payment-link/", GeneratePaymentLinkView.as_view()),
    path("invoices/<int:pk>/mark-cash-paid/", MarkCashPaidView.as_view()),
    path("invoices/<int:pk>/pay/", PatientPayInvoiceView.as_view()),
    path("invoices/<int:pk>/refund/", RefundInvoiceView.as_view()),
    path("super-admin/generate-subscription-link/", SuperAdminGenerateSubscriptionLinkView.as_view()),
]
