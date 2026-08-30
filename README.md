# Elite Central Vacuum - Enterprise Backend API

Modern enterprise backend built with **NestJS**, **PostgreSQL**, **Prisma ORM**, **Stripe**, **Cloudinary**, and **Google Gemini AI** powering the Elite Central Vacuum platform (Commercial & Residential Vacuum Services, E-Commerce Store, Customer-Driven Scheduling, Dispatch, Invoicing, and AI Diagnostics).

---

## 🚀 Key Features

- **Services & Intake Management**: 10 fixed service packages, 8 standardized symptom checkboxes, customer-driven intake forms, direct photo/video attachments uploaded to Cloudinary.
- **Customer-Driven Scheduling Engine**: Real-time slot availability checking across 5 standard daily dispatch windows (`GET /schedule/slots`), automatic appointment locking on intake submission, conflict detection, and admin rescheduling.
- **Quotations & Service Orders Lifecycle**: Itemized quotes, versioned revision snapshots, automatic conversion of accepted quotes into scheduled Service Orders, and live technician ETA updates.
- **Store & E-Commerce**: Complete product catalog, category hierarchy, authenticated shopping cart, address book, and Stripe / Cash-On-Delivery checkout.
- **Automated Billing & Invoicing**: Automatic invoice provisioning upon service order completion and store checkout, online Stripe payments, in-person payment logging, refunds, and printable PDF invoice generation.
- **Field Technician & Fleet Dispatch**: Real-time dispatch calendar overview board, technician workload tracking, and mobile job execution endpoints.
- **AI Diagnostics & Assistant**: Context-aware troubleshooting chatbot and natural language service intake recommendations powered by Google Gemini AI.
- **Security & Session Management**: JWT access tokens, HttpOnly refresh cookies, database-backed `UserSession` tracking with verified logout revocation, and role-based access control (`ADMIN`, `CUSTOMER`, `TECHNICIAN`).
- **Interactive Swagger Documentation**: Modern dark-themed Swagger interface with Bearer Token Authorization and resilient JSON parsing (`http://localhost:3000/docs`).

---

## 📚 API Documentation Guides

Detailed domain API guides are available in the `/docs` directory:
- 📖 [**Services, Scheduling & Operations Guide**](./docs/SERVICE_API_GUIDE.md)
- 🛒 [**Store, Products, Cart & Orders Guide**](./docs/STORE_API_GUIDE.md)

---

## 🛠️ Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) (Node.js TypeScript framework)
- **Database & ORM**: [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/)
- **Documentation**: Swagger / OpenAPI (`@nestjs/swagger`) with customized Dark Theme
- **Authentication**: JWT, bcrypt password hashing, and HttpOnly cookie session tracking
- **Cloud Storage**: Cloudinary (for service intake attachments and product images)
- **Payments**: Stripe API (PaymentIntents and Webhook handlers)
- **AI Engine**: Google Gemini AI (`@google/genai`)

---

## ⚡ Quick Start

### 1. Prerequisites
- Node.js `v18+` or `v20+`
- PostgreSQL database
- npm / yarn / pnpm

### 2. Environment Configuration
Copy `.env.example` to `.env` and populate your credentials:
```bash
cp .env.example .env
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup & Migrations
```bash
npm run db:push
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```
The server will start on `http://localhost:3000`.

### 6. Explore Swagger API Docs
Open your browser and navigate to:
```
http://localhost:3000/docs
```

---

## 🧪 Verification & Build

```bash
# Type check TypeScript
npm run typecheck

# Build production bundle
npm run build
```