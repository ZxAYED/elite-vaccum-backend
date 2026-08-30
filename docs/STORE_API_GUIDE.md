# Elite Central Vacuum - Store & E-Commerce API Guide

This is the comprehensive API guide for the **Store, Products Catalog, Categories, Shopping Cart, Delivery Addresses, Checkout & Orders, Invoices, Returns, Product Reviews, and Sales Analytics** domain of the Elite Central Vacuum platform.

---

## Table of Contents
1. [Authentication & Session Lifecycle](#1-authentication--session-lifecycle)
2. [Product Categories](#2-product-categories)
3. [Products Catalog & Search](#3-products-catalog--search)
4. [Shopping Cart](#4-shopping-cart)
5. [Delivery Addresses](#5-delivery-addresses)
6. [Orders & Checkout (Stripe & COD)](#6-orders--checkout-stripe--cod)
7. [Store Invoices & PDF Downloads](#7-store-invoices--pdf-downloads)
8. [Product Returns & Refunds](#8-product-returns--refunds)
9. [Product Customer Reviews](#9-product-customer-reviews)
10. [Store Analytics & Sales Reports](#10-store-analytics--sales-reports)

---

## 1. Authentication & Session Lifecycle

- **Base URL**: `http://localhost:3000`
- **Swagger Documentation**: `http://localhost:3000/docs` (Dark Mode UI with Bearer Token Input)
- **Auth Header**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`

### Authentication Endpoints
* **`POST /auth/signup`** (Public)
  - Registers a new customer account and sends an email OTP verification code.
  - Body:
    ```json
    {
      "email": "user@example.com",
      "password": "Password123!",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+1-555-123-4567"
    }
    ```
* **`POST /auth/verify-otp`** (Public)
  - Verifies email code and returns `accessToken` + sets HttpOnly `refreshToken` cookie.
  - Body: `{ "email": "user@example.com", "code": "123456", "purpose": "EMAIL_VERIFICATION" }`
* **`POST /auth/login`** (Public)
  - Authenticates user, creates active `UserSession` record in database, and returns JWT tokens.
  - Body: `{ "email": "user@example.com", "password": "Password123!" }`
* **`POST /auth/logout`** (**Authenticated**)
  - Validates caller session and revokes the active session (`revokedAt: new Date()`) in PostgreSQL.
* **`POST /auth/refresh-token`** (Public / Cookie-based)
  - Refreshes expired access token using valid refresh token cookie.
* **`GET /auth/me`** (Authenticated)
  - Returns authenticated user details, customer record, and role.

---

## 2. Product Categories

* **`GET /categories`** (Public)
  - Returns active categories with `id`, `slug`, `name`, `description`, `icon`, `imageUrl`, `productsCount`, and `sortOrder`.
* **`POST /categories`** (Admin)
  - Creates a new category.
* **`PATCH /categories/:id`** & **`DELETE /categories/:id`** (Admin)
  - Updates or deletes a category.

---

## 3. Products Catalog & Search

* **`GET /products`** (Public)
  - **Query Parameters**:
    - `search`: Full text search on name, summary, description, and SKU.
    - `categoryId` / `categorySlug`: Filter by category.
    - `minPrice` / `maxPrice`: Price range filter in USD.
    - `availability`: `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, `PREORDER`, `DISCONTINUED`.
    - `sortBy`: `price_asc`, `price_desc`, `newest`, `popularity`.
    - `page` (default `1`), `limit` (default `20`).
* **`GET /products/:idOrSlug`** (Public)
  - Returns full product details including gallery `images`, bullet `highlights`, technical `specifications`, `shippingNotes`, `rating`, and customer reviews.
* **`POST /products`** (Admin)
  - Creates a new product with gallery images, specifications, and highlights.
* **`PATCH /products/:id`** (Admin)
  - Updates product information, pricing, inventory stock, or status (`ACTIVE`, `ARCHIVED`).
* **`DELETE /products/:id`** (Admin)
  - Deletes or archives a product.

---

## 4. Shopping Cart

*(Strictly Requires Authentication: `@Roles('CUSTOMER', 'ADMIN')`)*

* **`GET /store/cart`** (Customer)
  - Returns active cart with items, unit prices, quantities, subtotal, tax estimation, and final total.
* **`POST /store/cart/items`** (Customer)
  - Adds product to cart:
    ```json
    {
      "productId": "uuid-here",
      "quantity": 1
    }
    ```
* **`PATCH /store/cart/items/:itemId`** (Customer)
  - Updates item quantity (`{ "quantity": 3 }`). Setting `quantity: 0` removes the item.
* **`DELETE /store/cart/items/:itemId`** (Customer)
  - Removes an item from the cart.
* **`DELETE /store/cart`** (Customer)
  - Clears entire cart.
* **`GET /store/cart/count`** (Customer)
  - Returns badge item count for the navbar cart icon.

---

## 5. Delivery Addresses

*(Strictly Requires Authentication: `@Roles('CUSTOMER', 'ADMIN')`)*

* **`GET /store/addresses`** (Customer)
  - Lists customer's saved delivery addresses.
* **`POST /store/addresses`** (Customer)
  - Saves a new delivery address:
    ```json
    {
      "label": "Home",
      "line1": "123 Main Street",
      "line2": "Apt 4B",
      "city": "Greenwich",
      "state": "CT",
      "postalCode": "06830",
      "country": "USA",
      "isDefault": true
    }
    ```
* **`PATCH /store/addresses/:id`** (Customer)
  - Edits saved address.
* **`PATCH /store/addresses/:id/set-default`** (Customer)
  - Sets address as active default delivery address.
* **`DELETE /store/addresses/:id`** (Customer)
  - Deletes saved address.

---

## 6. Orders & Checkout (Stripe & COD)

*(Strictly Requires Authentication: `@Roles('CUSTOMER', 'ADMIN')`)*

* **`POST /store/orders`** (Customer)
  - Places order from active cart. Generates `ORD-YYYYMMDD-XXXXX`.
  - Supports saved `shippingAddressId` or new address payload, with payment method:
    ```json
    {
      "shippingAddressId": "uuid-here",
      "paymentMethod": "STRIPE",
      "customerNotes": "Please leave on porch"
    }
    ```
  - For `paymentMethod: "STRIPE"`, returns Stripe client secret and checkout URL.
* **`GET /store/orders`** (Customer)
  - Lists customer's own order history.
* **`GET /store/orders/:id`** (Customer / Admin)
  - Detailed order view with items, delivery address snapshot, tracking number, and status timeline.
* **`GET /store/orders/admin/list`** (Admin)
  - Admin management list with KPI counters (`PENDING`, `PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`).
* **`PATCH /store/orders/:id/status`** (Admin)
  - Updates order status, carrier (FedEx, UPS), and tracking number.

---

## 7. Store Invoices & PDF Downloads

* **`GET /store/invoices/orders/:orderId`** (Customer / Admin)
  - Formal invoice breakdown for a store product order (`INV-YYYYMMDD-XXXXX`).
* **`GET /store/invoices/orders/:orderId/pdf`** (Customer / Admin)
  - Download or stream official PDF invoice.

---

## 8. Product Returns & Refunds

* **`POST /store/returns/orders/:orderId`** (Customer)
  - Submits product return request with reason and selected items.
* **`GET /store/returns/orders/:orderId`** (Customer / Admin)
  - Checks status of return request (`PENDING`, `APPROVED`, `REJECTED`, `REFUNDED`).
* **`PATCH /store/returns/orders/:orderId/refund`** (Admin)
  - Approves refund and marks payment status.

---

## 9. Product Customer Reviews

* **`POST /reviews`** (**Customer Only** - `@Roles('CUSTOMER')`)
  - Submits 1–5 star review for a purchased product:
    ```json
    {
      "type": "PRODUCT",
      "productId": "uuid-here",
      "rating": 5,
      "headline": "Outstanding suction and build quality!",
      "comment": "Easy to install and runs super quiet. Highly recommended."
    }
    ```
* **`GET /reviews?type=PRODUCT&productId=uuid-here`** (Public)
  - Retrieves published product reviews with average rating and star counts.

---

## 10. Store Analytics & Sales Reports

* **`GET /reports/sales`** (Admin)
  - Total sales revenue USD, Average Order Value (AOV), and top bestselling products by revenue.
* **`GET /reports/overview`** (Admin)
  - Product sales volume, orders count, and 14-day timeseries revenue chart points.
