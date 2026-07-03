from celery import shared_task
from django.conf import settings
from django.utils import timezone
import os
from .models import SubscriptionInvoice
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

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
