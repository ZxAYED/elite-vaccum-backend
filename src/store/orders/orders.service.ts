import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  ProductOrderStatus,
  ProductStatus,
  UserRole,
} from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { generateBusinessId } from 'src/common/utils/business-id.util';
import { getPagination } from 'src/common/utils/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import Stripe from 'stripe';
import { CreateOrderDto, OrderPaymentMethod } from '../dto/create-order.dto';
import { OrderListQueryDto } from '../dto/order-list-query.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { StoreProductsService } from '../products/products.service';

@Injectable()
export class StoreOrdersService {
  private readonly logger = new Logger(StoreOrdersService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: StoreProductsService,
  ) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && stripeKey.trim().length > 0 && !stripeKey.includes('...')) {
      this.stripe = new Stripe(stripeKey);
      this.logger.log('Stripe initialized successfully');
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY is unconfigured in .env. Stripe checkout sessions will operate in mock preview mode.',
      );
    }
  }

  private isAdmin(user?: RequestUser | null): boolean {
    return user?.role === UserRole.ADMIN;
  }

  private isUuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );
  }

  private async generateOrderBusinessId(): Promise<string> {
    return generateBusinessId('ORD', async (id) => {
      const exists = await this.prisma.productOrder.findUnique({
        where: { businessId: id },
        select: { id: true },
      });
      return !!exists;
    });
  }

  private async generateInvoiceBusinessId(): Promise<string> {
    return generateBusinessId('INV', async (id) => {
      const exists = await this.prisma.invoice.findUnique({
        where: { businessId: id },
        select: { id: true },
      });
      return !!exists;
    });
  }

  private async resolveCustomerId(userId: string): Promise<string> {
    const existing = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) return existing.id;

    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!userRecord) {
      throw new NotFoundException(`User with ID '${userId}' not found`);
    }

    const created = await this.prisma.customer.create({
      data: {
        userId: userRecord.id,
        displayName:
          `${userRecord.firstName} ${userRecord.lastName}`.trim() ||
          userRecord.email,
        firstName: userRecord.firstName || 'Customer',
        lastName: userRecord.lastName || '',
        email: userRecord.email,
        phone: userRecord.phone || 'N/A',
      },
      select: { id: true },
    });
    return created.id;
  }

  private orderInclude() {
    return {
      customer: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          email: true,
          phone: true,
        },
      },
      addressRef: true,
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              model: true,
              images: {
                where: { isPrimary: true },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      statusHistory: {
        orderBy: { changedAt: 'desc' },
      },
      invoices: {
        include: {
          payments: true,
        },
      },
    } satisfies Prisma.ProductOrderInclude;
  }

  // ==========================================
  // ORDER CREATION & STRIPE / COD CHECKOUT
  // ==========================================

  async createOrderFromCart(dto: CreateOrderDto, user: RequestUser) {
    if (!user || !user.id) {
      throw new UnauthorizedException(
        'Authentication required. Please login or sign up to proceed to checkout.',
      );
    }

    // 1. Resolve Customer ID
    const customerId = await this.resolveCustomerId(user.id);
    const customerRecord = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    // 2. Fetch Active Cart for this Customer
    const cart = await this.prisma.cart.findFirst({
      where: { customerId },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: { select: { status: true } },
                images: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { url: true },
                },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException(
        'Your shopping cart is empty. Please add products to your cart before proceeding to checkout.',
      );
    }

    // 3. Resolve Delivery Address (ID vs New Delivery Address Object)
    let deliveryAddressId: string | null = null;
    let selectedAddress: any = null;

    if (dto.deliveryAddressId) {
      // Option A: Customer selected an existing saved delivery address ID
      const savedAddress = await this.prisma.customerAddress.findUnique({
        where: { id: dto.deliveryAddressId },
      });
      if (!savedAddress || savedAddress.customerId !== customerId) {
        throw new BadRequestException('Selected delivery address was not found in your account.');
      }
      deliveryAddressId = savedAddress.id;
      selectedAddress = savedAddress;
    } else if (dto.deliveryAddress) {
      // Option B: Customer entered a new delivery address payload during checkout -> Create & save it
      const inline = dto.deliveryAddress;
      const count = await this.prisma.customerAddress.count({ where: { customerId } });
      const isDefault = inline.isDefault || count === 0;

      selectedAddress = await this.prisma.$transaction(async (tx) => {
        if (isDefault) {
          await tx.customerAddress.updateMany({
            where: { customerId },
            data: { isDefault: false },
          });
        }

        const createdAddr = await tx.customerAddress.create({
          data: {
            customerId,
            label: inline.label?.trim() || 'Delivery Address',
            line1: inline.line1.trim(),
            line2: inline.line2?.trim() || null,
            city: inline.city.trim(),
            state: inline.state.trim(),
            postalCode: inline.postalCode.trim(),
            country: inline.country?.trim() || 'USA',
            isDefault,
          },
        });

        if (isDefault) {
          await tx.customer.update({
            where: { id: customerId },
            data: { primaryAddressId: createdAddr.id },
          });
        }

        return createdAddr;
      });

      deliveryAddressId = selectedAddress.id;
    } else {
      // Option C: Fallback to customer's default saved delivery address
      const defaultAddr = await this.prisma.customerAddress.findFirst({
        where: { customerId, isDefault: true },
      });
      if (defaultAddr) {
        deliveryAddressId = defaultAddr.id;
        selectedAddress = defaultAddr;
      } else {
        throw new BadRequestException(
          'Please provide a delivery address (deliveryAddress) or select a saved address ID (deliveryAddressId).',
        );
      }
    }

    // Build immutable delivery address snapshot
    const deliveryAddressSnapshot = {
      addressId: deliveryAddressId,
      label: selectedAddress.label,
      recipientName: dto.recipientName?.trim() || customerRecord?.displayName || user.email,
      line1: selectedAddress.line1,
      line2: selectedAddress.line2,
      city: selectedAddress.city,
      state: selectedAddress.state,
      postalCode: selectedAddress.postalCode,
      country: selectedAddress.country,
      phone: dto.contactPhone?.trim() || customerRecord?.phone || 'N/A',
      email: dto.contactEmail?.trim() || user.email || '',
    };

    // 4. Validate All Products for Active Status & Available Inventory
    for (const item of cart.items) {
      const prod = item.product;
      if (
        !prod ||
        prod.status !== ProductStatus.ACTIVE ||
        prod.category.status !== 'ACTIVE'
      ) {
        throw new BadRequestException(
          `Product '${prod?.name || item.productId}' is currently unavailable.`,
        );
      }
      if (prod.quantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for '${prod.name}'. Only ${prod.quantity} units available, but ${item.quantity} requested in cart.`,
        );
      }
    }

    // 5. Calculate Order Totals
    const subtotal = cart.items.reduce((sum: Prisma.Decimal, item: any) => {
      return sum.plus(item.product.priceUsd.mul(item.quantity));
    }, new Prisma.Decimal(0));

    const subtotalNumber = Number(subtotal);
    // Free shipping threshold >= $150, otherwise standard freight $18.00
    const shippingFee = subtotalNumber >= 150 ? 0.0 : 18.0;

    // 8% estimated tax on taxable items
    const taxableSubtotal = cart.items
      .filter((i: any) => i.product.taxable)
      .reduce((sum: number, i: any) => {
        return sum + Number(i.product.priceUsd) * i.quantity;
      }, 0);
    const tax = Number((taxableSubtotal * 0.08).toFixed(2));
    const discount = 0.0;
    const total = Number((subtotalNumber + shippingFee + tax - discount).toFixed(2));

    const businessId = await this.generateOrderBusinessId();
    const invoiceBusinessId = await this.generateInvoiceBusinessId();

    const paymentMethod = dto.paymentMethod;
    const isCod = paymentMethod === OrderPaymentMethod.COD;
    const initialStatus = ProductOrderStatus.PENDING;

    // 6. Execute Order Placement Transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // Decrement inventory stock atomically for each product
      for (const item of cart.items) {
        await this.productsService.decreaseProductStock(
          item.productId,
          item.quantity,
          tx,
        );
      }

      // Create ProductOrder record
      const createdOrder = await tx.productOrder.create({
        data: {
          businessId,
          customerId,
          shippingAddressId: deliveryAddressId,
          status: initialStatus,
          shippingProvider: 'Standard Freight Carrier',
          shippingAddress: deliveryAddressSnapshot,
          subtotalUsd: subtotal,
          shippingFeeUsd: new Prisma.Decimal(shippingFee),
          taxUsd: new Prisma.Decimal(tax),
          discountUsd: new Prisma.Decimal(discount),
          totalUsd: new Prisma.Decimal(total),
          items: {
            create: cart.items.map((item: any) => ({
              productId: item.productId,
              productName: item.product.name,
              productSku: item.product.sku,
              quantity: item.quantity,
              unitPriceUsd: item.product.priceUsd,
              totalUsd: item.product.priceUsd.mul(item.quantity),
              productSnapshot: {
                name: item.product.name,
                sku: item.product.sku,
                model: item.product.model,
                priceUsd: Number(item.product.priceUsd),
                image: item.product.images?.[0]?.url || null,
              },
            })),
          },
          statusHistory: {
            create: {
              status: initialStatus,
              note: isCod
                ? `Order placed with Cash on Delivery (COD). Note: ${dto.notes || 'None'}`
                : dto.notes
                  ? `Order placed: ${dto.notes}`
                  : 'Order placed, awaiting Stripe payment confirmation',
              actorLabel: `Customer (${user.email})`,
            },
          },
        },
        include: this.orderInclude(),
      });

      // Create associated Invoice
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      const invoice = await tx.invoice.create({
        data: {
          businessId: invoiceBusinessId,
          customerId,
          productOrderId: createdOrder.id,
          status: InvoiceStatus.ISSUED,
          dueDate,
          subtotalUsd: subtotal,
          taxUsd: new Prisma.Decimal(tax),
          discountUsd: new Prisma.Decimal(discount),
          totalUsd: new Prisma.Decimal(total),
          notes: isCod
            ? 'Payment Method: Cash on Delivery (COD)'
            : 'Payment Method: Stripe Credit/Debit Card',
          lineItems: {
            create: cart.items.map((item: any, idx: number) => ({
              description: `${item.product.name} (SKU: ${item.product.sku || 'N/A'})`,
              quantity: item.quantity,
              unitPriceUsd: item.product.priceUsd,
              totalUsd: item.product.priceUsd.mul(item.quantity),
              sortOrder: idx,
            })),
          },
        },
      });

      // If COD, record pending Payment entry
      if (isCod) {
        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            customerId,
            amountUsd: new Prisma.Decimal(total),
            status: PaymentStatus.PENDING,
            methodLabel: 'Cash on Delivery (COD)',
            transactionReference: `COD-${businessId}`,
          },
        });
      }

      // Empty Cart after successful order creation
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({
        where: { id: cart.id },
        data: { subtotalUsd: new Prisma.Decimal(0) },
      });

      return createdOrder;
    });

    // 7. Handle Payment Response
    if (isCod) {
      return {
        success: true,
        message: 'Order placed successfully with Cash on Delivery (COD)',
        paymentMethod: 'COD',
        order,
        checkoutUrl: null,
        sessionId: null,
      };
    }

    // Stripe Checkout Session for Online Card Payment
    const stripeSession = await this.createStripeCheckoutSession(order, user);

    return {
      success: true,
      message: 'Order created successfully',
      paymentMethod: 'STRIPE',
      order,
      checkoutUrl: stripeSession.url,
      sessionId: stripeSession.id,
    };
  }

  /**
   * Generates a Stripe Checkout Session with full line items, shipping, tax, and order metadata.
   */
  async createStripeCheckoutSession(
    order: any,
    user?: RequestUser | null,
  ): Promise<{ id: string; url: string }> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const successUrl = (
      process.env.STRIPE_SUCCESS_URL ||
      `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`
    )
      .replace('{ORDER_ID}', order.id)
      .replace('{BUSINESS_ID}', order.businessId);

    const cancelUrl = (
      process.env.STRIPE_CANCEL_URL ||
      `${frontendUrl}/checkout/cancel?order_id=${order.id}`
    ).replace('{ORDER_ID}', order.id);

    if (!this.stripe) {
      return {
        id: `mock_cs_${order.id.slice(0, 8)}`,
        url: `${frontendUrl}/checkout/mock-pay?order_id=${order.id}&total=${Number(order.totalUsd)}`,
      };
    }

    try {
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        order.items.map((item: any) => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.productName,
              description: item.productSku ? `SKU: ${item.productSku}` : undefined,
              images: item.productSnapshot?.image ? [item.productSnapshot.image] : [],
            },
            unit_amount: Math.round(Number(item.unitPriceUsd) * 100),
          },
          quantity: item.quantity,
        }));

      if (Number(order.shippingFeeUsd) > 0) {
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Standard Freight Shipping',
            },
            unit_amount: Math.round(Number(order.shippingFeeUsd) * 100),
          },
          quantity: 1,
        });
      }

      if (Number(order.taxUsd) > 0) {
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Estimated Sales Tax',
            },
            unit_amount: Math.round(Number(order.taxUsd) * 100),
          },
          quantity: 1,
        });
      }

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: lineItems,
        customer_email: order.customer?.email || user?.email || undefined,
        client_reference_id: order.id,
        metadata: {
          orderId: order.id,
          businessId: order.businessId,
          customerId: order.customerId,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      return {
        id: session.id,
        url: session.url || successUrl,
      };
    } catch (err: any) {
      this.logger.error(`Failed to create Stripe checkout session: ${err.message}`, err.stack);
      return {
        id: `fallback_${order.id}`,
        url: `${frontendUrl}/checkout/success?order_id=${order.id}`,
      };
    }
  }

  /**
   * Regenerates a Stripe checkout session for a pending order.
   */
  async getCheckoutSession(orderId: string, user?: RequestUser | null) {
    const order = await this.getOrderDetails(orderId, user);

    if (order.status !== ProductOrderStatus.PENDING) {
      throw new BadRequestException(
        `Cannot create checkout session for order with status '${order.status}'`,
      );
    }

    const session = await this.createStripeCheckoutSession(order, user);
    return {
      orderId: order.id,
      businessId: order.businessId,
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Handles Stripe webhook events (checkout.session.completed, payment_intent.succeeded).
   */
  async handleStripeWebhook(payload: Buffer | string, signature?: string) {
    let event: Stripe.Event;

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (this.stripe && webhookSecret && signature) {
      try {
        event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      } catch (err: any) {
        throw new BadRequestException(
          `Stripe Webhook Signature verification failed: ${err.message}`,
        );
      }
    } else {
      event = typeof payload === 'string' ? JSON.parse(payload) : JSON.parse(payload.toString());
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId || session.client_reference_id;

      if (orderId) {
        await this.markOrderAsPaid(
          orderId,
          session.id,
          (session.amount_total ?? 0) / 100,
        );
      }
    }

    return { received: true };
  }

  /**
   * Marks an order as paid, confirms the invoice, and creates the payment transaction.
   */
  async markOrderAsPaid(
    orderId: string,
    transactionReference: string,
    amountUsd: number,
  ) {
    const order = await this.prisma.productOrder.findUnique({
      where: { id: orderId },
      include: { invoices: true },
    });

    if (!order) {
      this.logger.warn(`Order '${orderId}' not found during payment processing`);
      return;
    }

    if (
      order.status === ProductOrderStatus.PAID ||
      order.status === ProductOrderStatus.PROCESSING
    ) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Update ProductOrder status
      await tx.productOrder.update({
        where: { id: order.id },
        data: { status: ProductOrderStatus.PAID },
      });

      // 2. Write to Status History
      await tx.productOrderStatusHistory.create({
        data: {
          orderId: order.id,
          status: ProductOrderStatus.PAID,
          note: `Payment confirmed via Stripe (Ref: ${transactionReference})`,
          actorLabel: 'Stripe Webhook',
        },
      });

      // 3. Update Invoice & Record Payment
      const invoice = order.invoices[0];
      if (invoice) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.PAID,
            paidAt: new Date(),
          },
        });

        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            customerId: order.customerId,
            amountUsd: new Prisma.Decimal(amountUsd || Number(order.totalUsd)),
            status: PaymentStatus.SUCCEEDED,
            methodLabel: 'Stripe Credit Card',
            transactionReference,
          },
        });
      }
    });

    this.logger.log(`Order '${order.businessId}' marked as PAID successfully.`);
  }

  // ==========================================
  // ORDER QUERIES & ADMIN CONTROLS
  // ==========================================

  async getMyOrders(query: OrderListQueryDto, user: RequestUser) {
    const customerId = await this.resolveCustomerId(user.id);

    const where: Prisma.ProductOrderWhereInput = {
      customerId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { businessId: { contains: query.search, mode: 'insensitive' } },
              { trackingNumber: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            placedAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const totalItems = await this.prisma.productOrder.count({ where });
    const { skip, take, meta } = getPagination(
      query.page,
      query.limit,
      totalItems,
    );

    const sortBy = query.sortBy || 'placedAt';
    const sortOrder = query.sortOrder || 'desc';

    const items = await this.prisma.productOrder.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: this.orderInclude(),
    });

    return {
      items,
      meta,
    };
  }

  async getAdminOrders(query: OrderListQueryDto, user: RequestUser) {
    const where: Prisma.ProductOrderWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { businessId: { contains: query.search, mode: 'insensitive' } },
              { trackingNumber: { contains: query.search, mode: 'insensitive' } },
              {
                customer: {
                  displayName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                customer: {
                  email: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            placedAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const totalItems = await this.prisma.productOrder.count({ where });
    const { skip, take, meta } = getPagination(
      query.page,
      query.limit,
      totalItems,
    );

    const sortBy = query.sortBy || 'placedAt';
    const sortOrder = query.sortOrder || 'desc';

    const items = await this.prisma.productOrder.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: this.orderInclude(),
    });

    return {
      items,
      meta,
    };
  }

  async getOrderDetails(idOrBusinessId: string, user?: RequestUser | null) {
    const isUuid = this.isUuid(idOrBusinessId);

    const order = await this.prisma.productOrder.findFirst({
      where: isUuid ? { id: idOrBusinessId } : { businessId: idOrBusinessId },
      include: this.orderInclude(),
    });

    if (!order) {
      throw new NotFoundException(`Order '${idOrBusinessId}' not found`);
    }

    if (!this.isAdmin(user)) {
      if (!user || user.id !== order.customer.userId) {
        throw new ForbiddenException('You do not have permission to view this order');
      }
    }

    return order;
  }

  async cancelOrder(id: string, user: RequestUser) {
    const order = await this.getOrderDetails(id, user);

    if (
      order.status === ProductOrderStatus.CANCELLED ||
      order.status === ProductOrderStatus.DELIVERED ||
      order.status === ProductOrderStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Order cannot be cancelled because it is already '${order.status}'`,
      );
    }

    if (
      (order.status === ProductOrderStatus.SHIPPED ||
        order.status === ProductOrderStatus.OUT_FOR_DELIVERY) &&
      !this.isAdmin(user)
    ) {
      throw new BadRequestException(
        'Order is already in transit. Please request a Return once delivered.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Restore product inventory stock
      for (const item of order.items) {
        if (item.productId) {
          await this.productsService.restoreProductStock(
            item.productId,
            item.quantity,
            tx,
          );
        }
      }

      // 2. Update order status
      const updated = await tx.productOrder.update({
        where: { id: order.id },
        data: { status: ProductOrderStatus.CANCELLED },
        include: this.orderInclude(),
      });

      // 3. Write to Timeline
      await tx.productOrderStatusHistory.create({
        data: {
          orderId: order.id,
          status: ProductOrderStatus.CANCELLED,
          note: 'Order cancelled. Product inventory has been restored.',
          actorLabel: this.isAdmin(user)
            ? `Admin (${user.email})`
            : `Customer (${user.email})`,
        },
      });

      // 4. Void Invoice if still unpaid
      const invoice = order.invoices[0];
      if (invoice && invoice.status !== InvoiceStatus.PAID) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.VOID },
        });
      }

      return {
        success: true,
        message: 'Order cancelled successfully and inventory restored',
        order: updated,
      };
    });
  }

  /**
   * Unified Admin Status & Tracking Update (combines status, trackingNumber, carrier, and notes).
   */
  async updateOrderStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    user: RequestUser,
  ) {
    const order = await this.prisma.productOrder.findUnique({
      where: { id },
      include: { invoices: { include: { payments: true } } },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${id}' not found`);
    }

    const newStatus = dto.status || order.status;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productOrder.update({
        where: { id: order.id },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.trackingNumber !== undefined
            ? { trackingNumber: dto.trackingNumber?.trim() || null }
            : {}),
          ...(dto.shippingProvider !== undefined
            ? { shippingProvider: dto.shippingProvider?.trim() || null }
            : {}),
        },
        include: this.orderInclude(),
      });

      // Append to status timeline
      const timelineNote =
        dto.notes ||
        (dto.status
          ? `Order status updated to '${dto.status}'${
              dto.trackingNumber ? ` (Tracking: ${dto.trackingNumber})` : ''
            }`
          : `Shipment details updated: Tracking=${dto.trackingNumber || order.trackingNumber || 'N/A'}`);

      await tx.productOrderStatusHistory.create({
        data: {
          orderId: id,
          status: newStatus,
          note: timelineNote,
          actorLabel: `Admin (${user.email})`,
        },
      });

      // If status transitioned to DELIVERED / COMPLETED and it's COD with unpaid invoice: mark paid!
      if (
        (newStatus === ProductOrderStatus.DELIVERED ||
          newStatus === ProductOrderStatus.COMPLETED) &&
        order.invoices[0] &&
        order.invoices[0].status !== InvoiceStatus.PAID
      ) {
        const invoice = order.invoices[0];
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.PAID,
            paidAt: new Date(),
          },
        });

        const pendingPayment = invoice.payments.find(
          (p) => p.status === PaymentStatus.PENDING,
        );
        if (pendingPayment) {
          await tx.payment.update({
            where: { id: pendingPayment.id },
            data: {
              status: PaymentStatus.SUCCEEDED,
              processedAt: new Date(),
            },
          });
        }
      }

      return updated;
    });
  }
}
