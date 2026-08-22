# Elite Central Vacuum - Complete Frontend API Integration Guide

This guide provides exhaustive documentation for all implemented backend APIs: **Authentication**, **Categories**, **Products Catalog**, **Shopping Cart**, **Customer Delivery Addresses**, **Orders & Checkout (Stripe & COD)**, **Invoices & PDF Generation**, and **Returns & Refunds**.

---

## Base URL & Global Headers

- **Base URL**: `http://localhost:3000` (or your production API host)
- **Content-Type**: `application/json` (or `multipart/form-data` for file uploads)
- **Authentication**: Bearer Token in `Authorization: Bearer <accessToken>` header for protected routes.
- **Guest Session Header**: `x-guest-id: <uuid_or_string>` for unauthenticated shopping carts and guest checkouts.

---

## 1. Authentication Module (`/auth`)

### 1.1 Sign Up
- **Route**: `POST /auth/signup`
- **Access**: Public
- **Description**: Registers a new customer account and sends an email OTP for verification.

#### Request Body
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1 (555) 234-5678",
  "password": "SecurePassword123!"
}
```

#### Success Response (`200 OK` / `201 Created`)
```json
{
  "success": true,
  "message": "Signup succeeded. Please check your email for the verification OTP code."
}
```

#### Error Responses
- `409 Conflict`: `{"statusCode": 409, "message": "Email is already registered"}`
- `400 Bad Request`: `{"statusCode": 400, "message": ["password must be at least 8 characters"]}`

---

### 1.2 Verify Email OTP
- **Route**: `POST /auth/verify-otp`
- **Access**: Public
- **Description**: Verifies customer account registration via 6-digit OTP.

#### Request Body
```json
{
  "email": "john.doe@example.com",
  "otp": "481920"
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Account verified successfully. You can now login."
}
```

---

### 1.3 Login
- **Route**: `POST /auth/login`
- **Access**: Public
- **Description**: Authenticates user and returns JWT access and refresh tokens.

#### Request Body
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}
```

#### Success Response (`200 OK`)
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "CUSTOMER",
    "isVerified": true
  }
}
```

---

### 1.4 Get Current User Profile (`/auth/me`)
- **Route**: `GET /auth/me`
- **Access**: Bearer Token
- **Headers**: `Authorization: Bearer <accessToken>`

#### Success Response (`200 OK`)
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1 (555) 234-5678",
  "role": "CUSTOMER",
  "isVerified": true
}
```

---

## 2. Categories Module (`/store/categories`)

### 2.1 List Categories (with Live Active Product Counts)
- **Route**: `GET /store/categories`
- **Access**: Public
- **Description**: Returns all active categories with real-time active product count badges for sidebar filters.

#### Query Parameters
- `includeInactive`: `boolean` (Admin only)
- `search`: `string` (Optional name filter)

#### Success Response (`200 OK`)
```json
{
  "items": [
    {
      "id": "c1a2b3c4-0001-4000-8000-000000000001",
      "name": "Central Vacuum Units",
      "slug": "central-vacuum-units",
      "description": "High-efficiency central vacuum power units",
      "imageUrl": "https://s3.amazonaws.com/elite-vacuum/categories/units.webp",
      "status": "ACTIVE",
      "sortOrder": 1,
      "productCount": 12
    },
    {
      "id": "c1a2b3c4-0001-4000-8000-000000000002",
      "name": "Hose Systems & Kits",
      "slug": "hose-systems-kits",
      "description": "Retractable and standard central vacuum hoses",
      "imageUrl": "https://s3.amazonaws.com/elite-vacuum/categories/hoses.webp",
      "status": "ACTIVE",
      "sortOrder": 2,
      "productCount": 8
    }
  ],
  "meta": {
    "totalCategories": 2,
    "totalActiveProducts": 20
  }
}
```

---

## 3. Products Catalog Module (`/store/products`)

### 3.1 List Products (Dynamic Sidebar Filters, Search & Sort)
- **Route**: `GET /store/products`
- **Access**: Public
- **Description**: Unified product search and filter engine. Supports preset price ranges, category slugs, availability, and sorting presets.

#### Query Parameters
| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| `search` | `string` | `Carbon` | Searches across `name`, `sku`, `model`, `summary`, `description` |
| `category` | `string` | `c1a2b3c4-...` | Filter by Category UUID |
| `categorySlug` | `string` | `central-vacuum-units` | Filter by Category Slug |
| `priceRange` | `string` | `0-100`, `101-500`, `501-1000`, `1000+`, `under_50`, `50_150`, `150_300`, `300_plus` | Preset price ranges |
| `minPrice` | `number` | `50` | Custom minimum price |
| `maxPrice` | `number` | `250` | Custom maximum price |
| `availability` | `string` | `IN_STOCK`, `SPECIAL_ORDER`, `ALL` | Availability filter (`IN_STOCK` requires `quantity > 0`) |
| `sort` | `string` | `price_asc`, `price_desc`, `newest`, `popular` | Sort order preset |
| `page` | `number` | `1` | Pagination page number |
| `limit` | `number` | `12` | Items per page (default: 12) |

#### Success Response (`200 OK`)
```json
{
  "items": [
    {
      "id": "p1a2b3c4-1111-4000-8000-000000000001",
      "name": "Carbon Body Heavy-Duty Filter",
      "sku": "SKU-CB-902",
      "model": "EV-900X",
      "summary": "Multi-layer active carbon replacement filter",
      "description": "High filtration efficiency with HEPA grade carbon canister.",
      "priceUsd": "48.00",
      "compareAtPriceUsd": "60.00",
      "quantity": 34,
      "availability": "IN_STOCK",
      "status": "ACTIVE",
      "featured": true,
      "taxable": true,
      "category": {
        "id": "c1a2b3c4-0001-4000-8000-000000000001",
        "name": "Filters & Bags",
        "slug": "filters-bags"
      },
      "images": [
        {
          "id": "img-001",
          "url": "https://s3.amazonaws.com/elite-vacuum/products/filter-1.webp",
          "isPrimary": true,
          "sortOrder": 0
        },
        {
          "id": "img-002",
          "url": "https://s3.amazonaws.com/elite-vacuum/products/filter-2.webp",
          "isPrimary": false,
          "sortOrder": 1
        }
      ]
    }
  ],
  "meta": {
    "page": 1,
    "limit": 12,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

---

### 3.2 Get Product Details
- **Route**: `GET /store/products/:id` (Accepts UUID or SKU)
- **Access**: Public

#### Success Response (`200 OK`)
```json
{
  "id": "p1a2b3c4-1111-4000-8000-000000000001",
  "name": "Carbon Body Heavy-Duty Filter",
  "sku": "SKU-CB-902",
  "model": "EV-900X",
  "priceUsd": "48.00",
  "quantity": 34,
  "availability": "IN_STOCK",
  "category": {
    "id": "c1a2b3c4-0001-4000-8000-000000000001",
    "name": "Filters & Bags"
  },
  "images": [
    {
      "id": "img-001",
      "url": "https://s3.amazonaws.com/elite-vacuum/products/filter-1.webp",
      "isPrimary": true
    }
  ]
}
```

---

## 4. Shopping Cart Module (`/store/cart`)

> **Authentication Mandatory**: Login is required for all cart operations (`@Roles('CUSTOMER')`). Pass `Authorization: Bearer <token>` with all requests.

### 4.1 Get Cart & Order Summary
- **Route**: `GET /store/cart`
- **Access**: Bearer Token (`CUSTOMER` only)

#### Success Response (`200 OK`)
```json
{
  "id": "cart-uuid-001",
  "customerId": "cust-uuid-001",
  "items": [
    {
      "id": "item-uuid-001",
      "productId": "p1a2b3c4-1111-4000-8000-000000000001",
      "productName": "Carbon Body Heavy-Duty Filter",
      "productSku": "SKU-CB-902",
      "unitPriceUsd": "48.00",
      "quantity": 3,
      "totalUsd": "144.00",
      "image": "https://s3.amazonaws.com/elite-vacuum/products/filter-1.webp",
      "availableStock": 34,
      "isAvailable": true,
      "taxable": true
    }
  ],
  "summary": {
    "itemCount": 3,
    "subtotalUsd": "144.00",
    "shippingFeeUsd": "18.00",
    "freeShippingThreshold": "150.00",
    "qualifiesForFreeShipping": false,
    "amountNeededForFreeShipping": "6.00",
    "estimatedTaxUsd": "11.52",
    "estimatedTotalUsd": "173.52"
  }
}
```

---

### 4.2 Add Item to Cart
- **Route**: `POST /store/cart/items`
- **Access**: Bearer Token (`CUSTOMER` only)
- **Validations Handled**: Active status verification, real-time inventory limit check, maximum per-order limits (1-100).

#### Request Body
```json
{
  "productId": "p1a2b3c4-1111-4000-8000-000000000001",
  "quantity": 2
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Added Carbon Body Heavy-Duty Filter to your cart",
  "cart": { ... }
}
```

#### Error Response
- `400 Bad Request`: `{"statusCode": 400, "message": "Cannot add 5 units. Only 3 units remaining in stock."}`
- `401 Unauthorized`: `{"statusCode": 401, "message": "Authentication is required to use the shopping cart"}`

---

### 4.3 Update Cart Item Quantity (`- 1 +` Stepper)
- **Route**: `PATCH /store/cart/items/:itemId`
- **Access**: Bearer Token (`CUSTOMER` only)

#### Request Body
```json
{
  "quantity": 4
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Cart item updated",
  "cart": { ... }
}
```

---

### 4.4 Remove Item & Clear Cart
- **Remove Single Item**: `DELETE /store/cart/items/:itemId` (Customer only)
- **Clear Entire Cart**: `DELETE /store/cart` (Customer only)
- **Get Item Count**: `GET /store/cart/count` (Customer only - returns `{ "count": 5 }`)
- **Pre-checkout Validation**: `POST /store/cart/validate` (Customer only - returns `{ "isValid": true, ... }`)

---

### 4.5 Merge Guest Cart on Login
- **Route**: `POST /store/cart/merge`
- **Access**: Bearer Token (`CUSTOMER`)
- **Description**: Call this immediately after user logs in to automatically merge items they added as a guest into their customer account.

#### Request Body
```json
{
  "guestId": "guest-session-uuid-12345"
}
```

---

## 5. Customer Delivery Addresses (`/store/addresses`)

> **Note**: Delivery addresses are **strictly controlled and managed by the Customer** on their account. Admins do not manage customer personal address books.

### 5.1 List Saved Delivery Addresses
- **Route**: `GET /store/addresses`
- **Access**: Bearer Token (`CUSTOMER` only)

#### Success Response (`200 OK`)
```json
{
  "items": [
    {
      "id": "addr-uuid-001",
      "label": "Home",
      "line1": "742 Evergreen Terrace",
      "line2": "Apt 4B",
      "city": "Springfield",
      "state": "OR",
      "postalCode": "97477",
      "country": "USA",
      "isDefault": true
    },
    {
      "id": "addr-uuid-002",
      "label": "Office Warehouse",
      "line1": "100 Industrial Parkway",
      "line2": "Suite 200",
      "city": "Eugene",
      "state": "OR",
      "postalCode": "97402",
      "country": "USA",
      "isDefault": false
    }
  ],
  "totalCount": 2
}
```

---

### 5.2 Add New Delivery Address
- **Route**: `POST /store/addresses`
- **Access**: Bearer Token (`CUSTOMER` only)

#### Request Body
```json
{
  "label": "Vacation Home",
  "line1": "550 Ocean Drive",
  "city": "Miami",
  "state": "FL",
  "postalCode": "33139",
  "country": "USA",
  "isDefault": false
}
```

---

### 5.3 Set Active Default Address
- **Route**: `PATCH /store/addresses/:id/set-default`
- **Access**: Bearer Token (`CUSTOMER` only)
- **Description**: Sets the specified address as the primary/default delivery address for all checkouts.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Address 'Home' is now set as your active default delivery address",
  "activeAddressId": "addr-uuid-001"
}
```

---

### 5.4 Update Delivery Address
- **Route**: `PATCH /store/addresses/:id`
- **Access**: Bearer Token (`CUSTOMER` only)

---

### 5.5 Delete Delivery Address
- **Route**: `DELETE /store/addresses/:id`
- **Access**: Bearer Token (`CUSTOMER` only)

---

## 6. Orders & Checkout Module (`/store/orders`)

> **Authentication Mandatory**: Login is required to place an order. Guests must register or log in before calling `POST /store/orders`.

### How Delivery Address Handling Works:
1. **Existing Saved Address**: Customer provides `deliveryAddressId: "addr-uuid-..."`. The backend links this address (`shippingAddressId`), includes `addressRef` in the response, and preserves an immutable JSON snapshot.
2. **New Delivery Address on Checkout**: If the customer hasn't saved the address yet or wants to add a new one, they provide the `deliveryAddress` payload. The backend creates and saves the new `CustomerAddress` under the customer's account, links its ID, and proceeds seamlessly.
3. **Fallback**: If neither is supplied, the backend uses the customer's active default saved address.

### Supported Payment Methods:
Strictly **`STRIPE`** (Credit/Debit Card via Stripe Checkout) or **`COD`** (Cash on Delivery).

---

### 6.1 Proceed to Order from Cart (Checkout with Stripe or COD)
- **Route**: `POST /store/orders`
- **Access**: Bearer Token (`CUSTOMER` only)
- **Description**: Converts the customer's active cart into a `ProductOrder`, atomically decrements inventory stock, creates an `Invoice`, takes an immutable snapshot of the delivery address, and returns the Stripe Checkout URL (or confirms Cash on Delivery).

#### Request Body (Option A: Online Card with Stripe + Existing Address)
```json
{
  "paymentMethod": "STRIPE",
  "deliveryAddressId": "d92c7fa8-8924-4f01-a7eb-6237c569ef81",
  "recipientName": "John Doe",
  "contactPhone": "+1 (555) 234-5678",
  "contactEmail": "john.doe@example.com",
  "notes": "Please leave near front door"
}
```

#### Success Response (Stripe Card Checkout - `201 Created`)
```json
{
  "success": true,
  "message": "Order created successfully",
  "paymentMethod": "STRIPE",
  "order": {
    "id": "ord-uuid-001",
    "businessId": "ORD-20260822-58192",
    "status": "PENDING",
    "subtotalUsd": "144.00",
    "shippingFeeUsd": "18.00",
    "taxUsd": "11.52",
    "totalUsd": "173.52",
    "shippingAddress": {
      "addressId": "d92c7fa8-8924-4f01-a7eb-6237c569ef81",
      "label": "Home",
      "recipientName": "John Doe",
      "line1": "742 Evergreen Terrace",
      "city": "Springfield",
      "state": "OR",
      "postalCode": "97477",
      "country": "USA"
    },
    "addressRef": {
      "id": "d92c7fa8-8924-4f01-a7eb-6237c569ef81",
      "label": "Home",
      "line1": "742 Evergreen Terrace",
      "city": "Springfield",
      "state": "OR",
      "postalCode": "97477",
      "country": "USA"
    }
  },
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_a1b2c3d4...",
  "sessionId": "cs_test_a1b2c3d4..."
}
```
> **Frontend Action**: Redirect the user to `checkoutUrl` via `window.location.href = response.checkoutUrl`.

---

#### Request Body (Option B: Cash on Delivery + New Delivery Address)
```json
{
  "paymentMethod": "COD",
  "deliveryAddress": {
    "label": "Home Delivery",
    "line1": "1234 Main Street",
    "city": "Brooklyn",
    "state": "NY",
    "postalCode": "11201",
    "country": "USA",
    "isDefault": true
  },
  "recipientName": "Jane Smith",
  "contactPhone": "+1 (555) 987-6543",
  "contactEmail": "jane@example.com",
  "notes": "Cash prepared upon delivery"
}
```

#### Success Response (COD - `201 Created`)
```json
{
  "success": true,
  "message": "Order placed successfully with Cash on Delivery (COD)",
  "paymentMethod": "COD",
  "order": {
    "id": "ord-uuid-002",
    "businessId": "ORD-20260822-99124",
    "status": "PENDING",
    "subtotalUsd": "190.00",
    "shippingFeeUsd": "0.00",
    "taxUsd": "15.20",
    "totalUsd": "205.20",
    "addressRef": {
      "label": "Home Delivery",
      "line1": "1234 Main Street",
      "city": "Brooklyn",
      "state": "NY",
      "postalCode": "11201"
    }
  },
  "checkoutUrl": null,
  "sessionId": null
}
```

---

### 6.2 Get Customer Order History
- **Route**: `GET /store/orders`
- **Access**: Bearer Token (`CUSTOMER`)
- **Query Params**: `status`, `search`, `page`, `limit`, `dateFrom`, `dateTo`

#### Success Response (`200 OK`)
```json
{
  "items": [
    {
      "id": "ord-uuid-001",
      "businessId": "ORD-20260822-58192",
      "status": "PAID",
      "trackingNumber": "FX-99182371",
      "shippingProvider": "FedEx Freight",
      "totalUsd": "173.52",
      "placedAt": "2026-08-22T20:45:00.000Z",
      "items": [
        {
          "id": "item-001",
          "productName": "Carbon Body Heavy-Duty Filter",
          "quantity": 3,
          "unitPriceUsd": "48.00",
          "totalUsd": "144.00"
        }
      ]
    }
  ],
  "meta": { "page": 1, "limit": 10, "totalItems": 1, "totalPages": 1 }
}
```

---

### 6.3 Get Order Details (Tracking, Address Snapshot, Timeline & Invoice)
- **Route**: `GET /store/orders/:id` (Accepts UUID or Business ID e.g. `ORD-20260822-58192`)
- **Access**: Bearer Token (`CUSTOMER` or `ADMIN`)

#### Success Response (`200 OK`)
```json
{
  "id": "ord-uuid-001",
  "businessId": "ORD-20260822-58192",
  "status": "SHIPPED",
  "shippingProvider": "FedEx Express",
  "trackingNumber": "FX-8899223311",
  "subtotalUsd": "144.00",
  "shippingFeeUsd": "18.00",
  "taxUsd": "11.52",
  "totalUsd": "173.52",
  "shippingAddress": {
    "recipientName": "John Doe",
    "line1": "742 Evergreen Terrace",
    "city": "Springfield",
    "state": "OR",
    "postalCode": "97477"
  },
  "items": [ ... ],
  "statusHistory": [
    {
      "id": "hist-003",
      "status": "SHIPPED",
      "note": "Package dispatched via FedEx Express (Tracking: FX-8899223311)",
      "actorLabel": "Admin (admin@elitevacuum.com)",
      "changedAt": "2026-08-22T20:50:00.000Z"
    },
    {
      "id": "hist-002",
      "status": "PAID",
      "note": "Payment confirmed via Stripe (Ref: cs_test_a1b2c3d4)",
      "actorLabel": "Stripe Webhook",
      "changedAt": "2026-08-22T20:46:00.000Z"
    },
    {
      "id": "hist-001",
      "status": "PENDING",
      "note": "Order placed, awaiting Stripe payment confirmation",
      "actorLabel": "Customer (john.doe@example.com)",
      "changedAt": "2026-08-22T20:45:00.000Z"
    }
  ],
  "invoices": [
    {
      "id": "inv-uuid-001",
      "businessId": "INV-20260822-48192",
      "status": "PAID",
      "totalUsd": "173.52"
    }
  ]
}
```

---

### 6.4 Cancel Order (Auto-Restores Inventory)
- **Route**: `PATCH /store/orders/:id/cancel`
- **Access**: Bearer Token (`CUSTOMER` or `ADMIN`)
- **Description**: Sets order status to `CANCELLED`, voids unpaid invoice, and **automatically restores product inventory stock**.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Order cancelled successfully and inventory restored",
  "order": {
    "id": "ord-uuid-001",
    "status": "CANCELLED"
  }
}
```

---

### 6.5 Admin Unified Order Update (Status, Notes, Tracking & Carrier in 1 API)
- **Route**: `PATCH /store/orders/:id/status`
- **Access**: Bearer Token (`ADMIN`)
- **Description**: Admin updates order fulfillment status, carrier name, tracking number, and appends a timeline note in a single unified API call.

#### Request Body
```json
{
  "status": "SHIPPED",
  "shippingProvider": "FedEx Express",
  "trackingNumber": "FX-8899223311",
  "notes": "Package dispatched from Central Distribution Center"
}
```

#### Supported Order Status Values
- `PENDING`: Awaiting payment (Stripe) or order verification (COD)
- `PAID`: Payment received
- `PROCESSING`: Packing in warehouse
- `SHIPPED`: In transit with carrier
- `OUT_FOR_DELIVERY`: On delivery vehicle to destination
- `DELIVERED`: Successfully delivered to recipient (Auto-settles COD invoices to `PAID`)
- `COMPLETED`: Order cycle finished
- `FAILED`: Payment or delivery attempt failed
- `CANCELLED`: Cancelled (stock restored)
- `REFUNDED`: Refund processed (stock restored)

---

## 7. Invoices & PDF Module (`/store/invoices`)

### 7.1 Get Invoice Metadata
- **Route**: `GET /store/invoices/orders/:orderId`
- **Access**: Bearer Token (`CUSTOMER` or `ADMIN`)

### 7.2 Download Invoice PDF
- **Route**: `GET /store/invoices/orders/:orderId/download`
- **Access**: Bearer Token (`CUSTOMER` or `ADMIN`)
- **Response**: Streamable binary PDF attachment (`application/pdf`).

---

## 8. Returns & Refunds Module (`/store/returns`)

### How Returns & Refunds Work:
1. **Eligibility**: Return requests can only be initiated by the customer once the order status is **`DELIVERED`** or **`COMPLETED`**.
2. **Customer Submission**: The customer sends a return reason (`DEFECTIVE_OR_DAMAGED`, `WRONG_ITEM`, `NOT_AS_DESCRIBED`, `OTHER`) and details in `customerNote`.
3. **Timeline Logging**: The return request is automatically logged to the order's `statusHistory` timeline.
4. **Admin Approval & Inventory Restoration**: When Admin approves the return (`PATCH /store/returns/orders/:orderId/refund`), the backend atomically:
   - Sets the `ProductOrder.status` to `REFUNDED`.
   - **Automatically increments the inventory quantity** for all returned products back into active stock (`restoreProductStock`).
   - Appends an audit note with Admin details to the timeline history.

---

### 8.1 Submit Return Request (Customer)
- **Route**: `POST /store/returns/orders/:orderId`
- **Access**: Bearer Token (`CUSTOMER` only)
- **Parameters**: `orderId` (Order UUID or Business ID e.g. `ORD-20260822-58192`)

#### Request Body
```json
{
  "orderItemId": "d92c7fa8-8924-4f01-a7eb-6237c569ef81",
  "reason": "DEFECTIVE_OR_DAMAGED",
  "customerNote": "Power unit emits unusual noise and fails to sustain suction upon installation."
}
```

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "message": "Return request submitted successfully. Our support team will review your request and contact you with return shipping instructions.",
  "orderId": "ord-uuid-001",
  "orderBusinessId": "ORD-20260822-58192",
  "status": "DELIVERED",
  "returnTimelineId": "hist-uuid-099",
  "submittedAt": "2026-08-22T21:05:00.000Z"
}
```

#### Error Responses
- `400 Bad Request`: `{"statusCode": 400, "message": "Returns can only be requested for orders that have been delivered (Current status: 'SHIPPED')"}`
- `403 Forbidden`: `{"statusCode": 403, "message": "You do not have permission to request a return for this order"}`

---

### 8.2 Get Return Status & History
- **Route**: `GET /store/returns/orders/:orderId`
- **Access**: Bearer Token (`CUSTOMER` or `ADMIN`)

#### Success Response (`200 OK`)
```json
{
  "orderId": "ord-uuid-001",
  "orderBusinessId": "ORD-20260822-58192",
  "currentStatus": "DELIVERED",
  "items": [
    {
      "id": "item-001",
      "productName": "Carbon Body Heavy-Duty Filter",
      "quantity": 2,
      "unitPriceUsd": "48.00",
      "totalUsd": "96.00"
    }
  ],
  "returnHistory": [
    {
      "id": "hist-uuid-099",
      "status": "DELIVERED",
      "note": "Return Requested: Reason=DEFECTIVE_OR_DAMAGED, Note=Power unit emits unusual noise...",
      "actorLabel": "Customer (john.doe@example.com)",
      "changedAt": "2026-08-22T21:05:00.000Z"
    }
  ]
}
```

---

### 8.3 Admin Approve Return & Process Refund
- **Route**: `PATCH /store/returns/orders/:orderId/refund`
- **Access**: Bearer Token (`ADMIN` only)
- **Description**: Marks the order status as `REFUNDED` and **automatically restores product inventory stock**.

#### Request Body
```json
{
  "adminNote": "Returned items received and inspected at warehouse. Issued full refund."
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Order status updated to REFUNDED and product stock inventory has been restored.",
  "order": {
    "id": "ord-uuid-001",
    "businessId": "ORD-20260822-58192",
    "status": "REFUNDED"
  }
}
```

---

## Frontend Integration Quick Reference Checklist

1. **Category Badges**: Use `GET /store/categories` and display `productCount` next to category names.
2. **Preset Price Filters**: Pass `priceRange=0-100`, `101-500`, `501-1000`, `1000+` to `GET /store/products`.
3. **Cart Stepper**: Bind `+` and `-` buttons to `PATCH /store/cart/items/:id` with `{ quantity }`.
4. **Guest $\rightarrow$ Logged-in Cart**: Save `guestId` in `localStorage`. On login, execute `POST /store/cart/merge` with `{ guestId }`.
5. **Checkout**: Call `POST /store/orders`. If `paymentMethod: "STRIPE"`, redirect to `response.checkoutUrl`. If `COD`, route directly to order confirmation page.
6. **Order Timeline**: Render `order.statusHistory` in a vertical timeline component showing timestamp, actor, and status notes.
