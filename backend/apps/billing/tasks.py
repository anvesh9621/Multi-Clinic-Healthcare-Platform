import logging
import os
from celery import shared_task
from django.conf import settings
from django.utils import timezone
from django.core.mail import EmailMessage
from django.contrib.auth import get_user_model
from .models import Invoice, SubscriptionInvoice, PaymentOutboxEvent
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

logger = logging.getLogger('payments')

@shared_task
def generate_b2b_invoice_pdf(invoice_id):
    try:
        invoice = SubscriptionInvoice.objects.get(id=invoice_id)
    except SubscriptionInvoice.DoesNotExist:
        return f"Invoice {invoice_id} not found"

    # Define directory and file path
    media_root = settings.MEDIA_ROOT if hasattr(settings, 'MEDIA_ROOT') and settings.MEDIA_ROOT else os.path.join(settings.BASE_DIR, 'media')
    invoices_dir = os.path.join(media_root, 'invoices', 'b2b')
    os.makedirs(invoices_dir, exist_ok=True)
    
    filename = f"{invoice.invoice_number}.pdf"
    file_path = os.path.join(invoices_dir, filename)

    doc = SimpleDocTemplate(file_path, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=18)
    styles = getSampleStyleSheet()
    elements = []

    # Title
    title_style = ParagraphStyle(name='TitleStyle', fontSize=18, alignment=1, spaceAfter=20)
    elements.append(Paragraph(f"Tax Invoice - {getattr(settings, 'PLATFORM_NAME', 'MediClinic')}", title_style))

    # Platform Details
    platform_info = [
        f"<b>{getattr(settings, 'PLATFORM_NAME', 'MediClinic')}</b>",
        f"GSTIN: {getattr(settings, 'PLATFORM_GSTIN', 'N/A')}",
        f"Address: {getattr(settings, 'PLATFORM_ADDRESS', 'N/A')}",
    ]
    elements.append(Paragraph("<br/>".join(platform_info), styles["Normal"]))
    elements.append(Spacer(1, 20))

    # Clinic Details
    clinic_info = [
        "<b>Billed To:</b>",
        f"{invoice.clinic.name}",
    ]
    if invoice.clinic.business_pan:
        clinic_info.append(f"PAN: {invoice.clinic.business_pan}")
    if invoice.clinic.gstin:
        clinic_info.append(f"GSTIN: {invoice.clinic.gstin}")
    
    elements.append(Paragraph("<br/>".join(clinic_info), styles["Normal"]))
    elements.append(Spacer(1, 20))

    # Invoice Details Table
    inv_date = invoice.issued_at.strftime('%Y-%m-%d') if invoice.issued_at else timezone.now().strftime('%Y-%m-%d')
    p_start = invoice.period_start.strftime('%Y-%m-%d') if invoice.period_start else "N/A"
    p_end = invoice.period_end.strftime('%Y-%m-%d') if invoice.period_end else "N/A"

    details_data = [
        ["Invoice Number:", invoice.invoice_number],
        ["Invoice Date:", inv_date],
        ["Razorpay Payment ID:", invoice.razorpay_payment_id or "N/A"],
        ["Billing Period:", f"{p_start} to {p_end}"]
    ]
    details_table = Table(details_data, colWidths=[120, 300])
    details_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(details_table)
    elements.append(Spacer(1, 20))

    # Line Items
    amount = float(invoice.total_amount)
    # Reverse calculating GST for B2B (Assuming total includes 18% GST)
    base_amount = amount / 1.18
    gst_amount = amount - base_amount

    items_data = [
        ["Description", "HSN/SAC", "Amount (INR)"],
        ["SaaS Subscription Fee", getattr(settings, 'HSN_SAC_CODE', '998314'), f"{base_amount:.2f}"],
        ["", "GST (18%)", f"{gst_amount:.2f}"],
        ["", "Total", f"{amount:.2f}"]
    ]
    
    items_table = Table(items_data, colWidths=[280, 120, 120])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e5e7eb')),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 40))

    # Footer
    elements.append(Paragraph("This is a computer generated invoice and does not require a physical signature.", styles["Italic"]))

    doc.build(elements)

    # Save to model
    invoice.pdf_path = file_path
    invoice.save()
    
    return f"PDF generated for invoice {invoice_id} at {file_path}"


@shared_task
def generate_appointment_invoice_pdf(invoice_id):
    try:
        invoice = Invoice.objects.select_related(
            'clinic', 'patient__user', 'appointment__doctor_clinic__doctor__user'
        ).get(id=invoice_id)
    except Invoice.DoesNotExist:
        return f"Invoice {invoice_id} not found"

    if not invoice.invoice_number:
        year = invoice.created_at.year if invoice.created_at else timezone.now().year
        invoice.invoice_number = f"INV-{year}-{invoice.id:06d}"
        invoice.save(update_fields=['invoice_number'])

    media_root = getattr(settings, 'MEDIA_ROOT', None) or os.path.join(settings.BASE_DIR, 'media')
    invoices_dir = os.path.join(media_root, 'invoices', 'appointments')
    os.makedirs(invoices_dir, exist_ok=True)

    filename = f"{invoice.invoice_number}.pdf"
    file_path = os.path.join(invoices_dir, filename)

    doc = SimpleDocTemplate(file_path, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=18)
    styles = getSampleStyleSheet()
    elements = []

    # Title
    title_style = ParagraphStyle(name='TitleStyle', fontSize=18, alignment=1, spaceAfter=20)
    elements.append(Paragraph(f"Medical Receipt — {invoice.clinic.name}", title_style))

    # Clinic Details
    clinic_info = [
        f"<b>{invoice.clinic.name}</b>",
        f"Address: {getattr(invoice.clinic, 'address', 'N/A')}",
        f"Phone: {getattr(invoice.clinic, 'phone', 'N/A')}",
    ]
    if getattr(invoice.clinic, 'gstin', None):
        clinic_info.append(f"GSTIN: {invoice.clinic.gstin}")
    elements.append(Paragraph("<br/>".join(clinic_info), styles["Normal"]))
    elements.append(Spacer(1, 15))

    # Patient & Appointment Details
    patient_name = invoice.patient.user.get_full_name() if invoice.patient and invoice.patient.user else "N/A"
    doctor_name = "N/A"
    appt_date = "N/A"
    if invoice.appointment:
        appt_date = str(invoice.appointment.appointment_date)
        try:
            doctor_name = f"Dr. {invoice.appointment.doctor_clinic.doctor.user.get_full_name()}"
        except Exception:
            pass

    info_data = [
        ["Patient Name:", patient_name, "Receipt Number:", invoice.invoice_number],
        ["Doctor:", doctor_name, "Date:", appt_date],
        ["Payment Method:", invoice.get_payment_method_display(), "Status:", invoice.status.upper()]
    ]
    info_table = Table(info_data, colWidths=[110, 190, 110, 110])
    info_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))

    # Line Items Breakdown
    fee = float(invoice.amount)
    gst = float(invoice.gst_amount)
    total = float(invoice.total_amount)

    items_data = [
        ["Description", "Amount (INR)"],
        [f"Consultation Fee — {doctor_name}", f"{fee:.2f}"],
    ]
    if gst > 0:
        items_data.append(["GST", f"{gst:.2f}"])
    items_data.append(["Total Amount Paid", f"{total:.2f}"])

    items_table = Table(items_data, colWidths=[380, 140])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e5e7eb')),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 40))

    # Footer
    elements.append(Paragraph("This is an official medical receipt generated by MediClinic.", styles["Italic"]))

    doc.build(elements)

    # Save to model
    invoice.pdf_path = file_path
    invoice.save(update_fields=['pdf_path'])

    return f"Appointment PDF generated for invoice {invoice_id} at {file_path}"


@shared_task
def process_payment_outbox():
    """
    Polls pending PaymentOutboxEvent rows and dispatches them. This is
    the relay half of the Outbox pattern — Phase 2.2 guarantees the event
    was recorded atomically with the payment; this task guarantees it
    eventually gets acted on, independently and with its own retries.
    """
    pending_events = PaymentOutboxEvent.objects.filter(
        status='pending'
    ).order_by('created_at')[:50]  # process in batches, don't grab unbounded rows

    for event in pending_events:
        event.status = 'processing'
        event.attempts += 1
        event.save(update_fields=['status', 'attempts'])

        try:
            if event.event_type == 'send_invoice_email':
                _handle_send_invoice_email(event.payload)
            else:
                raise ValueError(f"Unknown outbox event_type: {event.event_type}")

            event.status = 'completed'
            event.processed_at = timezone.now()
            event.save(update_fields=['status', 'processed_at'])
        except Exception as e:
            import sentry_sdk
            sentry_sdk.set_context("payment", {
                "invoice_id": str(event.payload.get("invoice_id")) if event and event.payload else None,
                "source_event": f"outbox:{event.event_type}",
            })
            logger.exception(f"Outbox event {event.id} failed (attempt {event.attempts})")
            event.last_error = str(e)[:500]
            # after 5 failed attempts, stop retrying automatically and flag for manual review
            event.status = 'failed' if event.attempts >= 5 else 'pending'
            event.save(update_fields=['status', 'last_error'])


def _handle_send_invoice_email(payload):
    User = get_user_model()
    invoice_type = payload.get('invoice_type')

    if invoice_type == 'appointment':
        invoice = Invoice.objects.select_related('patient__user').get(pk=payload['invoice_id'])
        if not invoice.pdf_path or not os.path.exists(invoice.pdf_path):
            generate_appointment_invoice_pdf(invoice.id)
            invoice.refresh_from_db()
        pdf_path = invoice.pdf_path
        recipient_email = invoice.patient.user.email if invoice.patient and invoice.patient.user else None
        subject = f"Your MediClinic receipt — {invoice.invoice_number or invoice.pk}"
    elif invoice_type == 'subscription':
        invoice = SubscriptionInvoice.objects.select_related('clinic').get(pk=payload['invoice_id'])
        if not invoice.pdf_path or not os.path.exists(invoice.pdf_path):
            generate_b2b_invoice_pdf(invoice.id)
            invoice.refresh_from_db()
        pdf_path = invoice.pdf_path
        admin_user = User.objects.filter(clinic=invoice.clinic, role='CLINIC_ADMIN').first()
        recipient_email = admin_user.email if admin_user else None
        subject = f"Your MediClinic tax invoice — {invoice.invoice_number or invoice.pk}"
    else:
        raise ValueError(f"Unknown invoice_type in outbox payload: {invoice_type}")

    if not recipient_email:
        raise ValueError(f"No recipient email found for outbox invoice {payload.get('invoice_id')}")

    msg = EmailMessage(
        subject=subject,
        body="Please find your invoice attached.",
        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
        to=[recipient_email],
    )
    if pdf_path and os.path.exists(pdf_path):
        msg.attach_file(pdf_path)

    msg.send(fail_silently=False)


@shared_task
def reconcile_pending_payments():
    """
    Runs every 10 minutes. Catches any pending Invoice/SubscriptionInvoice
    whose webhook was delayed or dropped, independent of the expiry sweep.
    """
    from datetime import timedelta
    from .services import reconcile_invoice_with_razorpay, reconcile_subscription_invoice_with_razorpay

    stale_threshold = timezone.now() - timedelta(minutes=3)

    stale_invoices = Invoice.objects.filter(
        status='pending',
        created_at__lt=stale_threshold,
    )
    caught_count = 0
    for invoice in stale_invoices:
        if reconcile_invoice_with_razorpay(invoice):
            caught_count += 1

    stale_sub_invoices = SubscriptionInvoice.objects.filter(
        status='pending',
        issued_at__lt=stale_threshold,
    )
    for sub_invoice in stale_sub_invoices:
        if reconcile_subscription_invoice_with_razorpay(sub_invoice):
            caught_count += 1

    if caught_count > 0:
        logger.warning(
            f"Reconciliation job caught {caught_count} payment(s) that "
            f"webhooks missed — if this number is consistently non-zero, "
            f"investigate webhook delivery reliability, don't just rely "
            f"on reconciliation as a permanent crutch"
        )
    return caught_count


@shared_task
def compute_daily_payment_metrics():
    """
    Runs daily at 2:00 AM off-peak. Computes payment health metrics for yesterday
    and stores an immutable PaymentMetricSnapshot row.
    """
    from datetime import datetime, time, timedelta
    from decimal import Decimal
    from django.db import models
    from .models import PaymentMetricSnapshot, PaymentLedgerEntry

    yesterday = (timezone.now() - timedelta(days=1)).date()
    start = timezone.make_aware(datetime.combine(yesterday, time.min))
    end = timezone.make_aware(datetime.combine(yesterday, time.max))

    paid_entries = PaymentLedgerEntry.objects.filter(
        created_at__range=(start, end), resulting_status='paid', entry_type='debit'
    )
    reconciliation_catches = paid_entries.filter(source_event__startswith='reconciliation:').count()

    paid_times_sec = []
    for entry in paid_entries.select_related('invoice', 'subscription_invoice'):
        inv = entry.invoice or entry.subscription_invoice
        if inv and hasattr(inv, 'created_at') and inv.created_at:
            delta_sec = (entry.created_at - inv.created_at).total_seconds()
            if delta_sec >= 0:
                paid_times_sec.append(delta_sec)

    avg_time_sec = int(sum(paid_times_sec) / len(paid_times_sec)) if paid_times_sec else None

    # Note: This counts invoices updated yesterday with SOME failure recorded (last_failure_reason),
    # not distinct failure events, as last_failure_reason only stores the most recent failure message.
    failed_count = Invoice.objects.filter(
        updated_at__range=(start, end), last_failure_reason__gt=''
    ).count()

    refund_entries = PaymentLedgerEntry.objects.filter(
        created_at__range=(start, end), entry_type='credit'
    )

    from apps.subscriptions.models import DunningRecoveryLog
    dunning_recoveries = DunningRecoveryLog.objects.filter(
        recovered_at__range=(start, end)
    ).count()

    snapshot, created = PaymentMetricSnapshot.objects.update_or_create(
        date=yesterday,
        defaults={
            'total_payment_attempts': paid_entries.count() + failed_count,
            'successful_payments': paid_entries.count(),
            'failed_payments': failed_count,
            'avg_time_to_payment_seconds': avg_time_sec,
            'reconciliation_catches': reconciliation_catches,
            'refunds_processed': refund_entries.count(),
            'refund_total_amount': refund_entries.aggregate(total=models.Sum('amount'))['total'] or Decimal('0'),
            'dunning_recoveries': dunning_recoveries,
        }
    )
    logger.info(
        "payment_metrics_computed",
        extra={
            'date': str(yesterday),
            'successful_payments': paid_entries.count(),
            'failed_payments': failed_count,
            'reconciliation_catches': reconciliation_catches,
            'refunds_processed': refund_entries.count(),
            'dunning_recoveries': dunning_recoveries,
        }
    )
    return f"Computed metrics for {yesterday}: {snapshot.successful_payments} successful payments"



