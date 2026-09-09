<div align="center">

# 🌪️ Elite Central Vacuum &bull; Enterprise Backend API

<p align="center">
  <strong>Mission-critical, high-performance distributed backend powering Commercial & Residential Vacuum Services, E-Commerce, Real-Time Fleet Scheduling, AI Diagnostics, and Automated Billing.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma ORM" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/BullMQ-FF4500?style=for-the-badge&logo=queue&logoColor=white" alt="BullMQ" />
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge&logo=stripe&logoColor=white" alt="Stripe" />
  <img src="https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white" alt="Cloudinary" />
  <img src="https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=google&logoColor=white" alt="Google Gemini AI" />
</p>

<p align="center">
  <a href="https://elite-vaccum-frontend.vercel.app"><img src="https://img.shields.io/badge/🌐_Live_Demo-elite--vaccum--frontend.vercel.app-00C853?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" /></a>
</p>

<p align="center">
  <a href="#-production-engineering-highlights--architecture-innovations">Engineering Highlights</a> &bull;
  <a href="#-comprehensive-feature-architecture--key-capabilities">Core Features</a> &bull;
  <a href="#-system-architecture">Architecture</a> &bull;
  <a href="#-frontend-api-integration-guide">API Guide (17 Phases)</a> &bull;
  <a href="#-role-based-workflow-architecture-admin-vs-customer-vs-technician">Role Workflows</a> &bull;
  <a href="#-real-time-notifications--websocket">WebSockets</a> &bull;
  <a href="#-redis--concurrency-architecture">Redis Concurrency</a> &bull;
  <a href="#-quick-start">Quick Start</a>
</p>

---

</div>

## ⚡ Production Engineering Highlights & Architecture Innovations

> **Engineered for High-Scale Enterprise Reliability, Zero-Race-Condition Concurrency, Real-Time Distributed Mesh, and Strict Security.**

### 🏆 1. Distributed Concurrency & Zero-Race-Condition Guarantees
- **Redlock Distributed Locking (`RedisService.acquireLock`)**: Serializes critical operations to prevent double-booking concurrent slot requests (`lock:schedule:${techId}:${date}:${startTime}`), payment double-settlements (`payment:invoice:${id}`), and atomic quotation sign-offs (`quotation:action:${id}`).
- **Stock Double-Restoration Prevention**: Strict pre-condition validation in both `cancelOrder` and `processReturnRefund` preventing double-increment of inventory stock when managing refunded or cancelled orders.
- **ACID Transaction Isolation**: All multi-table side-effects (e.g. quotation acceptance auto-provisioning `ServiceOrder` + `Appointment` + `StatusHistory`) execute within unified Prisma `$transaction` blocks.

### 🛡️ 2. Multi-Tier Anti-Brute-Force & Rate Limiting Security
- **Granular Endpoint Throttling**: `@nestjs/throttler` protects sensitive entrypoints against automated brute-force attacks:
  - `POST /auth/verify-otp`, `POST /auth/resend-otp`: **5 req/min**
  - `POST /auth/login`: **10 req/min**
  - `POST /auth/forgot-password`, `POST /auth/reset-password`: **5 req/min**
  - Global API Limiting: Layered **15 req/sec**, **60 req/10s**, and **200 req/min**.
- **Secure HttpOnly Cookie Token Rotation**: Refresh tokens are isolated from client-side JavaScript in encrypted `HttpOnly`, `SameSite: Lax/None`, `Secure` cookies with automatic session revocation.
- **Data Integrity & Address Ownership Guards**: Prevents customer address tampering during checkout by enforcing strict customer ID ownership verification before order creation.

### 📡 3. Real-Time Distributed WebSocket Mesh & Redis Pub/Sub
- **Dual WebSocket Gateways**: Real-time channels for **In-App Notifications** (`/notifications`) and **Live Support Chat** (`/chat`) built with Socket.io.
- **Horizontal Multi-Node Clustering**: Sockets synchronize across multiple backend container nodes via Redis Pub/Sub channels (`notifications:events`, `chat:messages`, `chat:typing`) with `<10ms` broadcast latency.
- **Zero-Memory-Leak Presence Tracker (`RedisPresenceService`)**: Maintains active socket device sets in Redis (`presence:devices:<userId>`), allowing instant online/offline checks without server memory buildup.

### 📬 4. Resilient Asynchronous Processing with BullMQ
- **Background Worker Queues**: Dedicated BullMQ queues (`notifications-delivery`, `chat-messages`) with worker concurrency, exponential backoff retries, and rate limiting (25 jobs/sec).
- **Intelligent Offline Chat Debouncing**: Delayed 2-minute BullMQ job checks whether the recipient read a message; if offline, dispatches formatted HTML email alerts via SMTP.
- **Centralized Connection Pool**: High-performance connection factory (`createBullMQRedisConnection`) handling Upstash TLS, `maxRetriesPerRequest: null`, and automatic error recovery.

### 👥 5. Single Unified Authentication & 3-Role Domain Routing
- **One Unified Auth System**: Single entrypoint (`POST /auth/login`) handles `CUSTOMER`, `ADMIN`, and `TECHNICIAN` roles without duplicate authentication silos or session conflicts.
- **Role-Based Guards**: Method-level `@Roles('ADMIN')`, `@Roles('TECHNICIAN')`, and `@Roles('CUSTOMER')` decorators ensure granular endpoint authorization.

### 📂 6. Modular Multi-File Prisma Schema Architecture
- **Domain-Driven Schemas**: 14 cleanly partitioned Prisma schema files (`schema.prisma`, `auth.prisma`, `customer.prisma`, `store.prisma`, `services.prisma`, `technician.prisma`, `chat.prisma`, `reviews.prisma`, etc.) merged automatically during build, ensuring clean separation of concerns in PostgreSQL.

### 🚀 7. Direct Buffer Media Streaming & CSV Export Pipeline
- **Zero-Disk Media Processing**: Multipart image/video attachments stream directly from memory buffers to Cloudinary CDN without temporary file disk I/O bottlenecks.
- **Streaming CSV Export**: High-performance streaming CSV downloads for Orders, Service Requests, Customers, and Invoices with instant HTTP response headers.

### 🤖 8. Generative AI Diagnostic Engine (Google Gemini Flash)
- **Real-Time Streaming SSE**: Streaming chat completion over Server-Sent Events (`POST /ai/chat/stream`).
- **Structured Symptom Extraction**: Natural language intake analysis extracting symptoms (`LOW_SUCTION`, `CLOG`, `ODOR`) and urgency scores using structured output schemas.
- **Live Database Tool Integration**: Tool calling integrated with real-time Prisma DB queries (services, products, orders) with automatic fallback.

---

## 🌟 Executive Overview

**Elite Central Vacuum Backend** is an enterprise-grade REST and WebSocket application architected with **NestJS**, **PostgreSQL**, **Prisma ORM**, **Upstash Redis**, and **BullMQ**. It bridges customer e-commerce with real-time field operations, automated invoicing, multi-node live notifications, and generative AI diagnostics.

```
                               ┌────────────────────────────────────────┐
                               │         CLIENT APPLICATIONS            │
                               │  (Next.js Web, Customer App, PWA)      │
                               └──────────────────┬─────────────────────┘
                                                  │ HTTPS / WSS
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │       API GATEWAY & GUARDS             │
                               │  • Throttler (DDoS Rate-Limiter)       │
                               │  • JWT AuthGuard & Cookie Sessions     │
                               │  • RolesGuard (ADMIN, TECH, CUSTOMER)  │
                               └──────────────────┬─────────────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 ▼                                ▼                                ▼
   ┌───────────────────────────┐    ┌───────────────────────────┐    ┌───────────────────────────┐
   │     E-Commerce & Store    │    │   Services & Dispatch     │    │    Billing & Invoices     │
   │  • Catalog & Inventory    │    │  • Intake & Symptoms      │    │  • Multi-Item Invoices    │
   │  • Persistent Cart Cache  │    │  • Slot Booking Engine    │    │  • Stripe PaymentIntents  │
   │  • Distributed Locks      │    │  • Service Orders & ETAs  │    │  • Offline Settlements    │
   └─────────────┬─────────────┘    └─────────────┬─────────────┘    └─────────────┬─────────────┘
                 │                                │                                │
                 └────────────────────────────────┼────────────────────────────────┘
                                                  │
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │      DISTRIBUTED EVENT BUS & QUEUES    │
                               │  • BullMQ Queue ('notifications')      │
                               │  • Redis Pub/Sub Multi-Node Broker     │
                               │  • Redis Cluster Presence Tracker      │
                               └──────────────────┬─────────────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 ▼                                ▼                                ▼
   ┌───────────────────────────┐    ┌───────────────────────────┐    ┌───────────────────────────┐
   │   PostgreSQL Database     │    │   WebSocket Gateways      │    │    External Providers     │
   │  • 12 Domain Schemas      │    │  • Real-Time Dispatch     │    │  • Stripe API & Webhooks  │
   │  • ACID Transactions      │    │  • Technician Live ETAs   │    │  • Cloudinary Storage     │
   │  • Relational Indexes     │    │  • Customer Live Alerts   │    │  • Google Gemini 1.5 Flash│
   └───────────────────────────┘    └───────────────────────────┘    └───────────────────────────┘
```

---

## 🚀 Comprehensive Feature Architecture & Key Capabilities

### 🛠️ 1. Service Intake, Diagnostic Engine & Slot Booking (`src/services`)
- **Fixed Service Catalog**: 10 curated central vacuum residential & commercial services with transparent base pricing, estimated durations, and service scopes.
- **Diagnostic Symptom Mapping**: 8 built-in diagnostic symptoms (`LOW_SUCTION`, `CLOG`, `ODOR`, `ELECTRICAL`, `MOTOR_BURNT`, `PIPE_LEAK`, `INLET_LOOSE`, `NOISE`) linking customer symptoms directly to repair protocols.
- **Dynamic Slot Availability Engine**: Real-time slot calculation across 5 standard dispatch windows (`8am-10am`, `10am-12pm`, `12pm-2pm`, `2pm-4pm`, `4pm-6pm`) via `GET /schedule/slots`.
- **Conflict Prevention & Distributed Locking**: Enforces working hours, technician capacity, holiday blackouts, and Redlock distributed locking on slot booking to eliminate double-booking.
- **Service Request Lifecycle**: Tracks customer intake from `SUBMITTED` &rarr; `UNDER_REVIEW` &rarr; `QUOTED` &rarr; `SCHEDULED` &rarr; `IN_PROGRESS` &rarr; `COMPLETED` &rarr; `CANCELLED`.

### 📋 2. Quotations & Interactive Estimation Workflow (`src/quotations`)
- **Itemized Estimation Engine**: Line-item breakdown covering labor hours, replacement parts (power units, motors, inlet valves), and travel fees with subtotal, tax, and discount computations.
- **Immutable Revision History**: Every quotation amendment creates an auditable revision snapshot (`rejectionHistory`), preserving original line items and price negotiations.
- **Interactive Customer Approval**: Customers review and act directly via `POST /quotations/:id/accept` or `POST /quotations/:id/reject` (with rejection reason capture).
- **Atomic Auto-Provisioning**: Customer acceptance triggers a single ACID transaction that automatically creates a `ServiceOrder`, reserves the `Appointment`, generates status history, and issues an `Invoice`.
- **Online Quotation Prepayment**: Stripe Checkout session generation (`createQuotationStripeCheckoutSession`) allowing customers to pay quotation deposits or full amounts online.

### 🚐 3. Field Technician Fleet & Real-Time Dispatch Operations (`src/technicians`, `src/service-orders`)
- **Technician Profiles & Skill Mapping**: Tracks technician certification tiers, specialized skills (e.g. pipe tracing, motor rebuilds), service radius, and active dispatch status.
- **Centralized Admin Dispatch Board**: Visual dispatch board for assigning or reassigning technicians to service orders with workload balancing.
- **Mobile Field Execution Workflow**: Step-by-step field status progression (`ASSIGNED` &rarr; `DISPATCHED` &rarr; `ON_THE_WAY` &rarr; `ARRIVED` &rarr; `IN_PROGRESS` &rarr; `COMPLETED`).
- **Live Arrival ETA Broadcasts**: Technicians submit live minutes-to-arrival updates (`POST /service-orders/:id/eta`), triggering instant WebSocket broadcast alerts to the customer.
- **Completion Reports & Diagnostic Notes**: Technicians record diagnostic findings, parts consumed, warranty tags, and customer sign-off on job completion.
- **Automated Appointment Sync**: Status transitions automatically synchronize linked appointment records across the platform.

### 🛒 4. Enterprise E-Commerce Store & Cart (`src/store`)
- **Product Catalog Management**: Faceted filtering by category, brand, power unit wattage, filtration type, and pricing with instant full-text search across SKU and model numbers.
- **Media Optimization**: Direct Cloudinary integration supporting multiple product gallery images with designated primary thumbnails.
- **High-Performance Redis Cart**: Authenticated shopping cart cached in Upstash Redis with instant PostgreSQL synchronization and item pricing verification.
- **Stripe Checkout & Cash on Delivery (COD)**: Supports dual checkout rails: hosted Stripe Checkout sessions with line-item detail and Cash on Delivery with immediate inventory reservation.
- **Stock Decrement & Distributed Locks**: Concurrency-protected inventory deduction using Redlock; automated stock restoration upon expired sessions or payment failures.
- **Order Tracking Timeline**: Full fulfillment tracking with shipping carrier (`shippingProvider`), tracking number, and status milestones (`PENDING` &rarr; `PAID` &rarr; `PROCESSING` &rarr; `SHIPPED` &rarr; `DELIVERED`).

### 📦 5. Returns & Automated Refund Management (`src/store/returns`)
- **Customer Return Requests (RMA)**: Customers initiate return requests specifying items, quantities, condition, and return reason.
- **Return Status Pipeline**: Managed progression through `REQUESTED` &rarr; `APPROVED` &rarr; `RECEIVED` &rarr; `INSPECTED` &rarr; `REFUNDED` / `REJECTED`.
- **Automated Stripe Refund Processing**: Approved returns trigger automated partial or full refunds against the originating Stripe PaymentIntent (`re_...`) via `refundStripePayment`.
- **Zero-Double-Restock Protection**: Strict pre-condition validation prevents double-increment of product inventory when managing cancellations and returns.

### 🧾 6. Universal Invoicing, Multi-Tender Payments & Billing (`src/billing`, `src/store/invoice`)
- **Unified Multi-Source Invoice Model**: Single normalized invoice architecture supporting Store Orders (`ProductOrder`), Field Services (`ServiceOrder`), Quotations (`Quotation`), and custom Admin Billing.
- **Guaranteed Order Invoice Integration**: Order details (`GET /store/orders/:id`) returns the full invoice structure (both `invoices[]` and primary `invoice`) complete with line items, payments, refunds, and direct PDF view/download links.
- **Dual PDF Generation & Direct Streaming**:
  - Binary PDF file generation and streaming download (`GET /store/invoices/orders/:orderId/download`).
  - Dynamic, printable HTML invoice endpoint (`GET /billing/invoices/:id/html`).
- **Online Stripe Invoice Payments**: Customers can settle outstanding service invoices directly using Stripe PaymentIntents (`POST /billing/invoices/:id/stripe/payment-intent` & `POST /billing/invoices/:id/stripe/confirm`).
- **Multi-Tender Payment & Refund Ledger**: Records Stripe, Cash, Check, and Credit Card payments with full refund audit trails.

### 👤 7. Customer CRM & Central Vacuum Equipment Vault (`src/customers`)
- **Comprehensive Customer Profiles**: Residential & commercial account classification, primary phone, email, and billing records.
- **Multi-Address Management**: Saved customer addresses with default shipping/billing designations and tamper-proof ownership verification during checkout.
- **Central Vacuum Equipment Registry**: Tracks installed equipment per customer (power unit model, serial number, pipe inlet count, installation year, filtration type).
- **Service & Purchase History**: Unified view of past repair tickets, service orders, quotations, and store purchases linked to the customer account.
- **Internal CRM Notes**: Private staff notes for dispatchers and customer support representatives.

### ⭐ 8. Customer Reviews & Reputation Moderation System (`src/reviews`)
- **Dual-Domain Feedback**: Supports verified customer reviews for Store Products and Technician On-Site Services.
- **Verified Purchase / Service Guard**: Validates that the customer has genuinely purchased the product or completed the service before permitting review submission.
- **Rating Distribution & Analytics**: Automatic calculation of average ratings, 1-to-5 star breakdowns, and review counts.
- **Admin Moderation Queue**: Workflow for screening customer reviews (`PENDING` &rarr; `PUBLISHED` / `REJECTED`) with moderation reason logging.

### 🤖 9. Google Gemini AI Diagnostics & Streaming Assistant (`src/ai`)
- **Real-Time Streaming SSE Chat**: Server-Sent Events streaming chat endpoint (`POST /ai/chat/stream`) powered by Google Gemini 1.5 Flash.
- **Structured Symptom Extraction**: Natural language intake analysis extracting symptoms (`LOW_SUCTION`, `CLOG`, `ODOR`, etc.), urgency scores, and recommended actions using structured output schemas.
- **Live Database Tool Calling**: Gemini integrates directly with real-time Prisma DB queries to check active service catalog items, product inventory, and customer equipment history.
- **Intelligent CTAs**: Dynamically provides actionable deep links to book matching service appointments or purchase replacement filters/accessories.

### 💬 10. Enterprise Real-Time Live Support Chat (`src/chat`)
- **Dual Communication Channels**: High-performance Socket.io WebSocket (`/chat` namespace) + REST fallback with Cloudinary photo/file uploads.
- **Cluster Synchronization via Redis Pub/Sub**: Multi-server instant message broadcast, typing indicators, and read receipts with `<10ms` latency.
- **BullMQ Offline Resilience**: Automatic 2-minute delayed offline check to dispatch email alerts when users or admins are away from their screens.
- **Zero-Memory-Leak Presence Tracker**: Tracks connected devices in Redis sets without in-memory leak vulnerabilities.

### 🔔 11. Real-Time Notifications & BullMQ Background Queues (`src/notifications`)
- **Multi-Channel Delivery**: In-app unread badge counter, persistent PostgreSQL notification log, and formatted HTML SMTP email alerts.
- **Dedicated BullMQ Queue (`notifications-delivery`)**: Asynchronous worker processing with concurrency, rate limiting (25 jobs/sec), and exponential backoff retry policies.
- **Cross-Node WebSocket Mesh**: Subscribed across cluster nodes via Redis Pub/Sub channels (`notifications:events`) to broadcast to rooms (`user:<id>`, `role:<ROLE>`, `broadcast`).
- **Comprehensive Event Matrix**: Instant alerts across order updates, dispatch events, quotation approvals, invoices, and technician ETAs.

### 📊 12. Executive Analytics, KPI Dashboards & Streaming CSV Pipeline (`src/reports`, `src/analytics`)
- **Executive KPI Dashboard**: Real-time business metrics including revenue trends, order volumes, repair ticket averages, technician utilization, and customer retention.
- **High-Throughput Streaming CSV Exports**: Zero-disk streaming CSV downloads for Orders, Service Requests, Invoices, and Customers with immediate HTTP response headers.

### ⚙️ 13. Platform Settings & Operational Control (`src/settings`)
- **Dynamic Business Operations**: Configurable working hours, dispatch slots, emergency surcharge rates, and holiday blackout calendars.
- **System Maintenance Controls**: Global operational flags and maintenance mode toggles.

### 🛡️ 14. Enterprise Security, Multi-Tier Rate Limiting & Concurrency (`src/auth`, `src/common`)
- **Single Unified Authentication**: One login entrypoint (`POST /auth/login`) securely handling `CUSTOMER`, `ADMIN`, and `TECHNICIAN` roles without duplicate silos.
- **Layered Throttling Security**: Granular endpoint rate limiting protecting against brute force on OTP verification, login, and password reset alongside global API rate limits.
- **HttpOnly Cookie Token Rotation**: Refresh tokens isolated from client JavaScript with automatic session revocation.
- **Redlock Distributed Locking**: Concurrency serialization across payments, slot reservations, and cart updates.

---

---

## 👥 Multi-Role Domain Architecture (Customer &bull; Admin &bull; Field Technician)

The platform enforces a unified identity model with three distinct operational roles:

```
┌───────────────────────────────┐
│     CUSTOMER EXPERIENCE       │ ──► E-Commerce Shopping Cart & Stripe Checkout
│  (Residential & Commercial)   │ ──► Self-Service Central Vac Intake & Scheduling
│                               │ ──► Interactive Quotation Approval & Live Dispatch Tracking
└───────────────────────────────┘
               │
               ▼
┌───────────────────────────────┐
│       ADMIN OPERATIONS        │ ──► Centralized Dispatch Board & Technician Scheduling
│      (Dispatch & Back-Office) │ ──► Automated Invoicing, Partial Refunds & Payment Ledgers
│                               │ ──► Product Catalog, Media Management & Inventory Control
└───────────────────────────────┘
               │
               ▼
┌───────────────────────────────┐
│    FIELD TECHNICIAN SUITE     │ ──► Real-Time Mobile Job Feed & Status Transitions
│      (On-Site Field App)      │ ──► Live ETA Broadcasts & Turn-by-Turn GPS Dispatch
│                               │ ──► Diagnostic Completion Reports & Availability Toggle
└───────────────────────────────┘
```

> **Note**: For the full endpoint reference and step-by-step frontend integration instructions for each role, see the dedicated [Frontend API Integration Guide](file:///d:/Project/aryegrunzwieg-backend/docs/API_INTEGRATION_GUIDE.md).

---

## 📂 Project Structure

```
src/
├── ai/                     # Google Gemini AI Diagnostics, providers & live DB tools
├── analytics/              # Platform KPI aggregations and dashboard statistics
├── auth/                   # JWT, OTP verification, bcrypt hashing, session guards
├── billing/                # Multi-item invoices, payment transactions, Stripe integration
├── chat/                   # Live Real-Time Chat (Socket.io, Redis PubSub, BullMQ offline alerts)
├── common/                 # Decorators, filters, guards, interceptors, and DTOs
├── customers/              # Customer CRM profiles, addresses, equipment, and notes
├── email/                  # Nodemailer SMTP engine and HTML email templates
├── notifications/          # Notification Gateway, BullMQ Queue, and Worker
│   ├── dto/                # Validation DTOs and query models
│   ├── gateways/           # Socket.IO WebSocket Gateway with Redis Presence
│   ├── queues/             # BullMQ Queue Service & Background Worker
│   └── notifications.service.ts
├── prisma/                 # PrismaService singleton with connection lifecycle
├── quotations/             # Quotation drafting, revision history, and accept/reject flows
├── redis/                  # RedisModule, RedisService, PubSub, and Presence
├── reports/                # Executive KPI metrics and direct streaming CSV export endpoints
├── reviews/                # Customer reviews, ratings, and admin moderation
├── service-orders/         # Field execution, technician assignments, live ETAs
├── services/               # Service catalog, customer intake requests, scheduling slots
├── settings/               # System configuration, business hours, and operational flags
├── storage/                # Cloudinary storage adapter and unified IStorageProvider
├── store/                  # E-Commerce: products, categories, cart, and orders
├── technicians/            # Technician profiles, skill specializations, and dispatch boards
├── app.module.ts           # Root module with Throttler, Config, and feature imports
└── main.ts                 # Bootstrap with Helmet, CORS, CookieParser, Swagger, and Validation
```

---

## 🔔 Real-Time Notifications & WebSocket

### 📡 WebSocket Connection

```typescript
import { io } from 'socket.io-client';

const socket = io('https://api.elitecentralvac.com/notifications', {
  auth: {
    token: 'YOUR_JWT_ACCESS_TOKEN', // or 'Bearer YOUR_JWT_ACCESS_TOKEN'
  },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('Connected to Notifications Gateway');
});

// Listen for incoming notifications
socket.on('notification:new', (notification) => {
  console.log('New notification received:', notification);
});

// Listen for unread count badge updates
socket.on('notification:unread_count', (payload) => {
  console.log('Unread count updated:', payload.unreadCount);
});
```

### ⚡ Event Trigger Matrix

| Domain Module | Trigger Event | Target Recipient | Channel |
| :--- | :--- | :--- | :--- |
| **Quotations** | `QUOTATION_UPDATE` | Customer | WSS / Email (`/quotations/:id`) |
| **Quotations** | `QUOTATION_UPDATE` | Admins | WSS Alert (`Quotation Accepted/Rejected`) |
| **Service Requests** | `SERVICE_REQUEST_UPDATE` | Customer & Admins | WSS Intake Confirmation & Admin Alert |
| **Service Orders** | `SCHEDULE_DISPATCH` | Customer & Tech | Scheduled Appointment Confirmation |
| **Service Orders** | `SCHEDULE_DISPATCH` | Customer | Status Updates (`ON_THE_WAY`, `ARRIVED`, `COMPLETED`) |
| **Store Orders** | `ORDER_STATUS_UPDATE` | Customer & Admins | Order Placed / Payment Confirmed |
| **Store Orders** | `ORDER_STATUS_UPDATE` | Customer | Tracking Number & `SHIPPED` / `DELIVERED` |
| **Billing** | `BILLING_INVOICE` | Customer | Invoice Issued / Payment Receipt |
| **Reviews** | `REVIEW_MODERATION` | Admins / Customer | Moderation Alert / Published Notification |

---

## ⚡ Redis & Concurrency Architecture

The backend utilizes **Upstash Redis** (`ioredis`) for high-throughput distributed state:

1. **Atomic Locks (`acquireLock` / `releaseLock`)**:
   - `payment:order:<id>` & `payment:invoice:<id>`: Guarantees zero duplicate payment reconciliation.
   - `cart:sync:<id>`: Prevents concurrent cart mutation race conditions.
2. **Cluster Presence (`RedisPresenceService`)**:
   - Stores device sessions in Redis sets (`presence:devices:<userId>`).
   - Removes memory leaks across multi-container load balancers.
3. **Multi-Node Pub/Sub (`RedisPubSubService`)**:
   - Distributes socket messages across all server instances listening on `notifications:events`.
4. **BullMQ Background Queues**:
   - Dedicated Redis connection pool with `maxRetriesPerRequest: null` and TLS support.

---

## 🛠️ Tech Stack & Dependencies

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Runtime & Framework** | [NestJS 11](https://nestjs.com/) / Node.js 20+ | Progressive TypeScript server framework |
| **Database & ORM** | [PostgreSQL 15+](https://www.postgresql.org/) & [Prisma 6](https://www.prisma.io/) | Partitioned multi-file schema architecture |
| **Distributed Cache & Bus**| [Upstash Redis](https://upstash.com/) & [BullMQ](https://docs.bullmq.io/) | Pub/Sub, distributed locking, background queues |
| **WebSockets** | [Socket.IO 4](https://socket.io/) | Real-time multi-room bidirectional streaming |
| **Payments** | [Stripe SDK](https://stripe.com/) | PaymentIntents, Checkout Sessions, Webhooks |
| **Media & Files** | [Cloudinary SDK](https://cloudinary.com/) | CDN storage for photos, videos, and attachments |
| **AI Diagnostics** | [Google Gemini 1.5](https://ai.google.dev/) | Structured JSON diagnostic extraction |
| **Rate Limiting** | [@nestjs/throttler](https://github.com/nestjs/throttler) | Multi-tier global IP rate limiting |
| **API Documentation** | [Swagger / OpenAPI](https://swagger.io/) | Custom Dark-Themed UI with Bearer Auth |

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js**: `>= 20.0.0`
- **PostgreSQL Database**: `>= 15.0`
- **Redis Server / Upstash**: `rediss://...`

### 2. Clone & Install
```bash
git clone https://github.com/ZxAYED/elite-vaccum-backend.git
cd elite-vaccum-backend
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/elite_vacuum?schema=public"

# Application
PORT=3000
NODE_ENV=development
APP_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:3001"

# Security
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Redis & BullMQ
REDIS_URL="rediss://default:token@your-redis-host.upstash.io:6379"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Google Gemini AI
GEMINI_API_KEY="your-gemini-api-key"

# Email SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@elitecentralvac.com"
```

### 4. Database Setup & Migrations
```bash
# Push Prisma schema to PostgreSQL
npx prisma db push

# Generate Prisma Client
npx prisma generate
```

### 5. Start Development Server
```bash
# Start NestJS in watch mode
npm run start:dev
```

Access the interactive API documentation at: **`http://localhost:3000/docs`**

---

## 🧪 Testing & Verification

```bash
# Run TypeScript compilation check
npm run typecheck

# Run Redis PubSub & Presence Integration Test
npm run test:redis-notifications

# Run BullMQ Queue & Worker End-to-End Test
npm run test:bullmq-notifications

# Run Unit Tests
npm run test

# Run End-to-End Tests
npm run test:e2e
```

---

## 📖 Frontend API Integration Guide

For the full, production-ready frontend integration roadmap with exact TypeScript definitions, query parameters, request/response bodies, rate limits, WebSocket event flows, and role-based UX recipes:

👉 **[Read the Complete Frontend API Integration Guide (docs/API_INTEGRATION_GUIDE.md)](./docs/API_INTEGRATION_GUIDE.md)**

The guide covers all 17 feature phases for **Customer**, **Admin**, and **Field Technician** client applications with zero omitted endpoints.

---

## 📜 License

This project is proprietary and confidential. Developed for **Elite Central Vacuum**. All rights reserved.