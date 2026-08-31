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
  <a href="#-system-architecture">Architecture</a> &bull;
  <a href="#-frontend-api-integration-guide">API Integration Guide</a> &bull;
  <a href="#-key-capabilities">Key Features</a> &bull;
  <a href="#-module-breakdown">Modules</a> &bull;
  <a href="#-real-time-notifications--websocket">Notifications & WebSockets</a> &bull;
  <a href="#-redis--concurrency-architecture">Redis & Concurrency</a> &bull;
  <a href="#-quick-start">Quick Start</a>
</p>

---

</div>

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

### 🤖 Google Gemini AI Diagnostics & Live DB Querying
- **Natural Language Intake Analysis**: Extracts structured symptoms, urgency recommendations, and follow-up troubleshooting prompts using Gemini structured output.
- **Live Database Tools**: Queries real-time active services, live products, real customer history, and service orders with graceful fallback.

### 🛡️ Enterprise Security & Multi-Tier Rate Limiting
- **Global Throttling**: `@nestjs/throttler` layered rate limiting (`15 req/sec`, `60 req/10s`, `200 req/min`) protecting against DDoS and automated attacks.
- **Atomic OTP Rate Limiting**: Dedicated Redis OTP flood prevention (max 4 attempts / 5 mins).
- **Session Control**: HttpOnly cookie refresh tokens, JWT Bearer verification, and revocable database sessions.

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

For the full phase-by-phase frontend integration roadmap covering all 14 feature domains with exact schemas, example payloads, error codes, and frontend recipes:

👉 **[Complete Phase-by-Phase Frontend API Integration Guide (14 Phases)](./docs/API_INTEGRATION_GUIDE.md)**

| Phase | Feature Domain | Status | Description |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Global Architecture & Client Setup | ✅ Ready | Axios interceptor, Base URLs, HttpOnly cookies, pagination |
| **Phase 1** | Authentication & User Accounts | ✅ Ready | Register, Email OTP, Login, `/auth/me`, Password Reset |
| **Phase 2** | Categories & Taxonomy | ✅ Ready | Category hierarchy with active product counters |
| **Phase 3** | Products Catalog & Search | ✅ Ready | Multi-attribute search, filter, sort, and image upload |
| **Phase 4** | Shopping Cart Management | ✅ Ready | Live price recalculation, stock checks, free shipping threshold |
| **Phase 5** | Saved Delivery Addresses | ✅ Ready | Address book CRUD, default delivery address selection |
| **Phase 6** | E-Commerce Orders & Checkout | ✅ Ready | Stripe Checkout Session, COD, live tracking timeline |
| **Phase 7** | Services Catalog & Scheduling | ✅ Ready | Service offerings, dynamic slot availability engine |
| **Phase 8** | Service Intake Requests | ✅ Ready | Multi-step intake with symptom tags & media attachments |
| **Phase 9** | Quotations & Customer Approval | ✅ Ready | Itemized estimates, atomic Accept/Reject with Redis locks |
| **Phase 10** | Service Orders & Field Dispatch | ✅ Ready | Technician assignment, live ETA updates, completion reports |
| **Phase 11** | Real-Time Notifications & WSS | ✅ Ready | WebSocket Gateway, BullMQ delivery, unread badge counter |
| **Phase 12** | Invoicing, Payments & Refunds | ✅ Ready | Multi-line invoices, Stripe PaymentIntent, printable HTML |
| **Phase 13** | Customer Reviews & Ratings | ✅ Ready | Verified customer reviews, 5-star rating aggregates |
| **Phase 14** | Analytics, Settings & AI Assistant | ✅ Ready | Executive KPI reports, FAQs, policies, Gemini SSE stream |

---

## 📜 License

This project is proprietary and confidential. Developed for **Elite Central Vacuum**. All rights reserved.