# Elite Central Vacuum - Services, Operations & Platform API Guide

This is the comprehensive API guide for the **Services Catalog, Intake Requests, Scheduling & Dispatch, Quotations, Service Orders, Billing/Invoices, Technicians, Service Reviews, Operations Analytics, System Configuration, and AI Assistant** domain of the Elite Central Vacuum platform.

---

## Table of Contents
1. [Platform Architecture & Auth Matrix](#1-platform-architecture--auth-matrix)
2. [Fixed Services Catalog & Symptoms](#2-fixed-services-catalog--symptoms)
3. [Service Requests Intake & Admin Triage](#3-service-requests-intake--admin-triage)
4. [Scheduling & Dispatch Board](#4-scheduling--dispatch-board)
5. [Quotations Lifecycle](#5-quotations-lifecycle)
6. [Service Orders Execution & Live ETA](#6-service-orders-execution--live-eta)
7. [Billing, Invoices & Online Stripe Payments](#7-billing-invoices--online-stripe-payments)
8. [Team & Technicians Management](#8-team--technicians-management)
9. [Service Customer Reviews & Moderation](#9-service-customer-reviews--moderation)
10. [Executive Analytics & Service Funnel](#10-executive-analytics--service-funnel)
11. [System Configuration & Policies](#11-system-configuration--policies)
12. [AI Troubleshooting Assistant](#12-ai-troubleshooting-assistant)

---

## 1. Platform Architecture & Auth Matrix

- **Base URL**: `http://localhost:3000`
- **Swagger Documentation**: `http://localhost:3000/docs`
- **Auth Header**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`

| Role | Access Permissions |
| :--- | :--- |
| **Public** (`No Token`) | View catalog, check slot availability, read published FAQs/policies/reviews, submit guest service intake |
| **Customer** (`@Roles('CUSTOMER')`) | Submit intake, view & accept/reject quotations, track service orders, pay invoices online, submit reviews |
| **Technician** (`@Roles('TECHNICIAN')`) | View assigned jobs, update live arrival ETA, report work status |
| **Admin** (`@Roles('ADMIN')`) | Full operations control: triage requests, issue quotations, assign technicians, manage invoices/payments, manage system settings, view analytics |

---

## 2. Fixed Services Catalog & Symptoms

### 10 Fixed Offerings across 2 Groups
- **Group 1: `SERVICE_AND_MAINTENANCE`**
  1. `vacuum-repair` ("Vacuum Repair", Icon: `Wrench`)
  2. `maintenance-troubleshooting` ("Maintenance & Troubleshooting", Icon: `Pulse`)
  3. `low-suction-fix` ("Low Suction Fix", Icon: `Zap`)
  4. `pipe-unclogging` ("Pipe Unclogging", Icon: `Layers`)
  5. `inspection-tune-up` ("Inspection & Tune-up", Icon: `CheckCircle`)
  6. `motor-noise-diagnostics` ("Motor & Noise Diagnostics", Icon: `Activity`)
- **Group 2: `INSTALLATION`**
  7. `new-system-installation` ("New System Installation", Icon: `Sparkles`)
  8. `replacement-upgrade` ("Replacement & Upgrade", Icon: `Package`)
  9. `inlet-valve-expansion` ("Inlet Valve Expansion", Icon: `PlusCircle`)
  10. `retractable-hose-install` ("Retractable Hose Installation", Icon: `Shield`)

### 8 Fixed Symptom Checkboxes (`RequestSymptom`)
`UNIT_NOT_TURNING_ON`, `UNIT_DOES_NOT_SHUT_OFF`, `CLOGGED`, `LOW_SUCTION`, `WALL_OR_POWER_HOSE_PROBLEM`, `BROKEN_INLET`, `NOISE`, `OTHER`.

### Endpoints
* **`GET /services`** (Public)
  - Returns grouped offerings and symptom definitions.
* **`GET /services/:slug`** (Public)
  - Returns single service metadata, common issues, and recommended symptoms.

---

## 3. Service Requests Intake & Admin Triage

* **`POST /service-requests`** (Public / Customer)
  - Submits service request. Generates monotonic `REQ-YYYYMMDD-XXXXX`.
  - Body:
    ```json
    {
      "serviceSlug": "vacuum-repair",
      "symptoms": ["LOW_SUCTION", "NOISE"],
      "urgency": "HIGH",
      "title": "Main unit making loud rattling noise",
      "description": "Suction dropped suddenly and vacuum unit rattles when turned on.",
      "preferredDate": "2026-08-28",
      "preferredTime": "Morning (8:00 AM - 12:00 PM)",
      "propertyLabel": "Home",
      "contactInfo": {
        "fullName": "Sarah Connor",
        "email": "sarah@example.com",
        "phone": "+1-555-432-1098",
        "address": "456 Oak Ridge Lane",
        "city": "Greenwich",
        "state": "CT",
        "postalCode": "06830"
      }
    }
    ```
* **`GET /service-requests/me`** (Customer)
  - Customer's own service requests with status.
* **`GET /service-requests`** (Admin)
  - Admin triage list with KPI counters (`submitted`, `underReview`, `accepted`, `rejected`, `scheduled`, `total`).
* **`GET /service-requests/:id`** (Customer / Admin)
  - Request details with linked quotations and appointments.
* **`PATCH /service-requests/:id/status`** (Admin)
  - Transition status (`SUBMITTED` $\rightarrow$ `UNDER_REVIEW` $\rightarrow$ `ACCEPTED` $\rightarrow$ `REJECTED` $\rightarrow$ `SCHEDULED` $\rightarrow$ `COMPLETED`).
* **`POST /service-requests/:id/reject`** (Admin)
  - Reject request with recorded reason.

---

## 4. Scheduling & Dispatch Board

* **`GET /schedule/slots?date=YYYY-MM-DD`** (Public / Customer)
  - Computes 2-hour slot availability with `isBooked: boolean` and `status: "FREE" | "BOOKED"`.
* **`GET /schedule/board`** (Admin)
  - Dispatch board overview of all appointments, assigned technicians, and timeslots.
* **`POST /schedule`** (Admin / Customer)
  - Book appointment: `{ "serviceRequestId": "uuid", "scheduledDate": "2026-08-28", "timeSlot": "08:00-10:00", "technicianId": "uuid" }`.
* **`POST /schedule/:appointmentId/assign`** (Admin)
  - Reassign technician to appointment.
* **`POST /schedule/:appointmentId/cancel`** (Admin / Customer)
  - Cancel appointment.

---

## 5. Quotations Lifecycle

```
Service Request (REQ) ──► Admin Creates Quote (QUO) ──► Sent to Customer ──► Customer Accepts ──► Auto-Created Service Order (SO)
```

* **`POST /quotations`** (Admin)
  - Generates `QUO-YYYYMMDD-XXXXX` with itemized labor/parts, discount, tax, total, and validity.
  - Body:
    ```json
    {
      "serviceRequestId": "uuid-here",
      "validUntil": "2026-09-15T00:00:00.000Z",
      "lineItems": [
        { "description": "Motor Diagnostic & Replacement", "type": "LABOR", "quantity": 1, "unitPriceUsd": 180 },
        { "description": "Ametek Lamb 120V Vacuum Motor", "type": "PART", "quantity": 1, "unitPriceUsd": 220 }
      ],
      "discountUsd": 20,
      "taxUsd": 24.70,
      "notes": "Includes 1-year parts warranty."
    }
    ```
* **`PATCH /quotations/:id`** (Admin)
  - Updates quotation. Revisions are automatically captured in `QuotationRevision`.
* **`POST /quotations/:id/send`** (Admin)
  - Transitions quotation status to `SENT`.
* **`POST /quotations/:id/accept`** (Customer / Admin)
  - **Accepts quotation and automatically provisions a `ServiceOrder` (`SO-YYYYMMDD-XXXXX`) linked to the quotation**.
* **`POST /quotations/:id/reject`** (Customer / Admin)
  - Records rejection reason in `QuotationRejection`.
* **`GET /quotations/me`** (Customer) & **`GET /quotations`** (Admin)
  - List quotations.

---

## 6. Service Orders Execution & Live ETA

* **`GET /service-orders`** (Admin)
  - Operations list with KPI counters (`scheduled`, `technicianAssigned`, `inProgress`, `completed`, `cancelled`, `total`).
* **`GET /service-orders/me`** (Customer)
  - Customer's active and completed service orders.
* **`GET /service-orders/:id`** (Customer / Technician / Admin)
  - Details with technician profile, appointment, quotation, report, timeline history, and invoices.
* **`POST /service-orders/:id/assign`** (Admin)
  - Assign technician to service order.
* **`POST /service-orders/:id/eta`** (Admin / Technician)
  - Update live arrival ETA in minutes: `{ "minutes": 25 }`.
* **`PATCH /service-orders/:id/status`** (Admin / Technician)
  - Update status (`SCHEDULED`, `TECHNICIAN_ASSIGNED`, `TECHNICIAN_EN_ROUTE`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
  - **When status is set to `COMPLETED`, an invoice is automatically issued**.

---

## 7. Billing, Invoices & Online Stripe Payments

* **`GET /billing/invoices`** (Admin) & **`GET /billing/invoices/me`** (Customer)
  - Unified list with KPI badges (`issued`, `paid`, `partiallyPaid`, `overdue`, `void`, `total`).
* **`GET /billing/invoices/:id`** (Customer / Admin)
  - Line items, payment history, and refunds.
* **`GET /billing/invoices/:id/html`** (Customer / Admin)
  - Printable, production-styled HTML invoice stream.
* **`POST /billing/invoices/:id/stripe/payment-intent`** (Customer / Admin)
  - Creates a Stripe PaymentIntent for the invoice remaining balance. Returns `{ clientSecret, paymentIntentId, amountUsd }`.
* **`POST /billing/invoices/:id/stripe/confirm`** (Customer / Admin)
  - Confirms Stripe payment and updates invoice status to `PAID`.
* **`POST /billing/invoices/:id/payments`** (Admin)
  - Record manual in-person payment (Credit Card, Cash, Check).
* **`POST /billing/invoices/:id/refunds`** (Admin)
  - Record refund against payment.

---

## 8. Team & Technicians Management

* **`GET /technicians`** (Admin)
  - List technicians with status filters (`ACTIVE`, `INACTIVE`, `ON_LEAVE`, `SUSPENDED`), search, and real-time stats.
* **`GET /technicians/:id`** (Admin)
  - Detailed profile with assigned jobs, upcoming appointments, and ratings.
* **`POST /technicians`** (Admin)
  - Create technician user account (role `TECHNICIAN`) and linked technician profile.
* **`PATCH /technicians/:id`** (Admin)
  - Update rating, completed jobs, specializations, availability, and status.
* **`DELETE /technicians/:id`** (Admin)
  - Deactivate technician.

---

## 9. Service Customer Reviews & Moderation

* **`POST /reviews`** (**Customer Only** - `@Roles('CUSTOMER')`)
  - Submit review for a completed service order:
    ```json
    {
      "type": "SERVICE",
      "serviceOrderId": "uuid-here",
      "rating": 5,
      "title": "Fast and quiet repair!",
      "body": "The technician arrived on time and fixed the low suction in 45 minutes."
    }
    ```
* **`GET /reviews?type=SERVICE&serviceId=uuid-here`** (Public)
  - Public reviews with computed average rating.
* **`GET /reviews/admin/all`** (Admin)
  - Moderation queue with KPI counts (`pending`, `published`, `hidden`).
* **`PATCH /reviews/:id/moderate`** (Admin)
  - Moderate review (`action: "PUBLISHED" | "HIDDEN" | "DELETED"`).

---

## 10. Executive Analytics & Service Funnel

* **`GET /reports/overview`** (Admin)
  - **Overview Metrics**: `totalRevenue`, `productRevenue`, `serviceRevenue`, `totalOrders`, `refundAmount`, `productOrdersCount`, `serviceOrdersCount`, `completedServicesCount`, `pendingRequestsCount`, `outstandingInvoicesCount`.
  - **`revenueOverTime`**: 14-day timeseries data points (`date`, `productRevenue`, `serviceRevenue`, `totalRevenue`).
  - **`serviceFunnel`**: (`requested` $\rightarrow$ `accepted` $\rightarrow$ `quoted` $\rightarrow$ `quoteAccepted` $\rightarrow$ `serviceOrder` $\rightarrow$ `completed`).
* **`GET /reports/service-operations`** (Admin)
  - Request volume and top requested services breakdown.
* **`GET /reports/technicians`** (Admin)
  - Technician leaderboard by completed jobs and rating.
* **`GET /reports/customers`** (Admin)
  - Total customers and repeat service rate.

---

## 11. System Configuration & Policies

* **`GET /settings/business-profile`** (Public / Admin) & **`PATCH /settings/business-profile`** (Admin)
  - Business name, email, phones, address, coverage notes, 7-day operating hours (`businessHours`), and social links.
* **`GET /settings/faqs`** (Public), **`POST /settings/faqs`**, **`PATCH /settings/faqs/:id`**, **`DELETE /settings/faqs/:id`** (Admin)
  - Question & Answer FAQ management grouped by category.
* **`GET /settings/policies`** (Public), **`GET /settings/policies/:slug`** (Public), **`POST /settings/policies`**, **`PATCH /settings/policies/:id`** (Admin)
  - Legal policy management (Terms of Service, Privacy Policy, Warranty).

---

## 12. AI Troubleshooting Assistant

* **`POST /ai/chat`** (Public)
  - Context-aware vacuum troubleshooting conversation powered by Google Gemini AI (`gemini-2.5-flash`).
* **`POST /ai/chat/stream`** (Public)
  - Server-Sent Events (SSE) streaming chat response.
* **`POST /ai/service-intake`** (Public)
  - Generates structured symptom recommendations and urgency evaluation from customer natural language description.
