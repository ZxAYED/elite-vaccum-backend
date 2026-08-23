# Elite Central Vacuum - Complete Platform API & Integration Guide

This guide documents the enterprise APIs powering the **Elite Central Vacuum** platform across **Commerce**, **Service Operations**, **Billing & Invoices**, **Team Dispatch**, **Customer Reviews**, **Insights & Reports**, and **System Settings**.

---

## Table of Contents
1. [Authentication & Role Access Matrix](#1-authentication--role-access-matrix)
2. [System Settings & Configuration](#2-system-settings--configuration)
3. [Technicians Management](#3-technicians-management)
4. [Service Intake, Quotations & Service Orders](#4-service-intake-quotations--service-orders)
5. [Billing, Invoices & Payments](#5-billing-invoices--payments)
6. [Customer Reviews & Moderation](#6-customer-reviews--moderation)
7. [Insights, Analytics & Reports Engine](#7-insights-analytics--reports-engine)

---

## 1. Authentication & Role Access Matrix

| Role | Access Level | Responsibilities |
| :--- | :--- | :--- |
| `PUBLIC` | No token required | View Catalog, Services, FAQs, Legal Policies, Published Reviews, Business Profile. |
| `CUSTOMER` | `@Roles('CUSTOMER')` | Cart, Store Checkout, Submit Service Requests, View/Accept Quotations, View Service Orders, View Invoices, **Submit Reviews**. |
| `TECHNICIAN` | `@Roles('TECHNICIAN')` | View assigned jobs, update live ETA, submit service reports. |
| `ADMIN` | `@Roles('ADMIN')` | Full CRUD, Triage Requests, Dispatch Schedule, Issue Quotations/Invoices, Technician Management, Review Moderation, Business Settings, Analytics. |

---

## 2. System Settings & Configuration

### A. Business Profile & Contact Information
* **`GET /settings/business-profile`** (Public)
  - Returns business name, support email, phone numbers, address, coverage message, coverage notes, operating hours (Monday–Sunday), and social links.
* **`PATCH /settings/business-profile`** (Admin)
  - Update business info and operating hours.

```json
{
  "businessName": "Elite Central Vacuum",
  "supportEmail": "support@elitecentralvac.com",
  "primaryPhone": "01902320296",
  "secondaryPhone": "+1-555-019-9922",
  "address": "123 Elite Plaza, Wellness Drive",
  "city": "Greenwich",
  "state": "CT",
  "zipCode": "06830",
  "country": "United States",
  "coverageMessage": "Service coverage available by request.",
  "coverageNotes": "Coverage is reviewed against technician availability, property location, and service type before scheduling is confirmed.",
  "operatingHours": {
    "monday": "8:00 AM - 8:00 PM",
    "tuesday": "8:00 AM - 8:00 PM",
    "wednesday": "8:00 AM - 6:00 PM",
    "thursday": "8:00 AM - 6:00 PM",
    "friday": "8:00 AM - 6:00 PM",
    "saturday": "9:00 AM - 3:00 PM",
    "sunday": "Closed"
  },
  "socialLinks": {
    "facebook": "https://facebook.com",
    "instagram": "https://instagram.com",
    "linkedin": "https://linkedin.com"
  }
}
```

### B. FAQs Management
* **`GET /settings/faqs`** (Public)
  - Query Params: `category` (optional), `status` (optional).
  - Returns FAQ list + `publishedCount` and `hiddenCount`.
* **`POST /settings/faqs`** (Admin)
  - Add customer-facing FAQ (`question`, `answer`, `category: General | Maintenance | Installation | Repair`, `status: Published | Draft`, `sortOrder`).
* **`PATCH /settings/faqs/:id`** (Admin)
  - Edit existing FAQ.
* **`DELETE /settings/faqs/:id`** (Admin)
  - Delete FAQ.

### C. Legal & Policies Management
* **`GET /settings/policies`** (Public)
  - List all policies (Terms of Service, Privacy Policy, etc.).
* **`GET /settings/policies/:slug`** (Public)
  - Retrieve public policy content by slug (e.g. `terms`, `privacy`, `returns`, `warranty`).
* **`POST /settings/policies`** (Admin)
  - Create policy (`slug`, `title`, `content`, `status`).
* **`PATCH /settings/policies/:id`** (Admin)
  - Update policy content & status.
* **`DELETE /settings/policies/:id`** (Admin)
  - Remove policy.

---

## 3. Technicians Management

* **`GET /technicians`** (Admin)
  - Query Params: `page`, `limit`, `status` (`ACTIVE`, `INACTIVE`, `ON_LEAVE`, `SUSPENDED`), `search`, `specialization`.
  - Returns paginated list with real-time KPI stats (`active`, `onLeave`, `total`).
* **`GET /technicians/:id`** (Admin)
  - Full details including assigned requests, assigned service jobs, appointments, completed jobs count, and average ratings.
* **`POST /technicians`** (Admin)
  - Creates both `User` (role `TECHNICIAN`) and linked `Technician` record.
  ```json
  {
    "displayName": "Marcus Vance",
    "email": "marcus.vance@elitecentralvac.com",
    "phone": "+1-555-4321",
    "password": "Password123!",
    "specializations": ["VACUUM_REPAIR", "LOW_SUCTION_FIX", "INSTALLATION"],
    "adminNotes": "Senior technician with 10+ years commercial experience."
  }
  ```
* **`PATCH /technicians/:id`** (Admin)
  - Update details, rating, completed jobs, specializations, and availability.
* **`DELETE /technicians/:id`** (Admin)
  - Remove technician account.

---

## 4. Service Intake, Quotations & Service Orders

### A. Customer Intake & Triage
* **`POST /service-requests`** (Customer / Guest)
  - Generates `REQ-YYYYMMDD-XXXXX`.
* **`GET /service-requests`** (Admin)
  - Triage list with real-time badges (`submitted`, `underReview`, `accepted`, `rejected`, `scheduled`, `total`).
* **`PATCH /service-requests/:id/status`** (Admin)
  - Status transitions (`UNDER_REVIEW`, `ACCEPTED`, `QUOTED`, `SCHEDULED`, `REJECTED`).

### B. Quotations Lifecycle
* **`POST /quotations`** (Admin)
  - Generates monotonic `QUO-YYYYMMDD-XXXXX`.
  ```json
  {
    "serviceRequestId": "uuid-here",
    "lineItems": [
      {
        "description": "Central Vacuum Motor Diagnostics & Cleaning",
        "quantity": 1,
        "unitPriceUsd": 150.00
      },
      {
        "description": "OEM 120V Carbon Brushes Replacement Kit",
        "quantity": 1,
        "unitPriceUsd": 85.00
      }
    ],
    "discountUsd": 15.00,
    "taxUsd": 17.60,
    "notes": "Includes 90-day labor warranty",
    "expiresAt": "2026-09-30"
  }
  ```
* **`PATCH /quotations/:id`** (Admin)
  - Revise quotation and automatically backup previous version into `QuotationRevision`.
* **`POST /quotations/:id/send`** (Admin)
  - Sends quotation to customer (`SENT`).
* **`POST /quotations/:id/accept`** (Customer / Admin)
  - **Accepts quotation and automatically provisions `ServiceOrder` (`SO-YYYYMMDD-XXXXX`) linked to this quotation!**
* **`POST /quotations/:id/reject`** (Customer / Admin)
  - Records rejection reason in `QuotationRejection`.

### C. Service Orders Execution & Dispatch
* **`GET /service-orders`** (Admin)
  - List service orders with filters and KPI counts (`scheduled`, `technicianAssigned`, `inProgress`, `completed`, `cancelled`, `total`).
* **`GET /service-orders/me`** (Customer)
  - Customer's active and completed service orders.
* **`GET /service-orders/:id`** (Customer / Admin)
  - Full details including customer, technician, service request, appointments, quotation, report, invoices, and timeline history.
* **`POST /service-orders/:id/assign`** (Admin)
  - Assign technician to service order (`TECHNICIAN_ASSIGNED`).
* **`POST /service-orders/:id/eta`** (Admin / Technician)
  - Live arrival ETA update in minutes (`{ "minutes": 30 }`).
* **`PATCH /service-orders/:id/status`** (Admin / Technician)
  - Transitions status (`SCHEDULED`, `ON_THE_WAY`, `ARRIVED`, `IN_PROGRESS`, `REPORT_SUBMITTED`, `COMPLETED`, `CANCELLED`).
  - **When status changes to `COMPLETED`, an Invoice is automatically generated if not yet issued!**

---

## 5. Billing, Invoices & Payments

* **`GET /billing/invoices`** (Admin)
  - List all invoices (Product & Service orders) with live KPI badges (`issued`, `paid`, `partiallyPaid`, `overdue`, `void`, `total`).
* **`GET /billing/invoices/me`** (Customer)
  - Customer's invoices.
* **`GET /billing/invoices/:id`** (Customer / Admin)
  - Itemized breakdown, line items, payment history, and refunds.
* **`GET /billing/invoices/:id/html`** (Customer / Admin)
  - Printable, production-styled HTML invoice stream.
* **`POST /billing/invoices`** (Admin)
  - Create custom or service invoice (`INV-YYYYMMDD-XXXXX`).
* **`POST /billing/invoices/:id/payments`** (Admin)
  - Record payment (`amountUsd`, `methodLabel: Stripe | Credit Card | Cash | Check`, `transactionReference`).
  - Auto-updates invoice status to `PAID` or `PARTIALLY_PAID`.
* **`POST /billing/invoices/:id/refunds`** (Admin)
  - Process refund against an existing payment.

---

## 6. Customer Reviews & Moderation

* **`POST /reviews`** (**Customer Only** - `@Roles('CUSTOMER')`)
  - Authenticated customers can submit a review for a purchased product OR a completed service:
  ```json
  {
    "type": "SERVICE",
    "serviceOrderId": "uuid-here",
    "rating": 5,
    "title": "Fast and quiet repair!",
    "body": "The technician fixed the motor noise in under an hour. Great service!"
  }
  ```
* **`GET /reviews`** (Public)
  - Lists published reviews (`ReviewStatus.PUBLISHED`) filtered by `type`, `productId`, `serviceId`, or `rating`.
  - Returns `items` along with `meta.analytics`: `averageRating` and `totalReviews`.
* **`GET /reviews/me`** (Customer)
  - List logged-in customer's submitted reviews.
* **`GET /reviews/admin/all`** (Admin)
  - All reviews with moderation statuses (`PENDING`, `PUBLISHED`, `HIDDEN`).
* **`PATCH /reviews/:id/moderate`** (Admin)
  - Moderate review (`action: "PUBLISHED" | "HIDDEN" | "DELETED"`, `reason`, `note`).
* **`DELETE /reviews/:id`** (Admin)
  - Delete review.

---

## 7. Insights, Analytics & Reports Engine

### `GET /reports/overview` (Admin)
Provides exact executive dashboard metrics matching the admin UI design:
- **Metrics**:
  - `totalRevenue`: Sum of all completed payments ($ USD)
  - `productRevenue`: Revenue from e-commerce store products
  - `serviceRevenue`: Revenue from field service jobs
  - `totalOrders`: Product orders + Service orders count
  - `refundAmount`: Total refunded amount ($ USD)
  - `productOrdersCount`
  - `serviceOrdersCount`
  - `completedServicesCount`
  - `pendingRequestsCount`
  - `outstandingInvoicesCount`
- **`revenueOverTime`**: Timeseries data grouped by date (`date`, `productRevenue`, `serviceRevenue`, `totalRevenue`).
- **`serviceFunnel`**: Conversion pipeline counts:
  - `requested` $\rightarrow$ `accepted` $\rightarrow$ `quoted` $\rightarrow$ `quoteAccepted` $\rightarrow$ `serviceOrder` $\rightarrow$ `completed`.

### Additional Report Tabs:
- **`GET /reports/sales`**: Product sales volume, Average Order Value (AOV), top 5 bestselling products by revenue.
- **`GET /reports/service-operations`**: Total requests volume, top requested services breakdown.
- **`GET /reports/technicians`**: Technician leaderboard (rating, completed jobs, active job count).
- **`GET /reports/customers`**: Total customers, active customer count, repeat order percentage.
