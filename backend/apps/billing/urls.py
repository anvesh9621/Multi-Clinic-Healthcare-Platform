from django.urls import path
from .views import (
    InvoiceListView,
    GeneratePaymentLinkView,
    MarkCashPaidView,
    PatientPayInvoiceView,
    RefundInvoiceView,
    InitiateRefundView,
    PendingRefundApprovalsListView,
    ApproveRefundView,
    RejectRefundView,
    OnboardBankView,
    PlatformSettingsView,
    SuperAdminGenerateSubscriptionLinkView,
    CreateOrderView,
    VerifyPaymentView,
)
from .webhooks import razorpay_webhook

urlpatterns = [
    path("webhook/", razorpay_webhook),
    path("create-order/", CreateOrderView.as_view(), name="billing-create-order"),
    path("verify-payment/", VerifyPaymentView.as_view(), name="billing-verify-payment"),
    path("platform-settings/", PlatformSettingsView.as_view()),
    path("onboard-bank/", OnboardBankView.as_view()),
    path("invoices/", InvoiceListView.as_view()),
    path("invoices/<int:pk>/generate-payment-link/", GeneratePaymentLinkView.as_view()),
    path("invoices/<int:pk>/mark-cash-paid/", MarkCashPaidView.as_view()),
    path("invoices/<int:pk>/pay/", PatientPayInvoiceView.as_view()),
    path("invoices/<int:pk>/refund/", RefundInvoiceView.as_view()),
    path("refunds/initiate/", InitiateRefundView.as_view()),
    path("refunds/pending/", PendingRefundApprovalsListView.as_view()),
    path("refunds/<int:pk>/approve/", ApproveRefundView.as_view()),
    path("refunds/<int:pk>/reject/", RejectRefundView.as_view()),
    path("super-admin/generate-subscription-link/", SuperAdminGenerateSubscriptionLinkView.as_view()),
]
