<div align="center">

# MediClinic — Multi-Tenant Healthcare & Clinic Management Platform

**A scalable, enterprise-ready healthcare platform engineered for modern clinics, multi-specialty practices, and hospital networks.**

[![Django](https://img.shields.io/badge/Django-6.0-092E20?style=flat-square&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Django REST Framework](https://img.shields.io/badge/DRF-3.15-A30000?style=flat-square&logo=django&logoColor=white)](https://www.django-rest-framework.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15_(App_Router)-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-Design_Tokens-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Razorpay](https://img.shields.io/badge/Razorpay-Route_%26_Subscriptions-0C2340?style=flat-square&logo=razorpay&logoColor=white)](https://razorpay.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

[System Architecture](#system-architecture) &bull; [Domain Models & Features](#domain-models--feature-breakdown) &bull; [Security & Authentication](#security--authentication-architecture) &bull; [Design System](#design-system--frontend-architecture) &bull; [API Specification](#api-specification) &bull; [Testing Strategy](#testing-strategy) &bull; [Getting Started](#getting-started) &bull; [Environment Configuration](#environment-configuration)

</div>

---

## Executive Summary

MediClinic is an enterprise-grade, multi-tenant Electronic Health Record (EHR) and clinic management platform. It standardizes and automates clinic workflows end-to-end: online patient discovery, multi-step booking with real-time schedule conflict prevention, waiting room queue tokenization, clinical charting and prescription generation, multi-tier billing and split marketplace payouts, inventory replenishment tracking, and clinic analytics.

The platform is powered by an end-to-end **Razorpay** financial infrastructure:
- **B2C Patient Booking & Invoicing**: Razorpay Orders, dynamic Payment Links with auto-expiration, and checkout verification.
- **B2B Clinic SaaS Subscriptions**: Recurring Razorpay Subscriptions with automated 18% GST invoicing (CGST + SGST) and atomic status transitions.
- **Marketplace Split Payouts (Razorpay Route)**: Direct clinic bank onboarding with IFSC validation, KYC verification tracking, and platform fee deductions.

The backend is architected around strict multi-tenancy with tenant-scoped querysets, robust role-based access control (RBAC), multi-factor authentication (MFA/TOTP), asynchronous transactional notification dispatching via Celery/Redis, and PostgreSQL GiST exclusion constraints for concurrent schedule safety.

---

## System Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │           Client Layer (Browser / TV)        │
                               └──────────────────────┬───────────────────────┘
                                                      │ HTTPS / WSS
                               ┌──────────────────────▼───────────────────────┐
                               │    Next.js 15 App Router Frontend (Port 3000)│
                               │  - Server Components (SSR Landing & Public)  │
                               │  - Client Components (Interactive Portals)   │
                               │  - Design System Tokens (Teal / Warm Paper)  │
                               │  - Axios Interceptors with Token Rotation    │
                               └──────────────────────┬───────────────────────┘
                                                      │ JSON REST API / Bearer JWT
                               ┌──────────────────────▼───────────────────────┐
                               │      Django 6.0 + DRF API Layer (Port 8000)  │
                               │  - Tenant Scoping & RBAC Middleware          │
                               │  - Rate Limiting & Fail-Open Throttling      │
                               │  - Multi-Channel Razorpay Orchestrator       │
                               │  - Signal-Driven Audit & Notifications       │
                               └──────┬───────────────┬──────────────┬────────┘
                                      │               │              │
                    ┌─────────────────▼────┐   ┌──────▼──────┐   ┌───▼──────────────────┐
                    │ PostgreSQL 15 Engine │   │ Redis Store │   │ External Services    │
                    │ - GiST Range Indexes │   │ - Celery    │   │ - Razorpay Orders    │
                    │ - ExclusionConstraint│   │   Broker    │   │ - Razorpay Subs      │
                    │ - Audit & EHR Tables │   │ - Cache     │   │ - Razorpay Route     │
                    └──────────────────────┘   └──────┬──────┘   │ - SMTP / Gmail Relay │
                                                      │          └──────────────────────┘
                                               ┌──────▼──────┐
                                               │Celery Worker│
                                               │Async Emails │
                                               └─────────────┘
```

---

## Domain Models & Feature Breakdown

### 1. Multi-Tenant Clinic Management (`apps/clinics`)
- **Tenant Isolation**: Data isolation enforced at database query level via `TenantScopedAPIView` and `ClinicQuerysetMixin`.
- **Marketplace Payouts (Razorpay Route)**: Direct onboarding of clinic bank accounts with IFSC verification, linked account tracking (`not_started`, `kyc_submitted`, `kyc_under_review`, `kyc_verified`, `kyc_rejected`), and split-settlement platform fees.
- **Receptionist Seat Allocation**: Governed single-receptionist-per-clinic seat model with UUID-based email invitations and automated token invalidation.

### 2. Doctor Schedules & Availability (`apps/doctors`)
- **Multi-Clinic Associations (`DoctorClinic`)**: Decouples medical practitioner profiles from clinic affiliations. Enables doctors to practice across multiple clinics with distinct consultation fees, shifts, and schedules.
- **7-Day Shift Block Engine (`DoctorSchedule`)**: Weekly shift scheduler supporting multiple discontinuous time windows per day, customizable consultation slot intervals (15, 30, 45, 60 mins), and client/server overlap prevention.
- **Leave Management & Doctor Ratings**: Clinically reviewed leave request lifecycle (`DoctorLeave`) with automatic calendar slot blocking and patient consultation reviews (`DoctorReview`).

### 3. Concurrency-Safe Appointments & Queue Engine (`apps/appointments`)
- **Database-Level Exclusion Constraints**: Utilizes PostgreSQL `DateTimeRangeField` combined with a `bstrap` GiST `ExclusionConstraint` to enforce physical impossibility of double-booking consultation slots across concurrent requests.
- **State Machine**: Deterministic transitions across `SCHEDULED`, `CONFIRMED`, `WAITING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, and `NO_SHOW`.
- **Public TV Queue Display (`/queue-display`)**: Real-time room token display for clinic waiting rooms with audio/visual status indicators.
- **Doctor Running Late Broadcast**: Notifies waiting patients with adjusted estimated consultation times.

### 4. Electronic Health Records & Clinical Charting (`apps/records`, `apps/prescriptions`)
- **Structured Consultation Records (`MedicalRecord`)**: Standardized capture of chief complaints, symptoms, physical examination vitals (Blood Pressure, Heart Rate, Respiratory Rate, Temperature, SpO2, Weight, Height, BMI), and clinical diagnoses.
- **Digital Prescription Builder (`Prescription`)**: Form-driven prescription generation specifying drug name, formulation (tablet, syrup, injection), dosage, route, frequency, duration, and dietary instructions.
- **Prescription Template Engine (`PrescriptionTemplate`)**: Reusable prescription templates categorized by diagnosis for rapid 1-click clinical charting.
- **Doctor Confidential Notes**: Dedicated clinician-only private notes field scrubbed from patient-facing API serialization.

### 5. Patient Intake & Digital Onboarding (`apps/patients`)
- **Pre-Consultation Intake Forms (`IntakeForm`)**: Patient-submitted medical history, chronic conditions, past surgeries, known drug allergies, and active medications.
- **Patient History Records**: Centralized chronological timeline of past diagnoses, prescriptions, invoices, and completed appointments.

### 6. Billing, Invoicing & Financial Ledger (`apps/billing`)
- **Itemized Invoicing (`Invoice`)**: Automatic compilation of doctor consultation fees, prescribed pharmaceuticals, and laboratory services with tax, discount, and status tracking (`draft`, `pending`, `paid`, `expired`, `cancelled`, `refunded`, `pending_at_clinic`).
- **Razorpay Payment Links**: Dynamic generation of online payment links with auto-expiration sent via email/SMS.
- **Double-Entry Financial Ledger (`PaymentLedgerEntry`)**: Immutable ledger recording `DEBIT`, `CREDIT`, `REFUND`, `TRANSFER_IN`, `TRANSFER_OUT` movements.
- **Transactional Outbox Pattern (`PaymentOutboxEvent`)**: Asynchronous, guaranteed processing of payment events, invoice emails, and PDF generation.
- **Razorpay Webhook Engine (`/api/billing/webhook/`)**: Idempotent webhook verification storing incoming events in `WebhookEvent` to prevent duplicate processing.
- **Resilient Key Fallback Hierarchy**: Dynamic Razorpay payment verification chain cascading across `PlatformSettings`, environment variables, and client credentials.

### 7. Clinic Inventory & Stock Management (`apps/inventory`)
- **Stock Tracking (`InventoryItem`)**: SKU catalog management with real-time quantities, units, unit costs, and reorder thresholds.
- **Transaction Ledger (`StockTransaction`)**: Immutable audit log of every stock movement (`ADD`, `DEDUCT`, `ADJUST`) with batch tracking, expiration warnings, and automatic low-stock notifications.

### 8. SaaS Subscription Engine (`apps/subscriptions`)
- **Razorpay Recurring Subscriptions**: Automated recurring subscription lifecycle integration (`razorpay_customer_id`, `razorpay_subscription_id`, `razorpay_plan_id`).
- **GST Compliance & Invoicing (`SubscriptionInvoice`)**: Automatic calculation of 18% GST (9% CGST + 9% SGST) with itemized tax invoices.
- **Atomic Subscription State Machine**: Strict transition validation across `trialing`, `created`, `active`, `past_due`, `halted`, `cancelled`, and `expired`.
- **Automated Dunning & Recovery Engine**: 10-day payment grace period, 4-stage dunning cadence (`day_1`, `day_3`, `day_5`, `day_7_final`), and recovery tracking (`DunningRecoveryLog`).
- **Tiered Feature Gating**: Permission classes (`IsFeatureSubscribed`) guarding analytics, billing, inventory, and doctor seat limits based on active tier (`Starter`, `Professional`, `Enterprise`).

### 9. System Auditing & Notifications (`apps/audit`, `apps/notifications`)
- **Immutable Audit Trail (`AuditLog`)**: Comprehensive recording of user actions, targeting models, IP addresses, user agents, action types (`CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`), and payload diffs.
- **Signal-Driven Notifications**: Real-time in-app alerts and asynchronous transactional email dispatch via Celery workers for bookings, cancellations, and staff invites.

---

## Role-Based Access Control (RBAC) Matrix

| Feature / Domain | Super Admin | Clinic Admin | Doctor | Receptionist | Patient | Public |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Multi-Clinic Telemetry & Platform Overview | Full | - | - | - | - | - |
| Clinic Settings, Staff Invites & Bank Setup | Full | Full | - | - | - | - |
| SaaS Subscription Management (Razorpay) | Full | Full | - | - | - | - |
| Weekly Shift Schedule Configuration | Full | Full | View/Self | - | - | - |
| Inventory Catalog & Stock Adjustments | Full | Full | View | - | - | - |
| Patient Queue & Walk-In Registration | Full | Full | View | Full | - | - |
| Clinical Charting & Prescriptions | Full | - | Full (Assigned) | - | - | - |
| Doctor Private Notes | - | - | Full (Author) | - | - | - |
| Patient Intake Forms | Full | Full | View (Assigned) | View | Full (Self) | - |
| Online Appointment Booking | Full | Full | - | Full (Assigned) | Full (Self) | - |
| Medical Records & Prescriptions View | Full | - | Full (Assigned) | - | View (Self) | - |
| Public Doctor Directory & Queue TV | Full | Full | Full | Full | Full | Full |

---

## Security & Authentication Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │               Incoming Request Authentication          │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          │                                           │
               [ Staff Login Flow ]                         [ Patient Login Flow ]
                          │                                           │
             Password + Email Credentials                    Email OTP Verification
                          │                                           │
             MFA Status Verification Check                 Rate Limited (3 req / 60s)
                          │                                           │
          ┌───────────────┴───────────────┐                  OTP Expiration (10 mins)
          │                               │                           │
   [ MFA Enrolled ]             [ MFA Not Enrolled ]                  │
          │                               │                           │
   TOTP / Backup Code           Mandatory Setup Gate                  │
   Verification                  (Secret + QR Code)                   │
          │                               │                           │
          └───────────────┬───────────────┘                           │
                          │                                           │
                          └─────────────────────┬─────────────────────┘
                                                │
                                    ┌───────────▼───────────┐
                                    │  Issue JWT Token Pair │
                                    │  - 30 min Access Token│
                                    │  - 7 day Refresh Token│
                                    └───────────────────────┘
```

1. **Staff Multi-Factor Authentication (MFA/TOTP)**:
   - Compulsory 2FA setup for all administrative and medical personnel (`CLINIC_ADMIN`, `DOCTOR`, `RECEPTIONIST`).
   - Standard RFC 6238 TOTP algorithm compatible with Google Authenticator, Authy, and 1Password.
   - 8-digit cryptographically hashed backup recovery codes with single-use consumption and unskippable route gates.
2. **Patient Passwordless Email OTP**:
   - Secure numeric one-time passcode with 10-minute TTL, server-side cooldown timers, and brute-force lockout protection.
3. **JWT Stateless Token Architecture**:
   - Short-lived 30-minute access tokens and 7-day rotating refresh tokens.
   - Automatic silent token refresh via Axios response interceptors on the client.
4. **Fail-Open Rate Limiting**:
   - Redis-backed throttling policies protecting sensitive authentication routes against brute-force attacks with graceful fallback during cache degradation.

---

## Design System & Frontend Architecture

The MediClinic frontend adheres to an architectural design system implemented with strict semantic tokens, entirely replacing generic Tailwind palettes:

```
Design Token Tokens:
  --color-primary:       #0F7B6C  (Deep Surgical Teal)
  --color-primary-dark:  #0B5A4F  (Deep Teal Hover)
  --color-accent:        #E8734A  (Coral Action Highlight)
  --color-ink:           #111827  (Primary Text Hierarchy)
  --color-muted:         #6B7280  (Secondary Text & Labels)
  --color-paper:         #FFFFFF  (Pure Card & Modal Background)
  --color-warm-surface:  #F4F1EA  (Subtle Organic Background Canvas)
  --color-border:        #EDEDE8  (Structural Dividers & Outlines)
```

- **Layout Shell**: Responsive sidebar with collapsible states, route active indicator pills, breadcrumbs, live sync badges, and authenticated profile cards.
- **Component Primitives**: Standardized `Card`, `Button`, `Input`, `Table`, `Modal`, `Tabs`, and `StatusBadge` primitives.
- **Unified Status Dictionary**: Consistent semantic pill indicators (`ACTIVE`, `CONFIRMED`, `SCHEDULED`, `PENDING`, `COMPLETED`, `CANCELLED`, `EXPIRED`, `LOW_STOCK`, `OUT_OF_STOCK`).

---

## API Specification

All endpoints are hosted under `http://127.0.0.1:8000/api/` and require `Authorization: Bearer <access_token>` header unless marked Public.

### Authentication & Staff MFA (`/api/accounts/`)
| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/api/token/` | Public | Obtain JWT token pair using credentials |
| `POST` | `/api/token/refresh/` | Public | Refresh expired JWT access token |
| `POST` | `/api/accounts/patient/otp/request/` | Public | Request email OTP for patient authentication |
| `POST` | `/api/accounts/patient/otp/verify/` | Public | Verify OTP and authenticate patient |
| `POST` | `/api/accounts/mfa/setup/` | Staff | Generate TOTP secret and QR code URI |
| `POST` | `/api/accounts/mfa/confirm/` | Staff | Confirm TOTP code and issue 8-digit backup codes |
| `POST` | `/api/accounts/mfa/verify/` | Staff | Complete MFA login challenge using TOTP code |
| `POST` | `/api/accounts/mfa/recover/` | Staff | Recover access using one-time backup code |

### Clinical Operations & Appointments (`/api/appointments/`, `/api/records/`)
| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/api/public/clinics/` | Public | List active public clinics |
| `GET` | `/api/public/specialties/` | Public | List available medical specializations |
| `GET` | `/api/public/doctors/<id>/slots/` | Public | Calculate available doctor consultation slots |
| `POST` | `/api/appointments/book/` | Patient/Staff | Book a new consultation appointment |
| `PATCH` | `/api/appointments/<id>/status/` | Staff | Transition appointment state (Confirmed, In-Progress, etc.) |
| `POST` | `/api/records/` | Doctor | Create structured medical consultation record |
| `POST` | `/api/records/prescriptions/` | Doctor | Issue electronic prescription with dosage instructions |
| `GET` | `/api/records/templates/` | Doctor | Fetch reusable diagnosis-based prescription templates |

### Billing, Payments & Subscriptions (`/api/billing/`, `/api/subscriptions/`)
| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/api/create-order/` | Patient/Staff | Create Razorpay order for consultation booking |
| `POST` | `/api/verify-payment/` | Patient/Staff | Verify Razorpay payment signature and confirm booking |
| `POST` | `/api/billing/webhook/` | Public | Idempotent Razorpay webhook consumer |
| `POST` | `/api/billing/onboard-bank/` | Clinic Admin | Onboard clinic bank account for Razorpay Route payouts |
| `POST` | `/api/billing/invoices/<id>/generate-payment-link/` | Staff | Generate direct Razorpay payment link |
| `POST` | `/api/subscriptions/create/` | Clinic Admin | Create Razorpay recurring subscription |
| `POST` | `/api/subscriptions/verify/` | Clinic Admin | Verify subscription signature and activate tier |
| `GET` | `/api/subscriptions/invoices/` | Clinic Admin | List GST subscription invoices |
| `POST` | `/api/subscriptions/cancel/` | Clinic Admin | Cancel active recurring subscription |

---

## Testing Strategy

The repository is covered by automated unit, integration, and browser end-to-end (E2E) suites:

```
Test Architecture:
├── Backend Test Suite (Django / Pytest)
│   ├── Unit tests for business logic, tenancy, and serializers
│   ├── Integration tests for Razorpay payment fallback chains and webhooks
│   ├── Dunning transition tests and atomic subscription state validation
│   └── Database constraint tests for schedule overlap prevention
├── Frontend Test Suite (Vitest / React Testing Library)
│   ├── Component unit tests for auth forms, Razorpay checkout, and dashboard charts
│   └── Performance unblocking and state transition tests
└── End-to-End Suite (Playwright)
    ├── Doctor, Receptionist, and Admin invite acceptance flows
    ├── Token reuse prevention and expiration validation
    ├── Patient passwordless OTP authentication lifecycle
    └── Staff MFA enrollment, navigation gate, and backup code recovery
```

### Running Test Suites

```bash
# 1. Run Backend Pytest Suite
cd backend
.\venv\Scripts\python.exe -m pytest

# 2. Run Frontend Vitest Suite
cd frontend
npm run test

# 3. Run Playwright End-to-End Suite
cd frontend
npx playwright test
```

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- PostgreSQL 14+
- Redis Server (for Celery async tasks and caching)

---

### Step 1: Clone Repository
```bash
git clone https://github.com/anvesh9621/Multi-Clinic-Healthcare-Platform.git
cd Multi-Clinic-Healthcare-Platform
```

---

### Step 2: Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate      # Windows
# source venv/bin/activate   # Linux / macOS

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env

# Apply database migrations
python manage.py migrate

# (Optional) Create superuser for Django administration
python manage.py createsuperuser

# Start development API server
python manage.py runserver 127.0.0.1:8000
```

---

### Step 3: Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.local.example .env.local

# Start Next.js development server
npm run dev
```

The frontend application will be available at `http://localhost:3000` and the backend API at `http://127.0.0.1:8000/api/`.

---

### Step 4: Asynchronous Task Worker (Optional for Local Development)
```bash
cd backend
celery -A config worker --loglevel=info
```

---

## Environment Configuration

### Backend (`backend/.env`)
```env
# Django Core
SECRET_KEY=your-secure-django-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# PostgreSQL Database
DB_NAME=mediclinic_db
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_HOST=localhost
DB_PORT=5432

# Redis & Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Transactional Email (SMTP)
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
FRONTEND_URL=http://localhost:3000

# Razorpay (Patient Orders, Invoicing, Subscriptions, & Route Payouts)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your-razorpay-secret...
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret...
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for complete details.
