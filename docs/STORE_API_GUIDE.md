# Elite Central Vacuum - Store & E-Commerce API Guide

This is the comprehensive API guide for the **Store, Products, Cart, Checkout, Delivery Addresses, Orders, Invoices, Returns, Product Reviews, and Sales Analytics** domain of the Elite Central Vacuum platform.

---

## Table of Contents
1. [Authentication & Profile Headers](#1-authentication--profile-headers)
2. [Product Categories](#2-product-categories)
3. [Products Catalog & Search](#3-products-catalog--search)
4. [Shopping Cart](#4-shopping-cart)
5. [Delivery Addresses](#5-delivery-addresses)
6. [Orders & Checkout (Stripe & COD)](#6-orders--checkout-stripe--cod)
7. [Store Invoices & Downloads](#7-store-invoices--downloads)
8. [Product Returns & Refunds](#8-product-returns--refunds)
9. [Product Customer Reviews](#9-product-customer-reviews)
10. [Store Analytics & Sales Reports](#10-store-analytics--sales-reports)

---

## 1. Authentication & Profile Headers

- **Base URL**: `http://localhost:3000`
- **Swagger Documentation**: `http://localhost:3000/docs`
- **Auth Header**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`

### Authentication Endpoints
* **`POST /auth/signup`** (Public)
  - Registers a new customer account and sends email OTP verification.
  - Body: `{ "email": "user@example.com", "password": "Password123!", "firstName": "John", "lastName": "Doe", "phone": "+1-555-123-4567" }`
* **`POST /auth/verify-otp`** (Public)
  - Verifies email code and returns access token + refresh token.
  - Body: `{ "email": "user@example.com", "code": "123456", "purpose": "EMAIL_VERIFICATION" }`
* **`POST /auth/login`** (Public)
  - Authenticates user and returns JWT payload.
  - Body: `{ "email": "user@example.com", "password": "Password123!" }`
* **`POST /auth/refresh-token`** (Public)
  - Refreshes expired access token using refresh token.
* **`GET /auth/me`** (Authenticated)
  - Returns authenticated user details and active profile.

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
    - `minPrice` / `maxPrice`: Price range in USD.
    - `availability`: `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, `PREORDER`, `DISCONTINUED`.
    - `sortBy`: `price_asc`, `price_desc`, `newest`, `popularity`.
    - `page` (default `1`), `limit` (default `20`).
* **`GET /products/:idOrSlug`** (Public)
  - Returns full product details including gallery `images`, bullet `highlights`, technical `specifications`, `shippingNotes`, `rating`, and customer reviews.
* **`POST /products`** (Admin)
  - Create new product with gallery images, specifications, and highlights.
* **`PATCH /products/:id`** (Admin)
  - Update product information, pricing, stock, or status (`ACTIVE`, `ARCHIVED`).
* **`DELETE /products/:id`** (Admin)
  - Delete or archive a product.

---

## 4. Shopping Cart

*(Requires Customer Authentication: `@Roles('CUSTOMER')`)*

* **`GET /store/cart`** (Customer)
  - Returns active cart with items, prices, quantities, subtotal, tax estimation, and final total.
* **`POST /store/cart/items`** (Customer)
  - Add product to cart:
    ```json
    {
      "productId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "quantity": 1
    }
    ```
* **`PATCH /store/cart/items/:itemId`** (Customer)
  - Update item quantity (`{ "quantity": 3 }`). Setting `quantity: 0` removes the item.
* **`DELETE /store/cart/items/:itemId`** (Customer)
  - Remove an item from the cart.
* **`DELETE /store/cart`** (Customer)
  - Clear entire cart.
* **`GET /store/cart/count`** (Customer)
  - Returns badge item count for navbar cart icon.

---

## 5. Delivery Addresses

* **`GET /store/addresses`** (Customer)
  - List customer's saved delivery addresses.
* **`POST /store/addresses`** (Customer)
  - Save a new address:
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
  - Edit saved address.
* **`PATCH /store/addresses/:id/set-default`** (Customer)
  - Set as default delivery address.
* **`DELETE /store/addresses/:id`** (Customer)
  - Delete saved address.

---

## 6. Orders & Checkout (Stripe & COD)

* **`POST /store/orders`** (Customer)
  - Places order from active cart. Generates `ORD-YYYYMMDD-XXXXX`.
  - Supports `shippingAddressId` (or new delivery address payload) and payment method:
    ```json
    {
      "shippingAddressId": "uuid-here",
      "paymentMethod": "STRIPE",
      "customerNotes": "Please leave at front door"
    }
    ```
  - For `paymentMethod: "STRIPE"`, returns Stripe client secret and payment URL.
* **`GET /store/orders/checkout/session/:orderId`** (Customer)
  - Retrieve active checkout session details.
* **`GET /store/orders`** (Customer)
  - List customer's own orders.
* **`GET /store/orders/:id`** (Customer / Admin)
  - Detailed order view with items, delivery address snapshot, tracking number, and status timeline.
* **`GET /store/orders/admin/list`** (Admin)
  - Admin list with KPI counters (`PENDING`, `PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`).
* **`PATCH /store/orders/:id/status`** (Admin)
  - Update order status, tracking number, and carrier (e.g. FedEx, UPS).

---

## 7. Store Invoices & Downloads

* **`GET /store/invoices/orders/:orderId`** (Customer / Admin)
  - Retrieve formal invoice breakdown for a product order (`INV-YYYYMMDD-XXXXX`).
* **`GET /store/invoices/orders/:orderId/download`** (Customer / Admin)
  - Download or view printable HTML/PDF invoice.

---

## 8. Product Returns & Refunds

* **`POST /store/returns/orders/:orderId`** (Customer)
  - Request product return with reason and item selection.
* **`GET /store/returns/orders/:orderId`** (Customer / Admin)
  - Check status of return request (`PENDING`, `APPROVED`, `REJECTED`, `REFUNDED`).
* **`PATCH /store/returns/orders/:orderId/refund`** (Admin)
  - Process refund and update payment status.

---

## 9. Product Customer Reviews

* **`POST /reviews`** (**Customer Only** - `@Roles('CUSTOMER')`)
  - Submit 1–5 star review for a purchased product:
    ```json
    {
      "type": "PRODUCT",
      "productId": "uuid-here",
      "rating": 5,
      "title": "Outstanding suction and build quality!",
      "body": "Easy to install and runs super quiet. Highly recommended."
    }
    ```
* **`GET /reviews?type=PRODUCT&productId=uuid-here`** (Public)
  - Get published reviews with average rating and total counts.

---

## 10. Store Analytics & Sales Reports

* **`GET /reports/sales`** (Admin)
  - Total sales revenue USD, Average Order Value (AOV), and top 5 bestselling products by revenue.
* **`GET /reports/overview`** (Admin)
  - Product sales volume, product orders count, and 14-day timeseries revenue chart points.
