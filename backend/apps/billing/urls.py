from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InvoiceViewSet, stripe_webhook

router = DefaultRouter()
router.register(r'invoices', InvoiceViewSet, basename='invoice')

urlpatterns = [
    path('', include(router.urls)),
    path('webhook/', stripe_webhook, name='stripe-webhook'),
]
