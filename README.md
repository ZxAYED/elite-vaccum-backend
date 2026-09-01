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
  <a href="#-production-engineering-highlights--architecture-innovations">Engineering Highlights</a> &bull;
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

## 🚀 Key Capabilities

### 🛠️ Service Intake & Scheduling Engine
- **Fixed Service Catalog & Symptom Mapping**: 10 curated central vacuum services with 8 diagnostic symptoms (`LOW_SUCTION`, `CLOG`, `ODOR`, `ELECTRICAL`, etc.).
- **Customer-Driven Slot Engine**: Live availability checking across 5 standard dispatch windows (`GET /schedule/slots`), automatic appointment locking on intake submission, conflict prevention, and admin rescheduling.
- **Quotations & Order Lifecycle**: Revisions tracking, PDF previews, and instant auto-conversion into scheduled `ServiceOrder` records upon customer acceptance.

### 🛒 E-Commerce Store & Checkout
- **Unified Product Catalog**: Filterable products, hierarchical categories, stock levels, and related parts.
- **Cart Management**: High-speed authenticated cart cached in Redis with instant DB synchronizations.
- **Checkout & Order Tracking**: Stripe Sessions / PaymentIntents, Cash On Delivery (COD), order tracking timeline, and automatic invoice settlement.

### ⚡ Distributed Redis Infrastructure
- **Distributed Locks**: Multi-instance Redlock pattern for payment settlement, stock reservation, and atomic quota locks.
- **Redis Presence Tracker**: Real-time connected device and session tracking (`RedisPresenceService`) with 0 in-memory leaks.
- **High-Speed Cache**: 60s/300s TTL caches on service offerings, unread notification counts, and product catalog metadata.

### 🔔 BullMQ + Pub/Sub Real-Time Notifications
- **Background Worker Processing**: Dedicated BullMQ queue (`notifications-delivery`) with worker concurrency, exponential retry backoff, and rate limiting (25 jobs/sec).
- **Cross-Node WebSocket Delivery**: Subscribed across cluster nodes via Redis Pub/Sub channels (`notifications:events`) to broadcast to rooms (`user:<id>`, `role:<ROLE>`, `broadcast`).
- **Omnichannel Support**: In-app unread inbox counter, persistent PostgreSQL storage, and SMTP email notifications.

### 💬 Enterprise Real-Time Live Support Chat
- **Dual Communication Channels**: High-performance Socket.io WebSocket (`/chat` namespace) + REST fallback with Cloudinary photo/file uploads.
- **Cluster Synchronization via Redis Pub/Sub**: Multi-server instant message broadcast, typing indicators, and read receipts (<10ms).
- **BullMQ Offline Resilience**: Automatic 2-minute delayed offline check to dispatch email alerts when users or admins are away from their screens.

### 🤖 Google Gemini AI Diagnostics & Live DB Querying
- **Natural Language Intake Analysis**: Extracts structured symptoms, urgency recommendations, and follow-up troubleshooting prompts using Gemini structured output.
- **Live Database Tools**: Queries real-time active services, live products, real customer history, and service orders with graceful fallback.

### 🛡️ Enterprise Security & Multi-Tier Rate Limiting
- **Global Throttling**: `@nestjs/throttler` layered rate limiting (`15 req/sec`, `60 req/10s`, `200 req/min`) protecting against DDoS and automated attacks.
- **Atomic OTP Rate Limiting**: Dedicated Redis OTP flood prevention (max 4 attempts / 5 mins).
- **Session Control**: HttpOnly cookie refresh tokens, JWT Bearer verification, and revocable database sessions.

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