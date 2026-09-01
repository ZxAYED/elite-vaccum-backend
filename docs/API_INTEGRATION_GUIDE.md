# 🚀 Frontend API Integration Guide (Phase-by-Phase)

Welcome to the **Elite Central Vacuum** API Integration Guide. This document provides a complete, step-by-step roadmap for frontend engineers (React, Next.js, Vue, Mobile) to integrate every feature domain of the backend.

---

## 📑 Table of Contents

- [Phase 0: Global Architecture & Client Setup](#phase-0-global-architecture--client-setup)
- [Phase 1: Authentication & User Accounts](#phase-1-authentication--user-accounts)
- [Phase 2: Product Categories & Taxonomy](#phase-2-product-categories--taxonomy)
- [Phase 3: Products Catalog, Filtering & Media](#phase-3-products-catalog-filtering--media)
- [Phase 4: Shopping Cart Management](#phase-4-shopping-cart-management)
- [Phase 5: Customer Delivery Addresses & CRM Management](#phase-5-customer-delivery-addresses--crm-management)
- [Phase 6: E-Commerce Orders, Checkout, Returns & Invoices](#phase-6-e-commerce-orders-checkout-returns--invoices)
- [Phase 7: Central Vacuum Services Catalog & Scheduling](#phase-7-central-vacuum-services-catalog--scheduling)
- [Phase 8: Service Intake Requests & Attachments](#phase-8-service-intake-requests--attachments)
- [Phase 9: Quotations & Customer Approval](#phase-9-quotations--customer-approval)
- [Phase 10: Service Orders & Technician Dispatch](#phase-10-service-orders--technician-dispatch)
- [Phase 11: Real-Time WebSocket & In-App Notifications](#phase-11-real-time-websocket--in-app-notifications)
- [Phase 12: Invoicing, Payments & Refunds](#phase-12-invoicing-payments--refunds)
- [Phase 13: Customer Reviews & Ratings](#phase-13-customer-reviews--ratings)
- [Phase 14: System Settings, FAQs & Legal Policies](#phase-14-system-settings-faqs--legal-policies)
- [Phase 15: CSV Data Export & Reporting](#phase-15-csv-data-export--reporting)
- [Phase 16: Live Real-Time Support Chat & WebSockets](#phase-16-live-real-time-support-chat--websockets)
- [Phase 17: Field Technician Mobile Portal & Admin Management](#phase-17-field-technician-mobile-portal--admin-management)

---

## Phase 0: Global Architecture & Client Setup

### Base URLs & Environment

| Environment     | REST API Base URL            | WebSocket Gateway URL                    | Swagger Docs                      |
| :-------------- | :--------------------------- | :--------------------------------------- | :-------------------------------- |
| **Development** | `http://localhost:3000`      | `ws://localhost:3000/notifications`      | `http://localhost:3000/docs`      |
| **Production**  | `https://api.yourdomain.com` | `wss://api.yourdomain.com/notifications` | `https://api.yourdomain.com/docs` |

### Standard Request Headers

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <accessToken>
```

### Cookie Strategy (`credentials: 'include'`)

The backend uses a hybrid token strategy:

1. **Access Token (`accessToken`)**: Short-lived (15m–1h) returned in the response body. Store in memory (or secure client state).
2. **Refresh Token**: Long-lived (30d) automatically set in a secure `HttpOnly`, `SameSite: Lax/None`, `Secure` cookie named `refreshToken`. Ensure your HTTP client has `withCredentials: true` enabled.

### Standard Axios Setup

```typescript
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach access token
apiClient.interceptors.request.use((config) => {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh token on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    if (
      err.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh-token')
    ) {
      originalRequest._retry = true;
      try {
        const { data } = await apiClient.post('/auth/refresh-token');
        localStorage.setItem('access_token', data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(err);
  },
);
```

### Standard Pagination Response Structure

All paginated GET endpoints follow this structure:

```json
{
  "items": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false,
    "kpi": {
      "active": 30,
      "pending": 15
    }
  }
}
```

---

## Phase 1: Authentication & User Accounts

### 1.1 Customer Registration

- **Endpoint**: `POST /auth/signup`
- **Access**: `Public`
- **Rate Limit**: `@Throttle: 5 req/min`
- **Request Body**:
```json
{
  "email": "customer@example.com",
  "password": "SecurePassword123!",
  "fullName": "Jane Doe",
  "phone": "+15552345678"
}
```
- **Response `201 Created`**:
```json
{
  "message": "Registration successful. A 5-digit verification code has been sent to your email."
}
```

### 1.2 Verify Email OTP

- **Endpoint**: `POST /auth/verify-otp`
- **Access**: `Public`
- **Rate Limit**: `@Throttle: 5 req/min`
- **Request Body**:

```json
{
  "email": "customer@example.com",
  "otp": "48291"
}
```

- **Response `200 OK`**:

```json
{
  "message": "Email verified successfully. You may now log in."
}
```

### 1.3 Resend Verification OTP

- **Endpoint**: `POST /auth/resend-otp`
- **Access**: `Public`
- **Rate Limit**: `@Throttle: 5 req/min`
- **Request Body**:

```json
{
  "email": "customer@example.com"
}
```

### 1.4 User Login (Unified Single Auth Endpoint)

- **Endpoint**: `POST /auth/login`
- **Access**: `Public`
- **Rate Limit**: `@Throttle: 10 req/min`
- **Request Body**:

```json
{
  "email": "customer@example.com",
  "password": "SecurePassword123!"
}
```

- **Response `200 OK`** (Sets `refreshToken` HttpOnly cookie):

```json
{
  "user": {
    "id": "c1f7b8d4-5390-4a88-bb71-d6fe2e79601f",
    "email": "customer@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "fullName": "Jane Doe",
    "role": "CUSTOMER",
    "phone": "+15552345678",
    "isActive": true,
    "isEmailVerified": true
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn..."
}
```

### 1.5 Get Current Profile (`/me`)

- **Endpoint**: `GET /auth/me`
- **Access**: `Authenticated` (`CUSTOMER`, `ADMIN`, `TECHNICIAN`)
- **Response `200 OK`**: Returns current authenticated `user` object.

### 1.6 Refresh Token (Automatic Cookie Rotation)

- **Endpoint**: `POST /auth/refresh-token`
- **Access**: `Public` (Extracts `refreshToken` from HttpOnly cookie or body fallback)
- **Rate Limit**: `@Throttle: 15 req/min`
- **Response `200 OK`**: Returns refreshed `accessToken` and user profile.

### 1.7 Forgot Password (OTP Request)

- **Endpoint**: `POST /auth/forgot-password`
- **Access**: `Public`
- **Rate Limit**: `@Throttle: 5 req/min`
- **Request Body**:

```json
{
  "email": "customer@example.com"
}
```

- **Response `200 OK`**: `{"message": "Password reset OTP sent to your email"}`

### 1.8 Reset Password (with OTP)

- **Endpoint**: `POST /auth/reset-password`
- **Access**: `Public`
- **Rate Limit**: `@Throttle: 5 req/min`
- **Request Body**:

```json
{
  "email": "customer@example.com",
  "otp": "48291",
  "newPassword": "NewSecurePassword123!"
}
```

- **Response `200 OK`**: `{"message": "Password reset successfully. Please log in with your new password."}`

### 1.9 Change Password (Authenticated User)

- **Endpoint**: `POST /auth/change-password`
- **Access**: `Authenticated` (`CUSTOMER`, `ADMIN`, `TECHNICIAN`)
- **Request Body**:

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword123!"
}
```

- **Response `200 OK`**: `{"message": "Password changed successfully"}`

### 1.10 User Logout

- **Endpoint**: `POST /auth/logout`
- **Access**: `Authenticated`
- **Response `200 OK`**: Clears `refreshToken` HttpOnly cookie and invalidates session.

---

## Phase 2: Product Categories & Taxonomy

### 2.1 List Categories (with Active Product Counts)

- **Endpoint**: `GET /categories`
- **Access**: `Public`
- **Query Parameters**:
  - `search` _(string, optional)_
  - `status` _(enum: `ACTIVE`, `INACTIVE`, optional)_
  - `page` _(number, default 1)_
  - `limit` _(number, default 50)_
- **Response `200 OK`**:

```json
{
  "items": [
    {
      "id": "2e6d4ef0-71e5-4e1c-8fcb-2cfd4a8c8ed6",
      "name": "Central Vacuum Units",
      "slug": "central-vacuum-units",
      "description": "High powered, durable central vacuum power units.",
      "imageUrl": "https://res.cloudinary.com/demo/image/upload/units.jpg",
      "status": "ACTIVE",
      "sortOrder": 1,
      "productCount": 14
    }
  ],
  "meta": { "page": 1, "limit": 50, "total": 6, "totalPages": 1 }
}
```

### 2.2 Get Category by ID or Slug

- **Endpoint**: `GET /categories/:id` (Accepts UUID or slug `central-vacuum-units`)
- **Access**: `Public`

### 2.3 Admin Category Management

- **Create**: `POST /categories` (`ADMIN`)
- **Update**: `PATCH /categories/:id` (`ADMIN`)
- **Delete**: `DELETE /categories/:id` (`ADMIN` — Rejects if active products exist)

---

## Phase 3: Products Catalog, Filtering & Media

### 3.1 Public Product Catalog & Search

- **Endpoint**: `GET /products`
- **Access**: `Public`
- **Query Parameters**:
  - `search`: Search across name, description, SKU, and model.
  - `categoryId`: Filter by category UUID.
  - `categorySlug`: Filter by category slug (e.g. `central-vacuum-units`).
  - `minPrice` / `maxPrice`: Numerical price boundaries.
  - `brand`: Filter by manufacturer brand.
  - `isFeatured`: `true` or `false`.
  - `availability`: `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, `PREORDER`.
  - `sort`: `price_asc`, `price_desc`, `newest`, `popular`, `name_asc`.
  - `page` _(default 1)_, `limit` _(default 12)_.
- **Response `200 OK`**:

```json
{
  "items": [
    {
      "id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
      "sku": "PROD-202608-A19",
      "name": "Elite Pro Power Unit 850AW",
      "slug": "elite-pro-power-unit-850aw",
      "model": "EV-850",
      "brand": "Elite",
      "priceUsd": "899.99",
      "compareAtPriceUsd": "999.99",
      "quantity": 18,
      "availability": "IN_STOCK",
      "status": "ACTIVE",
      "isFeatured": true,
      "category": {
        "id": "2e6d4ef0-71e5-4e1c-8fcb-2cfd4a8c8ed6",
        "name": "Central Vacuum Units",
        "slug": "central-vacuum-units"
      },
      "images": [
        {
          "id": "img-01",
          "url": "https://res.cloudinary.com/demo/image/upload/v1/ev-850.jpg",
          "isPrimary": true,
          "sortOrder": 1
        }
      ]
    }
  ],
  "meta": { "page": 1, "limit": 12, "total": 34, "totalPages": 3 }
}
```

### 3.2 Product Detail by ID or Slug

- **Endpoint**: `GET /products/:id` (Accepts UUID, SKU `PROD-...`, or Slug `elite-pro-...`)
- **Access**: `Public`

### 3.3 Admin Product List (Full Visibility)

- **Endpoint**: `GET /products/admin/list`
- **Access**: `ADMIN`
- **Query Parameters**: Same as public catalog + status filter (`DRAFT`, `ACTIVE`, `ARCHIVED`).
- **Response `200 OK`**: Returns full inventory listing with total cost, margin, and stock warnings.

### 3.4 Admin Product Creation (Multipart with Images)

- **Endpoint**: `POST /products`
- **Access**: `ADMIN`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `data` _(stringified JSON)_:
    ```json
    {
      "name": "Elite Pro Power Unit 850AW",
      "slug": "elite-pro-power-unit-850aw",
      "model": "EV-850",
      "brand": "Elite",
      "price": 899.99,
      "stock": 25,
      "categoryId": "2e6d4ef0-71e5-4e1c-8fcb-2cfd4a8c8ed6",
      "description": "Quiet, commercial-grade 850 air-watt motor with hybrid HEPA filtration.",
      "isFeatured": true
    }
    ```
  - `images`: Binary file attachments (JPEG, PNG, WEBP; max 10 files directly uploaded to Cloudinary).

### 3.5 Admin Unified Product Update (Multipart with Image Management)

- **Endpoint**: `PATCH /products/:id`
- **Access**: `ADMIN`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `data` _(stringified JSON of UpdateProductDto)_:
    ```json
    {
      "price": 849.99,
      "stock": 30,
      "deleteImageIds": ["old-image-uuid-1", "old-image-uuid-2"]
    }
    ```
  - `images`: Optional new binary photo files to append to the product gallery.

### 3.6 Admin Quick Stock & Status Updates

- **Update Stock**: `PATCH /products/:id/stock` with `{"stock": 40}`
- **Update Status**: `PATCH /products/:id/status` with `{"status": "ACTIVE", "availability": "IN_STOCK"}`

### 3.7 Admin Delete Product & Images

- **Delete Product**: `DELETE /products/:id` (`ADMIN` — Safely archives if historical order rows exist, or permanently purges if unpurchased)
- **Delete Multiple Images**: `DELETE /products/:id/images` with `{"imageIds": ["uuid-1", "uuid-2"]}`
- **Delete Single Image**: `DELETE /products/:id/images/:imageId`

---

## Phase 4: Shopping Cart Management

The cart is tied to the customer's authenticated account and handles real-time subtotal calculation, tax estimation, and free shipping threshold qualification.

### 4.1 Get Active Cart & Order Summary

- **Endpoint**: `GET /store/cart`
- **Access**: `CUSTOMER`
- **Response `200 OK`**:

```json
{
  "id": "cart-uuid-12345",
  "items": [
    {
      "id": "item-uuid-01",
      "productId": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
      "name": "Elite Pro Power Unit 850AW",
      "sku": "PROD-202608-A19",
      "priceUsd": "899.99",
      "quantity": 1,
      "subtotalUsd": "899.99",
      "imageUrl": "https://res.cloudinary.com/demo/image/upload/v1/ev-850.jpg",
      "stockAvailable": 18,
      "isAvailable": true
    }
  ],
  "summary": {
    "itemCount": 1,
    "totalUnits": 1,
    "subtotalUsd": "899.99",
    "estimatedShippingUsd": "0.00",
    "freeShippingThreshold": "150.00",
    "qualifiesForFreeShipping": true,
    "amountNeededForFreeShipping": "0.00",
    "estimatedTaxUsd": "72.00",
    "estimatedTotalUsd": "971.99"
  }
}
```

### 4.2 Add Item to Cart

- **Endpoint**: `POST /store/cart/items`
- **Access**: `CUSTOMER`
- **Request Body**:

```json
{
  "productId": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
  "quantity": 2
}
```

### 4.3 Update Cart Item Quantity

- **Endpoint**: `PATCH /store/cart/items/:itemId`
- **Access**: `CUSTOMER`
- **Request Body**: `{"quantity": 3}`

### 4.4 Remove Item & Clear Cart

- **Remove Single Item**: `DELETE /store/cart/items/:itemId`
- **Clear Entire Cart**: `DELETE /store/cart`

### 4.5 Fast Cart Item Counter Badge

- **Endpoint**: `GET /store/cart/count`
- **Access**: `CUSTOMER`
- **Response `200 OK`**:

```json
{
  "success": true,
  "count": 3
}
```

### 4.6 Pre-Checkout Cart Validation

- **Endpoint**: `POST /store/cart/validate`
- **Access**: `CUSTOMER`
- **Purpose**: Call right before opening checkout. Verifies that all cart items remain in stock, prices have not changed, and products are active.
- **Response `200 OK`**:

```json
{
  "isValid": true,
  "invalidItems": []
}
```

---

## Phase 5: Customer Delivery Addresses & CRM Management

### 5.1 List Customer Saved Addresses

- **Endpoint**: `GET /store/addresses`
- **Access**: `CUSTOMER`
- **Response `200 OK`**:

```json
[
  {
    "id": "addr-uuid-01",
    "fullName": "Jane Doe",
    "street": "742 Evergreen Terrace",
    "apartment": "Apt 4B",
    "city": "Springfield",
    "state": "OR",
    "zipCode": "97477",
    "phone": "+15552345678",
    "isDefault": true
  }
]
```

### 5.2 Create Saved Address

- **Endpoint**: `POST /store/addresses`
- **Access**: `CUSTOMER`
- **Request Body**:

```json
{
  "fullName": "Jane Doe",
  "street": "742 Evergreen Terrace",
  "apartment": "Apt 4B",
  "city": "Springfield",
  "state": "OR",
  "zipCode": "97477",
  "phone": "+15552345678",
  "isDefault": true
}
```

### 5.3 Update Saved Address

- **Endpoint**: `PATCH /store/addresses/:id`
- **Access**: `CUSTOMER`
- **Request Body**: Same schema as Create Address (partial fields accepted).

### 5.4 Set Active Default Address

- **Endpoint**: `PATCH /store/addresses/:id/set-default`
- **Access**: `CUSTOMER`
- **Response `200 OK`**: Sets address as primary default for 1-click checkout.

### 5.5 Delete Saved Address

- **Endpoint**: `DELETE /store/addresses/:id`
- **Access**: `CUSTOMER`
- **Response `200 OK`**: `{"message": "Address deleted successfully"}`

### 5.6 Admin Customer CRM Management

- **List All Customers**: `GET /customers`
  - **Access**: `ADMIN`
  - **Query Parameters**: `?search=...&email=...&phone=...&cellphone=...&fullName=...&status=ACTIVE&page=1&limit=20`
  - **Response `200 OK`**: Paginated customer list with spend statistics and linked service/product orders.
- **Get Customer Details**: `GET /customers/:id`
  - **Access**: `ADMIN`, `CUSTOMER` (Own profile)
- **Update Customer Profile**: `PATCH /customers/:id`
  - **Access**: `ADMIN`, `CUSTOMER` (Own profile)
  - **Body**: `{"displayName": "Jane Doe", "phone": "+15552345678", "notes": "VIP Client"}`

---

## Phase 6: E-Commerce Orders, Checkout, Returns & Invoices

### 6.1 Checkout Order from Cart

- **Endpoint**: `POST /store/orders`
- **Access**: `CUSTOMER`
- **Request Body**:

```json
{
  "deliveryAddressId": "addr-uuid-01",
  "paymentMethod": "CARD",
  "customerNotes": "Please leave on front porch behind pillar"
}
```

_(Options for `paymentMethod`: `CARD`, `COD` (Cash on Delivery), `CHECK`, `BANK_TRANSFER`)_

- **Response `201 Created` (When `paymentMethod: "CARD"`)**:

```json
{
  "success": true,
  "message": "Order created successfully. Redirect to Stripe checkout to complete payment.",
  "order": {
    "id": "ord-uuid-999",
    "businessId": "ORD-2026-0042",
    "status": "PENDING",
    "totalUsd": "971.99",
    "subtotalUsd": "899.99",
    "shippingFeeUsd": "0.00",
    "taxUsd": "72.00"
  },
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_a1b2c3d4...",
  "stripeSessionId": "cs_test_a1b2c3d4..."
}
```

### 6.2 Retrieve / Regenerate Stripe Checkout Session

- **Endpoint**: `GET /store/orders/checkout/session/:orderId`
- **Access**: `CUSTOMER`
- **Response `200 OK`**: `{"checkoutUrl": "https://checkout.stripe.com/...", "sessionId": "..."}`

### 6.3 Stripe Webhook (Automated Payment Capture)

- **Endpoint**: `POST /store/orders/webhook/stripe`
- **Access**: `Public` (Verified via `stripe-signature` header)
- **Payload**: Raw Stripe Webhook Event (`checkout.session.completed`, `payment_intent.succeeded`).

### 6.4 Customer Order History

- **Endpoint**: `GET /store/orders`
- **Access**: `CUSTOMER`
- **Query Parameters**: `status`, `page`, `limit`

### 6.5 Admin Global Order Management List

- **Endpoint**: `GET /store/orders/admin/list`
- **Access**: `ADMIN`
- **Query Parameters**: `status`, `search`, `page`, `limit`, `from`, `to`

### 6.6 Get Single Order Details & Live Tracking

- **Endpoint**: `GET /store/orders/:id` (Accepts UUID or `ORD-XXXXX`)
- **Access**: `CUSTOMER`, `ADMIN`
- **Response `200 OK`**: Full order details with items, delivery address, live status history, tracking number, and invoice snapshot.

### 6.7 Cancel Order (Auto-Restores Inventory Stock)

- **Endpoint**: `PATCH /store/orders/:id/cancel`
- **Access**: `CUSTOMER` (when `PENDING`), `ADMIN`
- **Guarantees**: Voids unpaid invoice and restores item stock atomically. Cannot be executed if order is already `REFUNDED` or `CANCELLED`.

### 6.8 Admin Unified Order Status & Tracking Update

- **Endpoint**: `PATCH /store/orders/:id/status`
- **Access**: `ADMIN`
- **Request Body**:

```json
{
  "status": "SHIPPED",
  "shippingProvider": "UPS Ground",
  "trackingNumber": "1Z9999999999999999",
  "note": "Dispatched from central distribution hub"
}
```

### 6.9 E-Commerce Returns & Refunds

- **Submit Return Request**: `POST /store/returns/orders/:orderId`
  - **Access**: `CUSTOMER` (only on `DELIVERED` orders)
  - **Body**: `{"reason": "DEFECTIVE", "customerNotes": "Power unit has an internal electrical short."}`
- **Get Return Status**: `GET /store/returns/orders/:orderId`
  - **Access**: `CUSTOMER`, `ADMIN`
- **Admin Approve Return & Process Refund**: `PATCH /store/returns/orders/:orderId/refund`
  - **Access**: `ADMIN`
  - **Body**: `{"adminNote": "Inspection passed. Restored to inventory."}`
  - **Guarantees**: Sets order to `REFUNDED` and restores inventory stock safely.

### 6.10 E-Commerce Invoices & PDF Downloads

- **Get Invoice**: `GET /store/invoices/orders/:orderId` (`CUSTOMER`, `ADMIN`)
- **Generate Invoice PDF**: `POST /store/invoices/orders/:orderId/generate` (`CUSTOMER`, `ADMIN`)
- **Direct PDF Download**: `GET /store/invoices/orders/:orderId/download` (`CUSTOMER`, `ADMIN`)

---

## Phase 7: Central Vacuum Services Catalog & Scheduling

### 7.1 List Categorized Services

- **Endpoint**: `GET /services`
- **Access**: `Public`
- **Response `200 OK`**: Returns fixed service offerings grouped into `SERVICE_AND_MAINTENANCE` and `INSTALLATION` with symptom checklists and baseline pricing.

### 7.2 Get Service Details by Slug

- **Endpoint**: `GET /services/:slug` (e.g. `/services/vacuum-repair`)
- **Access**: `Public`

### 7.3 Check Available Booking Slots (Real-Time Slot Engine)

- **Endpoint**: `GET /schedule/slots`
- **Access**: `Public` / `CUSTOMER`
- **Query Parameters**: `date=YYYY-MM-DD` (e.g. `?date=2026-09-15`)
- **Response `200 OK`**:

```json
{
  "date": "2026-09-15",
  "slots": [
    {
      "timeWindow": "09:00 AM - 11:00 AM",
      "startTime": "09:00",
      "endTime": "11:00",
      "isBooked": false,
      "status": "FREE"
    },
    {
      "timeWindow": "11:00 AM - 01:00 PM",
      "startTime": "11:00",
      "endTime": "13:00",
      "isBooked": true,
      "status": "BOOKED"
    }
  ]
}
```

### 7.4 Admin Dispatch Board Overview Calendar

- **Endpoint**: `GET /schedule/board`
- **Access**: `ADMIN`
- **Query Parameters**: `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&technicianId=...`
- **Response `200 OK`**: Calendar view mapping appointments across all field technicians with aggregate dispatch metrics.

### 7.5 Admin Create Appointment (Redlock Protected)

- **Endpoint**: `POST /schedule`
- **Access**: `ADMIN`
- **Concurrency**: Thread-safe with Redis lock (`lock:schedule:${techId}:${date}:${startTime}`)
- **Request Body**:

```json
{
  "serviceRequestId": "req-uuid-01",
  "technicianId": "tech-uuid-05",
  "date": "2026-09-15",
  "startTime": "09:00",
  "endTime": "11:00",
  "notes": "Gate code #4321"
}
```

### 7.6 Admin Reschedule or Update Appointment

- **Endpoint**: `PATCH /schedule/:appointmentId`
- **Access**: `ADMIN`
- **Body**: `{"date": "2026-09-16", "startTime": "13:00", "endTime": "15:00"}`

### 7.7 Admin Assign / Reassign Technician

- **Endpoint**: `POST /schedule/:appointmentId/assign`
- **Access**: `ADMIN`
- **Body**: `{"technicianId": "tech-uuid-02"}`

### 7.8 Admin Cancel Appointment

- **Endpoint**: `POST /schedule/:appointmentId/cancel`
- **Access**: `ADMIN`
- **Body**: `{"reason": "Customer requested cancellation"}`

---

## Phase 8: Service Intake Requests & Attachments

### 8.1 Submit Service Request (Multipart with Photos/Videos)

- **Endpoint**: `POST /service-requests`
- **Access**: `CUSTOMER` (Mandatory JWT auth)
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `data` _(stringified JSON of CreateServiceRequestDto)_:
    ```json
    {
      "serviceSlug": "vacuum-repair",
      "fullName": "Jane Doe",
      "phone": "+15552345678",
      "address": "742 Evergreen Terrace",
      "city": "Springfield",
      "state": "OR",
      "zipCode": "97477",
      "problemLocation": "2nd Floor Master Bedroom Inlet",
      "preferredDate": "2026-09-15",
      "timeWindow": "10:00 AM - 12:00 PM",
      "problemDescription": "Inlet valve clicks open but provides no suction.",
      "symptoms": ["LOW_SUCTION"],
      "manufacturer": "Beam",
      "modelNumber": "Serenity 375",
      "unitLocation": "Garage"
    }
    ```
  - `attachments`: File uploads (Photos/Videos/Inlet photos directly uploaded to Cloudinary).
- **Response `201 Created`**: Returns created request with generated `businessId` (e.g. `REQ-2026-0089`).

### 8.2 Customer Service Requests History

- **Endpoint**: `GET /service-requests/me`
- **Access**: `CUSTOMER`
- **Query Parameters**: `status`, `page`, `limit`

### 8.3 Admin Triage & KPI Search List

- **Endpoint**: `GET /service-requests`
- **Access**: `ADMIN`
- **Query Parameters**: `search`, `status`, `urgency`, `page`, `limit`
- **Response `200 OK`**: Paginated list + KPI counts (`submitted`, `underReview`, `quoted`, `accepted`, `scheduled`, `rejected`).

### 8.4 Get Service Request Details

- **Endpoint**: `GET /service-requests/:id` (Accepts UUID or `REQ-XXXXX`)
- **Access**: `CUSTOMER`, `ADMIN`, `TECHNICIAN`

### 8.5 Admin Update Service Request Status

- **Endpoint**: `PATCH /service-requests/:id/status`
- **Access**: `ADMIN`
- **Body**: `{"status": "UNDER_REVIEW", "adminNote": "Assigned diagnostic checklist to tech team"}`

### 8.6 Admin Reject Service Request

- **Endpoint**: `POST /service-requests/:id/reject`
- **Access**: `ADMIN`
- **Body**: `{"reason": "OUT_OF_SERVICE_AREA", "comments": "Property located outside our 50-mile operating radius."}`

### 8.7 Append Attachments to Active Request

- **Endpoint**: `POST /service-requests/:id/attachments`
- **Access**: `CUSTOMER`, `ADMIN`
- **Content-Type**: `multipart/form-data` with `attachments` files.

---

## Phase 9: Quotations & Customer Approval

### 9.1 Admin List Quotations with KPIs

- **Endpoint**: `GET /quotations`
- **Access**: `ADMIN`
- **Query Parameters**: `status`, `search`, `page`, `limit`

### 9.2 Customer List Own Received Quotations

- **Endpoint**: `GET /quotations/me`
- **Access**: `CUSTOMER`

### 9.3 View Quotation Details

- **Endpoint**: `GET /quotations/:id` (Accepts UUID or `QUO-XXXXX`)
- **Access**: `CUSTOMER`, `ADMIN`
- **Response `200 OK`**:

```json
{
  "id": "quo-uuid-101",
  "businessId": "QUO-2026-0045",
  "status": "SENT",
  "subtotalUsd": "220.00",
  "discountUsd": "20.00",
  "taxUsd": "16.00",
  "totalUsd": "216.00",
  "lineItems": [
    {
      "description": "Diagnostic & Heavy Duty Reverse Pipe Flush",
      "quantity": 1,
      "unitPriceUsd": "150.00",
      "totalUsd": "150.00"
    },
    {
      "description": "Replacement Low-Voltage Wall Inlet Valve (White)",
      "quantity": 2,
      "unitPriceUsd": "35.00",
      "totalUsd": "70.00"
    }
  ]
}
```

### 9.4 Admin Create Itemized Quotation

- **Endpoint**: `POST /quotations`
- **Access**: `ADMIN`
- **Request Body**:

```json
{
  "serviceRequestId": "req-uuid-01",
  "lineItems": [
    {
      "description": "Motor diagnostic & replacement",
      "quantity": 1,
      "unitPriceUsd": 250
    },
    { "description": "HEPA Filter Core", "quantity": 1, "unitPriceUsd": 45 }
  ],
  "discountUsd": 15,
  "taxUsd": 22.4,
  "notes": "Estimated 2 hours on site"
}
```

_(Automatically transitions service request to `QUOTED` and dispatches notification email to customer)_

### 9.5 Admin Revise Quotation (Snapshot Capture)

- **Endpoint**: `PATCH /quotations/:id`
- **Access**: `ADMIN`
- **Body**: Update line items, totals, or revision reason. Creates a new version and captures immutable revision snapshot into `QuotationRevision`.

### 9.6 Customer Accept Quotation (Auto-Provisions Service Order)

- **Endpoint**: `POST /quotations/:id/accept` (or `PATCH /quotations/:id/status` with `{"action": "ACCEPT"}`)
- **Access**: `CUSTOMER`
- **Concurrency**: Thread-safe with Redis lock (`quotation:action:${id}`).
- **Response `200 OK`**:

```json
{
  "success": true,
  "message": "Quotation accepted and Service Order generated successfully",
  "serviceOrder": {
    "id": "so-uuid-777",
    "businessId": "SO-2026-0045",
    "status": "SCHEDULED",
    "scheduledAt": "2026-09-16T14:00:00Z"
  }
}
```

### 9.7 Customer Reject Quotation

- **Endpoint**: `POST /quotations/:id/reject` (or `PATCH /quotations/:id/status` with `{"action": "REJECT", "rejectionReason": "..."}`)
- **Access**: `CUSTOMER`
- **Body**: `{"reason": "Price is higher than expected."}`

---

## Phase 10: Service Orders & Technician Dispatch

### 10.1 Admin List Service Orders with KPIs

- **Endpoint**: `GET /service-orders`
- **Access**: `ADMIN`
- **Query Parameters**: `status`, `search`, `page`, `limit`

### 10.2 Customer List Own Service Orders

- **Endpoint**: `GET /service-orders/me`
- **Access**: `CUSTOMER`

### 10.3 Customer View Service Order Timeline & ETA

- **Endpoint**: `GET /service-orders/:id`
- **Access**: `CUSTOMER`, `ADMIN`, `TECHNICIAN`
- **Response `200 OK`**:

```json
{
  "id": "so-uuid-777",
  "businessId": "SO-2026-0045",
  "status": "ON_THE_WAY",
  "scheduledAt": "2026-09-16T14:00:00Z",
  "technician": {
    "id": "tech-uuid-01",
    "displayName": "Dave Miller",
    "phone": "+15559876543",
    "avatarUrl": "https://res.cloudinary.com/.../tech-dave.jpg"
  },
  "etas": [
    {
      "etaMinutes": 18,
      "note": "Departing previous job in Springfield, GPS en route",
      "updatedAt": "2026-09-16T13:42:00Z"
    }
  ]
}
```

### 10.4 Admin Create Service Order Directly

- **Endpoint**: `POST /service-orders`
- **Access**: `ADMIN`

### 10.5 Admin Edit Service Order Details

- **Endpoint**: `PATCH /service-orders/:id`
- **Access**: `ADMIN`

### 10.6 Technician / Admin Update Status

- **Endpoint**: `PATCH /service-orders/:id/status`
- **Access**: `TECHNICIAN`, `ADMIN`
- **Request Body**:

```json
{
  "status": "ARRIVED",
  "note": "Parked in driveway, beginning diagnostic check"
}
```

_(Status workflow: `SCHEDULED` $\rightarrow$ `TECHNICIAN_ASSIGNED` $\rightarrow$ `ON_THE_WAY` $\rightarrow$ `ARRIVED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED` $\rightarrow$ `CANCELLED`)_

### 10.7 Admin Assign / Reassign Technician

- **Endpoint**: `POST /service-orders/:id/assign`
- **Access**: `ADMIN`
- **Body**: `{"technicianId": "tech-uuid-01"}`

### 10.8 Technician / Admin Live ETA Update

- **Endpoint**: `POST /service-orders/:id/eta`
- **Access**: `TECHNICIAN`, `ADMIN`
- **Body**: `{"minutes": 20, "note": "En route, slight highway delay"}`

---

## Phase 11: Real-Time WebSocket & In-App Notifications

### 11.1 WebSocket Connection Setup

- **URL**: `ws://<host>:<port>/notifications?token=<accessToken>`
- **Transport**: `['websocket']` (Socket.IO client or standard WSS)

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000/notifications', {
  query: {
    token: localStorage.getItem('access_token'),
  },
  transports: ['websocket'],
});

// Listen for incoming notifications
socket.on('notification:new', (notification) => {
  console.log('New notification:', notification);
  // Show toast & increment unread badge counter
  playNotificationSound();
  updateUnreadBadgeCount((prev) => prev + 1);
});

// Listen for unread count badge updates
socket.on('notification:unread_count', (payload) => {
  console.log('Unread count updated:', payload.unreadCount);
});
```

### 11.2 Notifications REST Endpoints

| Action                 | Method   | Route                         | Access  | Description                                           |
| :--------------------- | :------- | :---------------------------- | :------ | :---------------------------------------------------- |
| **Get Inbox**          | `GET`    | `/notifications`              | Auth    | Paginated notifications with `isRead` & `type` filter |
| **Fast Unread Count**  | `GET`    | `/notifications/unread-count` | Auth    | Returns `{"unreadCount": 3}` for badge header         |
| **Get Preferences**    | `GET`    | `/notifications/preferences`  | Auth    | User email, SMS, push toggle settings                 |
| **Update Preferences** | `PATCH`  | `/notifications/preferences`  | Auth    | Update notification delivery preferences              |
| **Admin Enqueue**      | `POST`   | `/notifications`              | `ADMIN` | Dispatches notification via BullMQ worker queue       |
| **Mark Single Read**   | `PATCH`  | `/notifications/:id/read`     | Auth    | Marks notification as read                            |
| **Mark All Read**      | `PATCH`  | `/notifications/read-all`     | Auth    | Marks all as read & broadcasts via WSS                |
| **Delete**             | `DELETE` | `/notifications/:id`          | Auth    | Removes from inbox                                    |

---

## Phase 12: Invoicing, Payments & Refunds

### 12.1 Admin List Invoices with KPIs

- **Endpoint**: `GET /billing/invoices`
- **Access**: `ADMIN`
- **Query Parameters**: `status`, `search`, `page`, `limit`

### 12.2 Customer List Own Invoices

- **Endpoint**: `GET /billing/invoices/me`
- **Access**: `CUSTOMER`

### 12.3 Get Single Invoice Details

- **Endpoint**: `GET /billing/invoices/:id` (Accepts UUID or `INV-XXXXX`)
- **Access**: `CUSTOMER`, `ADMIN`

### 12.4 View Printable HTML Invoice

- **Endpoint**: `GET /billing/invoices/:id/html`
- **Access**: `CUSTOMER`, `ADMIN` (Returns formatted HTML ready for printing or browser PDF save)

### 12.5 Admin Create Custom or Service Invoice

- **Endpoint**: `POST /billing/invoices`
- **Access**: `ADMIN`

### 12.6 Admin Edit Invoice Details

- **Endpoint**: `PATCH /billing/invoices/:id`
- **Access**: `ADMIN`

### 12.7 Admin Record Offline Payment

- **Endpoint**: `POST /billing/invoices/:id/payments`
- **Access**: `ADMIN`
- **Body**: `{"amountUsd": 216.00, "method": "CASH", "reference": "Cash received on site"}`

### 12.8 Admin Record Refund

- **Endpoint**: `POST /billing/invoices/:id/refunds`
- **Access**: `ADMIN`
- **Body**: `{"paymentId": "pay-uuid-01", "amountUsd": 50.00, "reason": "Goodwill discount adjustment"}`

### 12.9 Pay Invoice via Stripe (Online Card / Apple Pay)

- **Step 1 — Create Stripe PaymentIntent**:
  - `POST /billing/invoices/:id/stripe/payment-intent`
  - Returns: `{"clientSecret": "pi_3MtwBwLkdIwHu7ix28a3tqPa_secret_..."}`
- **Step 2 — Mount Stripe Elements**:
  - Confirm card payment on client with `stripe.confirmCardPayment(clientSecret)`.
- **Step 3 — Confirm Payment on Backend**:
  - `POST /billing/invoices/:id/stripe/confirm`
  - Body: `{"paymentIntentId": "pi_3MtwBwLkdIwHu7ix28a3tqPa"}`
  - Automatically marks invoice `PAID` and sends receipt email.

---

## Phase 13: Customer Reviews & Ratings

### 13.1 Public Reviews List & Average Rating

- **Endpoint**: `GET /reviews`
- **Access**: `Public`
- **Response `200 OK`**:

```json
{
  "ratingSummary": {
    "averageRating": 4.9,
    "totalReviews": 128,
    "distribution": { "5": 115, "4": 10, "3": 2, "2": 1, "1": 0 }
  },
  "items": [
    {
      "id": "rev-01",
      "authorName": "Jane D.",
      "rating": 5,
      "title": "Unbelievable suction power!",
      "comment": "The installation was spotless and the pipe clog was cleared in under an hour.",
      "serviceType": "Clog & Pipe Repair",
      "verifiedPurchase": true,
      "createdAt": "2026-08-31T10:00:00Z"
    }
  ]
}
```

### 13.2 Customer List Submitted Reviews

- **Endpoint**: `GET /reviews/me`
- **Access**: `CUSTOMER`

### 13.3 Submit Review (for Service or Product Order)

- **Endpoint**: `POST /reviews`
- **Access**: `CUSTOMER`
- **Request Body**:

```json
{
  "serviceOrderId": "so-uuid-777",
  "rating": 5,
  "title": "Outstanding technician!",
  "comment": "Dave arrived right on time and fixed all our second-floor suction issues."
}
```

### 13.4 Admin List All Reviews with Moderation Controls

- **Endpoint**: `GET /reviews/admin/all`
- **Access**: `ADMIN`
- **Query Parameters**: `status` (`PENDING`, `PUBLISHED`, `REJECTED`, `HIDDEN`), `search`, `page`, `limit`

### 13.5 Admin Moderate Review

- **Endpoint**: `PATCH /reviews/:id/moderate`
- **Access**: `ADMIN`
- **Body**: `{"status": "PUBLISHED"}`

### 13.6 Admin Delete Review

- **Endpoint**: `DELETE /reviews/:id`
- **Access**: `ADMIN`

---

## Phase 14: System Settings, FAQs & Legal Policies

> [!NOTE]
> **AI Diagnostics Assistant (`/ai/*`)**: The AI Assistant streaming and diagnostic intake endpoints (`POST /ai/chat/stream`, `POST /ai/chat`, `POST /ai/service-intake`) are reserved for a dedicated future AI enhancement milestone. Frontend integration for this phase focuses on **Business Profile**, **FAQ Knowledge Base**, and **Legal Policies Management**.

### 14.1 Public & Admin Business Profile

- **Get Public Profile**: `GET /settings/business-profile`
  - **Access**: `Public`
  - **Response `200 OK`**:

```json
{
  "companyName": "Elite Central Vacuum Systems",
  "email": "contact@elitevacuum.com",
  "phone": "+1 555-0199",
  "emergencyPhone": "+1 555-0198",
  "address": "123 Industrial Way, Suite 100, New York, NY 10001",
  "operatingHours": {
    "monday": "8:00 AM - 6:00 PM",
    "tuesday": "8:00 AM - 6:00 PM",
    "wednesday": "8:00 AM - 6:00 PM",
    "thursday": "8:00 AM - 6:00 PM",
    "friday": "8:00 AM - 5:00 PM",
    "saturday": "9:00 AM - 2:00 PM",
    "sunday": "Closed"
  },
  "serviceRadiusMiles": 50,
  "coverageNotes": "Servicing Greater NYC Metro Area, Long Island, and Northern New Jersey."
}
```

- **Admin Update Profile**: `PATCH /settings/business-profile`
  - **Access**: `ADMIN`
  - **Request Body**: Same schema as above (partial fields accepted).

### 14.2 FAQs Management

- **List Public FAQs**: `GET /settings/faqs`
  - **Access**: `Public`
  - **Query Parameters**: `?category=MAINTENANCE&status=ACTIVE`
  - **Response `200 OK`**:

```json
[
  {
    "id": "faq-uuid-01",
    "question": "How often should I change my central vacuum filter or empty the canister?",
    "answer": "We recommend inspecting and emptying the dirt receptacle every 3 to 6 months.",
    "category": "MAINTENANCE",
    "sortOrder": 1,
    "isActive": true
  }
]
```

- **Admin Create FAQ**: `POST /settings/faqs`
  - **Access**: `ADMIN`
  - **Request Body**:

```json
{
  "question": "What should I do if suction suddenly drops in one wall inlet?",
  "answer": "Check if other inlets have normal suction. If only one inlet is affected, there may be a localized blockage at the 90-degree elbow.",
  "category": "TROUBLESHOOTING",
  "sortOrder": 2,
  "isActive": true
}
```

- **Admin Update FAQ**: `PATCH /settings/faqs/:id` (`ADMIN`)
- **Admin Delete FAQ**: `DELETE /settings/faqs/:id` (`ADMIN`)

### 14.3 Legal Policies Management

- **List All Policies**: `GET /settings/policies` (`Public`)
- **Get Policy by Slug**: `GET /settings/policies/:slug` (e.g. `/settings/policies/terms`, `/settings/policies/privacy`, `/settings/policies/warranty`)
  - **Access**: `Public`
  - **Response `200 OK`**:

```json
{
  "id": "policy-uuid-01",
  "title": "Warranty & Service Guarantee",
  "slug": "warranty",
  "contentMarkdown": "## 10-Year Limited Motor Warranty\nAll installed Elite power units include...",
  "contentHtml": "<h2>10-Year Limited Motor Warranty</h2><p>All installed Elite power units include...</p>",
  "version": "1.2",
  "effectiveDate": "2026-01-01T00:00:00Z",
  "isActive": true
}
```

- **Admin Create Policy**: `POST /settings/policies` (`ADMIN`)
- **Admin Update Policy**: `PATCH /settings/policies/:id` (`ADMIN`)
- **Admin Delete Policy**: `DELETE /settings/policies/:id` (`ADMIN`)

---

## Phase 15: CSV Data Export & Reporting

The backend provides direct streaming CSV download endpoints for administrative reporting. Headers include standard `Content-Disposition: attachment; filename="..."` and `Content-Type: text/csv`.

### 15.1 Executive KPI Dashboards

- `GET /reports/overview` — Revenue over time, service request funnel, product sales.
- `GET /reports/sales` — Sales volume, top selling products, average order value.
- `GET /reports/service-operations` — Intake volume, top requested services.
- `GET /reports/technicians` — Technician leaderboard, customer ratings, completed jobs.
- `GET /reports/customers` — Customer growth, active customer count, repeat rate.

### 15.2 Export Orders Report (CSV)

- **Endpoint**: `GET /reports/export/orders/csv`
- **Access**: `ADMIN`
- **Query Parameters**: `period` (`7d`, `30d`, `90d`, `1y`), `from`, `to`

### 15.3 Export Service Requests Report (CSV)

- **Endpoint**: `GET /reports/export/service-requests/csv`
- **Access**: `ADMIN`

### 15.4 Export Customers CRM Report (CSV)

- **Endpoint**: `GET /reports/export/customers/csv`
- **Access**: `ADMIN`

### 15.5 Export Invoices Report (CSV)

- **Endpoint**: `GET /reports/export/invoices/csv`
- **Access**: `ADMIN`

---

## Phase 16: Live Real-Time Support Chat & WebSockets

A complete enterprise chat system built with **Socket.io (`/chat` namespace)**, **Redis Pub/Sub** (multi-node broadcast), **Redis Presence** (live online tracking), and **BullMQ delayed queue** (offline email alerts if recipient does not read within 2 minutes).

### 16.1 WebSocket Gateway Architecture (`/chat`)

- **Connection URL**: `ws://localhost:5000/chat` (or `wss://api.yourdomain.com/chat`)
- **Authentication**: Pass Bearer token via `auth.token`, query parameter `?token=...`, or headers:

```typescript
import { io, Socket } from 'socket.io-client';

export const initChatSocket = (token: string): Socket => {
  const socket = io('http://localhost:5000/chat', {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log(
      '✅ Connected to Live Support Chat Gateway with ID:',
      socket.id,
    );
  });

  socket.on('chat:connected', ({ userId, connectedRooms }) => {
    console.log(
      'Authenticated as user:',
      userId,
      'Joined rooms:',
      connectedRooms,
    );
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
  });

  return socket;
};
```

### 16.2 Real-Time WebSocket Events Matrix

| Event Name                 | Direction       | Payload Schema                                                                             | Response / Purpose                               |
| :------------------------- | :-------------- | :----------------------------------------------------------------------------------------- | :----------------------------------------------- |
| `chat:join_conversation`   | Client ➔ Server | `{ "conversationId": "uuid" }`                                                             | `{ success: true, room: "..." }`                 |
| `chat:send_message`        | Client ➔ Server | `{ "conversationId": "uuid", "content": "Hello", "type": "TEXT" }`                         | ACK callback `{ success: true, message: {...} }` |
| `chat:typing`              | Client ➔ Server | `{ "conversationId": "uuid", "isTyping": true }`                                           | Broadcasts typing state to room participants     |
| `chat:mark_read`           | Client ➔ Server | `{ "conversationId": "uuid" }`                                                             | Updates read timestamp & broadcasts receipt      |
| `chat:message_received`    | Server ➔ Client | `{ "conversationId": "uuid", "message": { ... } }`                                         | Instant real-time message (<10ms via Redis)      |
| `chat:typing_update`       | Server ➔ Client | `{ "conversationId": "uuid", "userId": "uuid", "userName": "email", "isTyping": boolean }` | Renders typing animation banner                  |
| `chat:read_receipt_update` | Server ➔ Client | `{ "conversationId": "uuid", "userId": "uuid", "readAt": "ISO_DATE" }`                     | Updates message checkmarks to "Read"             |

### 16.3 Frontend Event Listeners & Emitters Code Examples

```typescript
// 1. Send Message via Socket with Immediate Acknowledgment Callback
export const sendChatMessage = (
  socket: Socket,
  conversationId: string,
  content: string,
  onSent?: (res: { success: boolean; message?: any; error?: string }) => void,
) => {
  socket.emit(
    'chat:send_message',
    { conversationId, content, type: 'TEXT' },
    (ackResponse: { success: boolean; message?: any; error?: string }) => {
      if (ackResponse.success) {
        console.log('Message delivered:', ackResponse.message);
      } else {
        console.error('Failed to deliver message:', ackResponse.error);
      }
      onSent?.(ackResponse);
    },
  );
};

// 2. Typing Indicator Emitters
export const emitTypingStatus = (
  socket: Socket,
  conversationId: string,
  isTyping: boolean,
) => {
  socket.emit('chat:typing', { conversationId, isTyping });
};

// 3. Mark Conversation Read
export const markChatRead = (socket: Socket, conversationId: string) => {
  socket.emit('chat:mark_read', { conversationId });
};

// 4. Subscribe to Real-Time Updates in your React / Vue / Angular component
export const setupChatListeners = (
  socket: Socket,
  activeConversationId: string,
  currentUserId: string,
  handlers: {
    onMessage: (message: any) => void;
    onTyping: (isTyping: boolean) => void;
    onReadReceipt: (readAt: string) => void;
  },
) => {
  // Listen for incoming messages
  socket.on('chat:message_received', ({ conversationId, message }) => {
    if (conversationId === activeConversationId) {
      handlers.onMessage(message);
    }
  });

  // Listen for typing updates
  socket.on('chat:typing_update', ({ conversationId, userId, isTyping }) => {
    if (conversationId === activeConversationId && userId !== currentUserId) {
      handlers.onTyping(isTyping);
    }
  });

  // Listen for read receipts
  socket.on(
    'chat:read_receipt_update',
    ({ conversationId, userId, readAt }) => {
      if (conversationId === activeConversationId && userId !== currentUserId) {
        handlers.onReadReceipt(readAt);
      }
    },
  );
};
```

### 16.4 REST Endpoints (Conversations & Multipart Fallback)

#### 1. Start / Get Support Conversation

- **Endpoint**: `POST /chat/conversations`
- **Access**: `CUSTOMER`, `ADMIN`
- **Request Body**:

```json
{
  "type": "SUPPORT",
  "title": "Need help with Central Vacuum Unit",
  "initialMessage": "Hi! Can a technician check my attic piping?"
}
```

- **Response `201 Created`**:

```json
{
  "id": "c5f3e281-79b8-4c12-8822-10f8ad138d82",
  "type": "SUPPORT",
  "title": "Need help with Central Vacuum Unit",
  "participants": [
    { "userId": "cust-uuid-1", "roleInChat": "CUSTOMER" },
    { "userId": "admin-uuid-1", "roleInChat": "ADMIN" }
  ],
  "createdAt": "2026-08-31T17:40:00.000Z"
}
```

#### 2. List Conversations (with Unread Counts & Online Status)

- **Endpoint**: `GET /chat/conversations`
- **Access**: `Authenticated`
- **Response `200 OK`**:

```json
{
  "items": [
    {
      "id": "c5f3e281-79b8-4c12-8822-10f8ad138d82",
      "type": "SUPPORT",
      "title": "Need help with Central Vacuum Unit",
      "unreadCount": 2,
      "isOtherOnline": true,
      "lastMessage": {
        "content": "Our technician can arrive on Wednesday at 10 AM.",
        "createdAt": "2026-08-31T17:42:00.000Z"
      }
    }
  ],
  "meta": { "totalItems": 1, "currentPage": 1, "totalPages": 1 }
}
```

#### 3. Total Unread Badge Count

- **Endpoint**: `GET /chat/unread-count`
- **Access**: `Authenticated`
- **Response `200 OK`**:

```json
{
  "success": true,
  "unreadCount": 3
}
```

#### 4. Get Conversation Message History

- **Endpoint**: `GET /chat/conversations/:id/messages`
- **Access**: `CUSTOMER`, `ADMIN` (Participants only)
- **Query Parameters**: `?page=1&limit=30&before=ISO_DATE`
- **Response `200 OK`**:

```json
{
  "items": [
    {
      "id": "msg-001",
      "conversationId": "c5f3e281-...",
      "content": "Hello! I have a question about the vacuum motor.",
      "type": "TEXT",
      "isRead": true,
      "sender": {
        "id": "cust-01",
        "firstName": "Jane",
        "lastName": "Doe",
        "role": "CUSTOMER"
      },
      "attachments": [],
      "createdAt": "2026-08-31T17:40:00.000Z"
    }
  ],
  "meta": { "totalItems": 1, "currentPage": 1, "totalPages": 1 }
}
```

#### 5. Send Message (REST with Direct Photo/File Upload)

- **Endpoint**: `POST /chat/conversations/:id/messages`
- **Access**: `CUSTOMER`, `ADMIN`
- **Content-Type**: `multipart/form-data`
- **Body**:
  - `data`: `{"content": "Here is a photo of the clogged wall inlet"}`
  - `attachments`: `[file.jpg]` (up to 5 files, uploaded to Cloudinary automatically)

#### 6. Mark Conversation Read

- **Endpoint**: `PATCH /chat/conversations/:id/read`
- **Access**: `CUSTOMER`, `ADMIN`
- **Response `200 OK`**:

```json
{
  "success": true,
  "readAt": "2026-08-31T17:45:00.000Z"
}
```

---

## 🛠️ Phase 17: Field Technician Portal & Mobile App

### 🔀 Unified Auth & Role-Based Navigation

All users (Customers, Admins, Technicians) authenticate through the **same** login endpoint:

- **`POST /auth/login`** returns `{ token, refreshToken, user: { id, email, role: "TECHNICIAN" | "ADMIN" | "CUSTOMER" } }`.
- The Frontend router inspects `user.role`:
  - `CUSTOMER` $\rightarrow$ Redirect to `/account` or store shopping flow.
  - `ADMIN` $\rightarrow$ Redirect to `/admin/dashboard`.
  - `TECHNICIAN` $\rightarrow$ Redirect to `/technician/overview`.

---

### 17.1 Screen 1: Technician Overview & Dashboard

- **Endpoint**: `GET /technicians/me/overview`
- **Access**: `TECHNICIAN`
- **Response `200 OK`**:

```json
{
  "summary": {
    "availability": "AVAILABLE",
    "todayJobsCount": 2,
    "activeJobsCount": 1,
    "completedTodayCount": 1,
    "upcomingJobsCount": 4,
    "completedTotalCount": 104
  },
  "todaySchedule": [
    {
      "appointmentId": "uuid-apt-1",
      "serviceOrderId": "uuid-so-1",
      "businessId": "SO-10023",
      "serviceName": "Central Vacuum Pipe Unclogging",
      "timeWindow": "09:00 AM - 11:00 AM",
      "status": "CONFIRMED",
      "customerName": "John Doe",
      "customerPhone": "+1 555-0199",
      "propertyAddress": "123 Ocean Ave, Suite 400, Brooklyn, NY"
    }
  ],
  "nextAppointment": {
    "appointmentId": "uuid-apt-2",
    "serviceOrderId": "uuid-so-2",
    "businessId": "SO-10024",
    "serviceName": "Full Inlet System Diagnostic & Motor Inspection",
    "scheduledDate": "2026-09-01T13:00:00.000Z",
    "timeWindow": "01:00 PM - 03:00 PM",
    "status": "CONFIRMED",
    "customerName": "Alice Smith",
    "customerPhone": "+1 555-0234",
    "propertyAddress": "742 Evergreen Terrace, Staten Island, NY"
  },
  "upcomingJobs": [
    {
      "appointmentId": "uuid-apt-3",
      "serviceOrderId": "uuid-so-3",
      "businessId": "SO-10025",
      "serviceName": "Annual System Tune-Up",
      "scheduledDate": "2026-09-02T10:00:00.000Z",
      "timeWindow": "10:00 AM - 12:00 PM",
      "status": "CONFIRMED",
      "customerName": "Robert Vance",
      "propertyAddress": "55 Wallaby Way, Queens, NY"
    }
  ],
  "recentlyCompleted": [
    {
      "serviceOrderId": "uuid-so-0",
      "businessId": "SO-10020",
      "serviceName": "Filter Replacement & Suction Test",
      "customerName": "Eleanor Shellstrop",
      "completedAt": "2026-08-31T15:30:00.000Z",
      "totalAmountUsd": "185.00"
    }
  ]
}
```

---

### 17.2 Screen 2: My Assigned Jobs

- **Endpoint**: `GET /technicians/me/jobs`
- **Access**: `TECHNICIAN`
- **Query Params**:
  - `tab`: `today` | `upcoming` | `in_progress` | `completed` | `all` (default: `all`)
  - `page`: `1`
  - `limit`: `20`
- **Response `200 OK`**:

```json
{
  "counts": {
    "today": 2,
    "upcoming": 4,
    "active": 1,
    "completed": 104
  },
  "items": [
    {
      "id": "uuid-so-1",
      "businessId": "SO-10023",
      "status": "IN_PROGRESS",
      "scheduledDate": "2026-08-31T09:00:00.000Z",
      "timeWindow": "09:00 AM - 11:00 AM",
      "customer": {
        "id": "uuid-cust-1",
        "displayName": "John Doe",
        "phone": "+1 555-0199",
        "email": "john@example.com"
      },
      "propertyAddress": "123 Ocean Ave, Brooklyn, NY",
      "service": {
        "name": "Central Vacuum Pipe Unclogging",
        "slug": "central-vac-unclogging"
      },
      "symptoms": [
        "Zero suction on 2nd floor",
        "Whistling noise near utility closet"
      ],
      "etaMinutes": 10,
      "totalAmountUsd": "249.00",
      "createdAt": "2026-08-30T10:00:00.000Z"
    }
  ],
  "meta": { "totalItems": 1, "currentPage": 1, "totalPages": 1 }
}
```

---

### 17.3 Screen 3: Schedule Calendar & Change Requests

#### 1. View Calendar Schedule

- **Endpoint**: `GET /technicians/me/schedule`
- **Access**: `TECHNICIAN`
- **Query Params**: `from=2026-08-31&to=2026-09-07`
- **Response `200 OK`**:

```json
{
  "range": {
    "from": "2026-08-31T00:00:00.000Z",
    "to": "2026-09-07T00:00:00.000Z"
  },
  "days": [
    {
      "date": "2026-08-31",
      "isToday": true,
      "appointmentsCount": 2,
      "appointments": [
        {
          "id": "uuid-apt-1",
          "serviceOrderId": "uuid-so-1",
          "businessId": "SO-10023",
          "serviceName": "Central Vacuum Pipe Unclogging",
          "timeWindow": "09:00 AM - 11:00 AM",
          "status": "CONFIRMED",
          "customerName": "John Doe",
          "customerPhone": "+1 555-0199",
          "propertyAddress": "123 Ocean Ave, Brooklyn, NY"
        }
      ]
    }
  ]
}
```

#### 2. Request Schedule Change

- **Endpoint**: `POST /technicians/me/schedule-change-request`
- **Access**: `TECHNICIAN`
- **Body**:

```json
{
  "serviceOrderId": "uuid-so-1",
  "reason": "Customer requested reschedule due to plumbing emergency at property",
  "proposedDate": "2026-09-02",
  "proposedTimeWindow": "02:00 PM - 04:00 PM"
}
```

- **Response `201 Created`**:

```json
{
  "success": true,
  "message": "Schedule change request submitted to admin team"
}
```

---

### 17.4 Screen 4: Technician Profile & Stats

#### 1. Get Profile Details

- **Endpoint**: `GET /technicians/me/profile`
- **Access**: `TECHNICIAN`
- **Response `200 OK`**:

```json
{
  "id": "uuid-tech-1",
  "userId": "uuid-user-1",
  "displayName": "Alex Rivera",
  "email": "alex.tech@elitevacuum.com",
  "phone": "+1 555-0188",
  "role": "TECHNICIAN",
  "status": "ACTIVE",
  "availability": "AVAILABLE",
  "timezone": "America/New_York",
  "avatarUrl": "https://res.cloudinary.com/.../avatar.jpg",
  "bio": "Certified Master Technician specializing in residential & commercial central vacuum infrastructure with 8+ years experience.",
  "specializations": [
    "Central Vacuum Installation",
    "Pipe Unclogging",
    "Motor Diagnostics",
    "Retraflex Hose Systems"
  ],
  "stats": {
    "completedJobs": 104,
    "jobsThisMonth": 12,
    "upcomingAssignments": 4,
    "joinedAt": "2024-03-15T00:00:00.000Z"
  }
}
```

#### 2. Update Profile Information

- **Endpoint**: `PATCH /technicians/me/profile`
- **Access**: `TECHNICIAN`
- **Body**:

```json
{
  "displayName": "Alex Rivera, Sr. Tech",
  "phone": "+1 555-0190",
  "bio": "Updated bio text here...",
  "specializations": [
    "Central Vac Specialist",
    "Pipe Unclogging",
    "Smart Unit Retrofits"
  ]
}
```

#### 3. Upload / Change Photo

- **Endpoint**: `POST /technicians/me/photo`
- **Access**: `TECHNICIAN`
- **Content-Type**: `multipart/form-data`
- **Body**: `file`: image file (JPEG / PNG / WebP)
- **Response `200 OK`**:

```json
{
  "success": true,
  "avatarUrl": "https://res.cloudinary.com/elite-vac/image/upload/v1234/technicians/tech-1.jpg"
}
```

#### 4. Remove Photo

- **Endpoint**: `DELETE /technicians/me/photo`
- **Access**: `TECHNICIAN`
- **Response `200 OK`**:

```json
{
  "success": true,
  "message": "Technician photo removed successfully"
}
```

---

### 17.5 Screen 5: Real-Time Availability & Settings

- **Endpoint**: `PATCH /technicians/me/availability`
- **Access**: `TECHNICIAN`
- **Body**:

```json
{
  "availability": "AVAILABLE",
  "timezone": "America/New_York"
}
```

> **Supported Availability Modes**: `AVAILABLE` | `BUSY` | `ON_BREAK` | `OFF_DUTY`

- **Response `200 OK`**:

```json
{
  "id": "uuid-tech-1",
  "availability": "AVAILABLE",
  "timezone": "America/New_York",
  "updatedAt": "2026-08-31T18:00:00.000Z"
}
```

---

### 17.6 Field Execution Flow (Technician on Site)

```mermaid
graph LR
    A["ON_THE_WAY"] -->|Send ETA| B["POST /service-orders/:id/eta"]
    A -->|Arrived| C["ARRIVED"]
    C -->|Start Job| D["IN_PROGRESS"]
    D -->|Submit Report| E["POST /service-orders/:id/reports"]
    E -->|Finish| F["COMPLETED"]
```

#### 1. Update Job Status

- **Endpoint**: `PATCH /service-orders/:id/status`
- **Access**: `TECHNICIAN`, `ADMIN`
- **Body**:

```json
{
  "status": "ON_THE_WAY",
  "note": "En route to client property, ETA 15 mins"
}
```

_(Valid transitions: `SCHEDULED` $\rightarrow$ `ON_THE_WAY` $\rightarrow$ `ARRIVED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED`)_

#### 2. Send Live ETA Update

- **Endpoint**: `POST /service-orders/:id/eta`
- **Access**: `TECHNICIAN`
- **Body**:

```json
{
  "minutes": 15,
  "note": "Light traffic on expressway"
}
```

#### 3. Submit Field Diagnostic & Completion Report

- **Endpoint**: `POST /service-orders/:id/reports`
- **Access**: `TECHNICIAN`
- **Body**:

```json
{
  "diagnosisFindings": "Heavy paper towel obstruction lodged at 2nd floor junction elbow.",
  "workPerformed": "Used high-pressure reverse air snake to clear blockage. Tested all 6 wall inlets for airtight vacuum seal.",
  "technicianNotes": "System is now operating at peak 135 CFM suction.",
  "recommendations": "Advised customer to replace carbon motor brushes in 6 months.",
  "partsUsed": [
    { "partName": "2-Inch Vacuum Coupling", "quantity": 1, "costUsd": 12.5 }
  ]
}
```

---

### 17.7 Admin Technician Management CRUD

Admin dispatchers have full CRUD control over the field technician workforce.

#### 1. List Technicians

- **Endpoint**: `GET /technicians`
- **Access**: `ADMIN`
- **Query Parameters**: `?search=...&status=ACTIVE&availability=AVAILABLE&page=1&limit=20`
- **Response `200 OK`**: Paginated technician list with performance KPIs and assignment counts.

#### 2. Get Technician Details

- **Endpoint**: `GET /technicians/:id`
- **Access**: `ADMIN`

#### 3. Create Technician Account

- **Endpoint**: `POST /technicians`
- **Access**: `ADMIN`
- **Request Body**:

```json
{
  "email": "technician@elitevacuum.com",
  "password": "TemporaryPassword123!",
  "firstName": "Alex",
  "lastName": "Rivera",
  "phone": "+1 555-0188",
  "specializations": ["Central Vacuum Installation", "Pipe Unclogging"],
  "bio": "Certified central vac installer with 8+ years experience."
}
```

#### 4. Update Technician Details

- **Endpoint**: `PATCH /technicians/:id`
- **Access**: `ADMIN`
- **Request Body**:

```json
{
  "displayName": "Alex Rivera, Lead Tech",
  "phone": "+1 555-0189",
  "status": "ACTIVE",
  "specializations": ["Installation", "Clog Repair", "Motor Diagnostics"]
}
```

#### 5. Delete / Deactivate Technician

- **Endpoint**: `DELETE /technicians/:id`
- **Access**: `ADMIN`
- **Response `200 OK`**: `{"message": "Technician deleted successfully"}`

---

## 🎯 Summary Checklist for Frontend Teams

| Step         | Feature Domain            | Status | Key Component to Build                                 |
| :----------- | :------------------------ | :----- | :----------------------------------------------------- |
| **Phase 1**  | Auth & User Profile       | Ready  | Auth Modal / Login / Register / OTP Screen             |
| **Phase 2**  | Categories                | Ready  | Mega Menu & Category Navigation Grid                   |
| **Phase 3**  | Products Catalog          | Ready  | Product Grid, Filter Sidebar, Product Page             |
| **Phase 4**  | Shopping Cart             | Ready  | Slide-Over Cart Drawer & Summary Card                  |
| **Phase 5**  | Addresses & CRM           | Ready  | Address Book Modal & Admin Customer CRM                |
| **Phase 6**  | Checkout, Orders, Returns | Ready  | Stripe Checkout, Order Tracking & RMA Modal            |
| **Phase 7**  | Services & Slots          | Ready  | Service Booking Wizard & Slot Picker                   |
| **Phase 8**  | Service Intake            | Ready  | Multi-step Intake Form with Photo Upload               |
| **Phase 9**  | Quotations                | Ready  | Itemized Quote Review & Accept/Reject Modal            |
| **Phase 10** | Service Orders            | Ready  | Live Dispatch Tracking & Technician ETA Card           |
| **Phase 11** | Notifications             | Ready  | WebSocket Listener & Bell Inbox Drawer                 |
| **Phase 12** | Invoices & Billing        | Ready  | Invoice Table, Stripe Payment Modal & HTML Print       |
| **Phase 13** | Reviews                   | Ready  | Star Rating Display & Review Submission Modal          |
| **Phase 14** | AI & Settings             | Ready  | Floating AI Support Chatbot & Policy Pages             |
| **Phase 15** | CSV Reports & Export      | Ready  | One-Click CSV Export Action Buttons in Admin Panel     |
| **Phase 16** | Live Support Chat         | Ready  | Floating Customer Chat Drawer & Admin Live Inbox       |
| **Phase 17** | Technician Field Portal   | Ready  | 5-Screen Mobile-Responsive Field App & Admin Tech CRUD |
