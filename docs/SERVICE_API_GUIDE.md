# Elite Central Vacuum - Services, Operations & Platform API Guide

This is the comprehensive API guide for the **Services Catalog, Customer Intake Requests, Customer-Driven Scheduling & Dispatch, Quotations, Service Orders, Billing/Invoices, Technicians, Service Reviews, Operations Analytics, System Configuration, and AI Assistant** domain of the Elite Central Vacuum platform.

---

## Table of Contents
1. [Platform Architecture & Auth Matrix](#1-platform-architecture--auth-matrix)
2. [Fixed Services Catalog & Symptoms](#2-fixed-services-catalog--symptoms)
3. [Customer-Driven Scheduling & Availability Engine](#3-customer-driven-scheduling--availability-engine)
4. [Service Requests Intake & Admin Triage](#4-service-requests-intake--admin-triage)
5. [Scheduling Management & Dispatch Board](#5-scheduling-management--dispatch-board)
6. [Quotations Lifecycle](#6-quotations-lifecycle)
7. [Service Orders Execution & Live ETA](#7-service-orders-execution--live-eta)
8. [Billing, Invoices & Online Stripe Payments](#8-billing-invoices--online-stripe-payments)
9. [Team & Technicians Management](#9-team--technicians-management)
10. [Service Customer Reviews & Moderation](#10-service-customer-reviews--moderation)
11. [Executive Analytics & Service Funnel](#11-executive-analytics--service-funnel)
12. [System Configuration & Legal Policies](#12-system-configuration--legal-policies)
13. [AI Troubleshooting Assistant](#13-ai-troubleshooting-assistant)

---

## 1. Platform Architecture & Auth Matrix

- **Base URL**: `http://localhost:3000`
- **Swagger Documentation**: `http://localhost:3000/docs` (Includes dark theme and Bearer Token Authorization)
- **Auth Header**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`

| Role | Access Permissions |
| :--- | :--- |
| **Public** (`No Token`) | View services catalog, check live slot availability (`GET /schedule/slots`), read published FAQs/policies/reviews, AI assistant chat |
| **Customer** (`@Roles('CUSTOMER')`) | **Required for service intake submission (`POST /service-requests`)**, view my requests (`GET /service-requests/me`), accept/reject quotations, track service orders, pay invoices online, submit reviews |
| **Technician** (`@Roles('TECHNICIAN')`) | View assigned jobs, update live arrival ETA, report work status |
| **Admin** (`@Roles('ADMIN')`) | Full operations control: triage requests, issue/revise quotations, reschedule appointment slots, assign technicians, manage invoices/payments, manage system settings, view analytics |

---

## 2. Fixed Services Catalog & Symptoms

### 10 Fixed Offerings across 2 Groups
- **Group 1: `SERVICE_AND_MAINTENANCE`**
  1. `vacuum-repair` ("Vacuum Repair", Icon: `Wrench`, Base: $120.00)
  2. `maintenance-troubleshooting` ("Maintenance & Troubleshooting", Icon: `Pulse`, Base: $95.00)
  3. `low-suction-fix` ("Low Suction Fix", Icon: `Zap`, Base: $110.00)
  4. `pipe-unclogging` ("Pipe Unclogging", Icon: `Layers`, Base: $135.00)
  5. `inspection-tune-up` ("Inspection & Tune-up", Icon: `CheckCircle`, Base: $85.00)
  6. `motor-noise-diagnostics` ("Motor & Noise Diagnostics", Icon: `Activity`, Base: $125.00)
- **Group 2: `INSTALLATION`**
  7. `new-system-installation` ("New System Installation", Icon: `Sparkles`, Base: $1800.00)
  8. `replacement-upgrade` ("Replacement & Upgrade", Icon: `Package`, Base: $650.00)
  9. `inlet-valve-expansion` ("Inlet Valve Expansion", Icon: `PlusCircle`, Base: $220.00)
  10. `retractable-hose-install` ("Retractable Hose Installation", Icon: `Shield`, Base: $450.00)

### 8 Fixed Symptom Checkboxes (`RequestSymptom`)
`UNIT_NOT_TURNING_ON`, `UNIT_DOES_NOT_SHUT_OFF`, `CLOGGED`, `LOW_SUCTION`, `WALL_OR_POWER_HOSE_PROBLEM`, `BROKEN_INLET`, `NOISE`, `OTHER`.

### Endpoints
* **`GET /services/catalog`** (Public)
  - Returns all 10 service offerings grouped by category with pricing and recommended symptoms.
* **`GET /services/symptoms`** (Public)
  - Returns standard symptom options for customer intake dropdowns.
* **`GET /services/:slug`** (Public)
  - Returns detailed service offering by slug.

---

## 3. Customer-Driven Scheduling & Availability Engine

The schedule is created **directly by the customer** during intake submission. Admin does not need to create future schedules from scratch.

### The 5 Standard Daily Dispatch Slots
1. `09:00 AM - 11:00 AM`
2. `11:00 AM - 01:00 PM`
3. `01:00 PM - 03:00 PM`
4. `03:00 PM - 04:30 PM`
5. `04:30 PM - 06:00 PM`

### Check Availability
* **`GET /schedule/slots?date=YYYY-MM-DD`** (Public)
  - Evaluates all active non-cancelled appointments in PostgreSQL against active fleet capacity.
  - Returns `isBooked: false` / `status: "FREE"` or `isBooked: true` / `status: "BOOKED"`, plus remaining `availableCapacity`.
  - **Example Response**:
    ```json
    {
      "success": true,
      "date": "2026-09-15",
      "totalSlots": 5,
      "availableSlotsCount": 4,
      "bookedSlotsCount": 1,
      "slots": [
        {
          "slot": "09:00 AM - 11:00 AM",
          "startTime": "09:00 AM",
          "endTime": "11:00 AM",
          "isBooked": false,
          "status": "FREE",
          "availableCapacity": 2
        },
        {
          "slot": "11:00 AM - 01:00 PM",
          "startTime": "11:00 AM",
          "endTime": "01:00 PM",
          "isBooked": true,
          "status": "BOOKED",
          "availableCapacity": 0
        }
      ]
    }
    ```

---

## 4. Service Requests Intake & Admin Triage

### Customer Submission
* **`POST /service-requests`** (**Customer Only** - Requires Bearer Token)
  - Accepts `multipart/form-data`:
    - `data` (JSON string)
    - `attachments` (Optional binary photos/videos uploaded directly to Cloudinary)
  - **Payload (`data`)**:
    ```json
    {
      "serviceSlug": "vacuum-repair",
      "fullName": "Jane Doe",
      "phone": "+1 (555) 234-5678",
      "address": "742 Evergreen Terrace",
      "city": "Springfield",
      "state": "OR",
      "zipCode": "97477",
      "problemLocation": "Basement & 2nd Floor",
      "preferredDate": "2026-09-15",
      "timeWindow": "09:00 AM - 11:00 AM",
      "problemDescription": "Low suction upstairs with whining motor noise.",
      "symptoms": ["LOW_SUCTION", "NOISE"],
      "manufacturer": "Beam",
      "modelNumber": "SC375",
      "serialNumber": "SN-98234-X",
      "unitLocation": "Garage"
    }
    ```
  - **Automatic Slot Reservation**:
    1. Validates that the requested `preferredDate` and `timeWindow` have available capacity.
    2. Creates the `ServiceRequest` (`REQ-XXXXX`).
    3. **Immediately creates an `Appointment` record in DB (`status: "CONFIRMED"`)**, locking the slot so it shows as `BOOKED` for subsequent callers.
* **`GET /service-requests/me`** (Customer)
  - Returns all requests submitted by the logged-in customer.

### Admin Triage
* **`GET /service-requests`** (Admin)
  - Searchable, filterable triage inbox with KPI badges (`submitted`, `underReview`, `accepted`, `rejected`, `scheduled`, `total`).
* **`GET /service-requests/:id`** (Customer / Admin)
  - Detailed request view including equipment metadata, photos, linked appointments, quotations, and service orders.
* **`PATCH /service-requests/:id/status`** (Admin)
  - Transitions request status (`SUBMITTED` $\rightarrow$ `UNDER_REVIEW` $\rightarrow$ `ACCEPTED` $\rightarrow$ `SCHEDULED` $\rightarrow$ `COMPLETED`).
* **`POST /service-requests/:id/reject`** (Admin)
  - Rejects request with reason and comments.

---

## 5. Scheduling Management & Dispatch Board

* **`GET /schedule/board?startDate=...&endDate=...`** (Admin)
  - Dispatch board calendar overview of appointments across days and technicians.
* **`PATCH /schedule/:appointmentId`** (Admin)
  - **Reschedule Time Period / Date**: Admin adjusts date or time window without recreating the appointment. Automatically cascades to `ServiceRequest.currentSchedule`.
  - Body:
    ```json
    {
      "date": "2026-09-16",
      "startTime": "01:00 PM",
      "endTime": "03:00 PM",
      "adminNote": "Rescheduled per customer request"
    }
    ```
* **`POST /schedule/:appointmentId/assign`** (Admin)
  - **Assign Technician**: Assigns an active technician after verifying no scheduling conflict.
  - Body:
    ```json
    {
      "technicianId": "uuid-of-technician",
      "adminNote": "Assigned to primary technician"
    }
    ```
* **`POST /schedule/:appointmentId/cancel`** (Admin)
  - Cancels appointment with audit reason note.

---

## 6. Quotations Lifecycle

```
Service Request (REQ) ──► Admin Creates Quote (Auto-Sent to Customer) ──► Customer Decision (PATCH /status) ──► Auto-Created Service Order (SO)
```

* **`POST /quotations`** (Admin)
  - Creates itemized quote linked to `serviceRequestId` with line items, discount, tax, total (`QUO-XXXXX`).
  - **Automatically sets status to `SENT` and immediately dispatches an email notification to the customer**.
* **`PATCH /quotations/:id`** (Admin)
  - Revises quotation. Automatically captures versioned snapshot in `QuotationRevision`.
* **`GET /quotations/me`** (Customer) & **`GET /quotations`** (Admin)
  - List quotations.
* **`PATCH /quotations/:id/status`** (**Customer Only** - `@Roles('CUSTOMER')`)
  - **Single Unified Decision API**: Customer submits their decision in the body via enum (`ACCEPTED` or `REJECTED`).
  - **Payload for Acceptance**:
    ```json
    {
      "action": "ACCEPTED"
    }
    ```
    *Result*: Quotation transitions to `ACCEPTED`, **automatically provisions a scheduled `ServiceOrder` (`SO-XXXXX`)**, and marks parent `ServiceRequest` as `ACCEPTED`.
  - **Payload for Rejection**:
    ```json
    {
      "action": "REJECTED",
      "reason": "Price exceeds budget",
      "comments": "Looking for basic diagnostic only"
    }
    ```
    *Result*: Transitions quotation to `REJECTED` and records rejection history in audit table.
* **`POST /quotations/:id/accept`** & **`POST /quotations/:id/reject`** (Customer Only)
  - Retained as direct aliases to `PATCH /status`.

---

## 7. Service Orders Execution & Live ETA

* **`GET /service-orders`** (Admin) & **`GET /service-orders/me`** (Customer)
  - List service orders with KPI summary.
* **`GET /service-orders/:id`** (Customer / Technician / Admin)
  - Detailed view with assigned technician, appointment, report, invoices, and timeline history.
* **`POST /service-orders/:id/eta`** (Technician / Admin)
  - Update live arrival ETA and travel status (`EN_ROUTE`, `ON_SITE`).
* **`PATCH /service-orders/:id/status`** (Technician / Admin)
  - Update status (`SCHEDULED` $\rightarrow$ `TECHNICIAN_ASSIGNED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED`).
  - **When marked `COMPLETED`, the system automatically provisions an official Invoice (`status: "ISSUED"`)**.

---

## 8. Billing, Invoices & Online Stripe Payments

* **`GET /billing/invoices`** (Admin) & **`GET /billing/invoices/me`** (Customer)
  - List invoices with status badges (`ISSUED`, `PAID`, `PARTIALLY_PAID`, `OVERDUE`, `VOID`).
* **`GET /billing/invoices/:id`** (Customer / Admin)
  - Line items, payment records, and refunds.
* **`POST /billing/invoices/:id/payments`** (Admin / System)
  - Records payment (Stripe, Credit Card, Cash, Check). Automatically transitions invoice to `PAID` when fully paid.
* **`POST /billing/invoices/:id/refunds`** (Admin)
  - Processes refund against a specific payment record.

---

## 9. Team & Technicians Management

* **`GET /technicians`** (Admin)
  - List technicians with status filters (`ACTIVE`, `INACTIVE`, `ON_LEAVE`), completed job counts, and ratings.
* **`GET /technicians/:id`** (Admin)
  - Detailed technician profile with assigned requests, upcoming appointments, and ratings.
* **`POST /technicians`** (Admin)
  - Creates technician user account (role `TECHNICIAN`) and technician record.
* **`PATCH /technicians/:id`** (Admin)
  - Updates profile, availability, specializations, rating, and status.
* **`DELETE /technicians/:id`** (Admin)
  - Deletes technician profile and login user.

---

## 10. Service Customer Reviews & Moderation

* **`POST /reviews`** (**Customer Only** - `@Roles('CUSTOMER')`)
  - Submits 1–5 star review for completed service and technician.
* **`GET /reviews`** (Public)
  - Returns published customer reviews for public landing pages.
* **`GET /reviews/admin/all`** (Admin)
  - Moderation queue.
* **`PATCH /reviews/:id/moderate`** (Admin)
  - Moderates review (`action: "PUBLISHED" | "HIDDEN" | "DELETED"`).

---

## 11. Executive Analytics & Service Funnel

* **`GET /reports/overview`** (Admin)
  - Platform KPIs: `totalRevenue`, `serviceRevenue`, `productRevenue`, `totalOrders`, `serviceOrdersCount`, `pendingRequestsCount`.
  - 14-day timeseries revenue chart points.
  - Complete `serviceFunnel` conversion stats (`requested` $\rightarrow$ `accepted` $\rightarrow$ `quoted` $\rightarrow$ `quoteAccepted` $\rightarrow$ `serviceOrder` $\rightarrow$ `completed`).
* **`GET /reports/service-operations`** (Admin)
  - Volume breakdown and top requested services.
* **`GET /reports/technicians`** (Admin)
  - Technician leaderboard by completed jobs and rating.

---

## 12. System Configuration & Legal Policies

* **`GET /settings/business-profile`** (Public / Admin) & **`PATCH /settings/business-profile`** (Admin)
  - Business name, email, phones, address, coverage notes, 7-day operating hours (`businessHours`), and social links.
* **`GET /settings/faqs`** (Public), **`POST /settings/faqs`**, **`PATCH /settings/faqs/:id`**, **`DELETE /settings/faqs/:id`** (Admin)
  - Categorized FAQ management.
* **`GET /settings/policies`** (Public), **`GET /settings/policies/:slug`** (Public), **`POST /settings/policies`**, **`PATCH /settings/policies/:id`** (Admin)
  - Legal policies (Terms of Service, Privacy Policy, Warranty).

---

## 13. AI Troubleshooting Assistant

* **`POST /ai/chat`** (Public)
  - Context-aware vacuum troubleshooting conversation powered by Google Gemini AI.
* **`POST /ai/chat/stream`** (Public)
  - Server-Sent Events (SSE) streaming chat response.
* **`POST /ai/service-intake`** (Public)
  - Structured symptom recommendations and urgency evaluation from customer natural language description.
