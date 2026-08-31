import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  NotificationType,
  PaymentStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { generateBusinessId } from 'src/common/utils/business-id.util';
import { getPagination } from 'src/common/utils/pagination';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis';
import Stripe from 'stripe';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import {
  InvoiceListQueryDto,
  RecordPaymentDto,
  RecordRefundDto,
  UpdateInvoiceDto,
} from './dto/update-invoice.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notificationsService: NotificationsService,
  ) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && stripeKey.trim().length > 0 && !stripeKey.includes('...')) {
      this.stripe = new Stripe(stripeKey);
      this.logger.log('Stripe initialized for billing');
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY is unconfigured. Service invoice payments will operate in preview/mock mode.',
      );
    }
  }

  private isAdmin(user?: RequestUser | null) {
    return user?.role === UserRole.ADMIN;
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

  private invoiceInclude() {
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
      lineItems: {
        orderBy: { sortOrder: 'asc' },
      },
      payments: {
        orderBy: { processedAt: 'desc' },
      },
      refunds: {
        orderBy: { processedAt: 'desc' },
      },
      productOrder: {
        select: {
          id: true,
          businessId: true,
          status: true,
          totalUsd: true,
        },
      },
      serviceOrder: {
        select: {
          id: true,
          businessId: true,
          status: true,
          summary: true,
        },
      },
    } satisfies Prisma.InvoiceInclude;
  }

  // ==========================================
  // CREATE INVOICE
  // ==========================================

  async create(dto: CreateInvoiceDto, user: RequestUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (!dto.lineItems || dto.lineItems.length === 0) {
      throw new BadRequestException('Invoice must contain at least one line item');
    }

    const businessId = await this.generateInvoiceBusinessId();

    const subtotal = dto.lineItems.reduce(
      (sum, item) => sum + item.unitPriceUsd * item.quantity,
      0,
    );
    const discount = dto.discountUsd || 0;
    const tax = dto.taxUsd || 0;
    const total = Math.max(0, subtotal - discount + tax);

    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const invoice = await this.prisma.invoice.create({
      data: {
        businessId,
        customerId: dto.customerId,
        serviceOrderId: dto.serviceOrderId || null,
        productOrderId: dto.productOrderId || null,
        status: dto.status || InvoiceStatus.ISSUED,
        dueDate,
        subtotalUsd: new Prisma.Decimal(subtotal),
        discountUsd: new Prisma.Decimal(discount),
        taxUsd: new Prisma.Decimal(tax),
        totalUsd: new Prisma.Decimal(total),
        notes: dto.notes?.trim() || null,
        lineItems: {
          create: dto.lineItems.map((item, idx) => ({
            description: item.description.trim(),
            quantity: item.quantity,
            unitPriceUsd: new Prisma.Decimal(item.unitPriceUsd),
            totalUsd: new Prisma.Decimal(item.unitPriceUsd * item.quantity),
            sortOrder: idx + 1,
          })),
        },
      },
      include: this.invoiceInclude(),
    });

    this.logger.log(`Invoice '${invoice.businessId}' created by Admin (${user.email})`);

    // Notify Customer
    if (invoice.customer?.userId) {
      this.notificationsService
        .create({
          userId: invoice.customer.userId,
          type: NotificationType.BILLING_INVOICE,
          title: `Invoice ${invoice.businessId} Generated`,
          message: `An invoice totaling $${Number(invoice.totalUsd).toFixed(2)} USD is ready for payment (Due: ${new Date(invoice.dueDate).toLocaleDateString()}).`,
          ctaLabel: 'Pay Invoice',
          ctaUrl: `/billing/invoices/${invoice.id}`,
          metadata: { invoiceId: invoice.id, totalUsd: invoice.totalUsd },
          sendEmail: true,
          priority: 1,
        })
        .catch((err) => {
          this.logger.warn(`Failed to notify customer of invoice: ${err.message}`);
        });
    }

    return {
      success: true,
      message: 'Invoice created successfully',
      invoice,
    };
  }

  // ==========================================
  // LIST INVOICES
  // ==========================================

  async findAll(query: InvoiceListQueryDto) {
    const where: Prisma.InvoiceWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.search
        ? {
            OR: [
              { businessId: { contains: query.search, mode: 'insensitive' } },
              { customer: { displayName: { contains: query.search, mode: 'insensitive' } } },
              { customer: { email: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const totalItems = await this.prisma.invoice.count({ where });
    const { skip, take, meta } = getPagination(query.page, query.limit, totalItems);

    const [
      items,
      issuedCount,
      paidCount,
      partiallyPaidCount,
      overdueCount,
      voidCount,
    ] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { issueDate: 'desc' },
        include: this.invoiceInclude(),
      }),
      this.prisma.invoice.count({ where: { status: InvoiceStatus.ISSUED } }),
      this.prisma.invoice.count({ where: { status: InvoiceStatus.PAID } }),
      this.prisma.invoice.count({ where: { status: InvoiceStatus.PARTIALLY_PAID } }),
      this.prisma.invoice.count({ where: { status: InvoiceStatus.OVERDUE } }),
      this.prisma.invoice.count({ where: { status: InvoiceStatus.VOID } }),
    ]);

    return {
      items,
      meta: {
        ...meta,
        kpi: {
          issued: issuedCount,
          paid: paidCount,
          partiallyPaid: partiallyPaidCount,
          overdue: overdueCount,
          void: voidCount,
          total: totalItems,
        },
      },
    };
  }

  async getMyInvoices(query: InvoiceListQueryDto, user: RequestUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!customer) {
      return { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
    }

    const where: Prisma.InvoiceWhereInput = {
      customerId: customer.id,
      status: { notIn: [InvoiceStatus.DRAFT] },
      ...(query.status ? { status: query.status } : {}),
    };

    const totalItems = await this.prisma.invoice.count({ where });
    const { skip, take, meta } = getPagination(query.page, query.limit, totalItems);

    const items = await this.prisma.invoice.findMany({
      where,
      skip,
      take,
      orderBy: { issueDate: 'desc' },
      include: this.invoiceInclude(),
    });

    return { items, meta };
  }

  async findOne(id: string, user?: RequestUser | null) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        OR: [{ id }, { businessId: id }],
      },
      include: this.invoiceInclude(),
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (!this.isAdmin(user)) {
      if (!user || user.id !== invoice.customer.userId) {
        throw new ForbiddenException('You do not have permission to view this invoice');
      }
    }

    return invoice;
  }

  // ==========================================
  // UPDATE INVOICE
  // ==========================================

  async update(id: string, dto: UpdateInvoiceDto, user: RequestUser) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true },
    });

    if (!existing) throw new NotFoundException('Invoice not found');

    if (existing.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot edit an already paid invoice');
    }

    return this.prisma.$transaction(async (tx) => {
      let subtotal = Number(existing.subtotalUsd);
      let discount = dto.discountUsd !== undefined ? dto.discountUsd : Number(existing.discountUsd);
      let tax = dto.taxUsd !== undefined ? dto.taxUsd : Number(existing.taxUsd);

      if (dto.lineItems && dto.lineItems.length > 0) {
        subtotal = dto.lineItems.reduce(
          (sum, item) => sum + item.unitPriceUsd * item.quantity,
          0,
        );

        await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceLineItem.createMany({
          data: dto.lineItems.map((item, idx) => ({
            invoiceId: id,
            description: item.description.trim(),
            quantity: item.quantity,
            unitPriceUsd: new Prisma.Decimal(item.unitPriceUsd),
            totalUsd: new Prisma.Decimal(item.unitPriceUsd * item.quantity),
            sortOrder: idx + 1,
          })),
        });
      }

      const total = Math.max(0, subtotal - discount + tax);

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          subtotalUsd: new Prisma.Decimal(subtotal),
          discountUsd: new Prisma.Decimal(discount),
          taxUsd: new Prisma.Decimal(tax),
          totalUsd: new Prisma.Decimal(total),
          status: dto.status || existing.status,
          notes: dto.notes !== undefined ? dto.notes?.trim() || null : existing.notes,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : existing.dueDate,
        },
        include: this.invoiceInclude(),
      });

      return {
        success: true,
        message: 'Invoice updated successfully',
        invoice: updated,
      };
    });
  }

  // ==========================================
  // PAYMENTS & REFUNDS
  // ==========================================

  async recordPayment(id: string, dto: RecordPaymentDto, user: RequestUser) {
    const lockKey = `billing:invoice:${id}`;
    const lockToken = await this.redis.acquireLock(lockKey, {
      ttlMs: 15000,
      retryCount: 1,
      retryDelayMs: 300,
    });

    if (!lockToken) {
      throw new BadRequestException(
        'A payment or billing transaction is currently being processed for this invoice. Please wait a moment.',
      );
    }

    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id },
        include: { payments: true, refunds: true },
      });

      if (!invoice) throw new NotFoundException('Invoice not found');

      return await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            invoiceId: id,
            customerId: invoice.customerId,
            amountUsd: new Prisma.Decimal(dto.amountUsd),
            methodLabel: dto.methodLabel.trim(),
            transactionReference: dto.transactionReference?.trim() || null,
            status: dto.status || PaymentStatus.SUCCEEDED,
          },
        });

        // Calculate net paid across all payments minus refunds
        const existingPaid = invoice.payments
          .filter((p) => p.status === PaymentStatus.SUCCEEDED)
          .reduce((sum, p) => sum + Number(p.amountUsd), 0);

        const existingRefunded = invoice.refunds
          .filter((r) => r.status === 'COMPLETED')
          .reduce((sum, r) => sum + Number(r.amountUsd), 0);

        const totalPaid = existingPaid + dto.amountUsd;
        const netPaid = Math.max(0, totalPaid - existingRefunded);
        const invoiceTotal = Number(invoice.totalUsd);

        const newStatus =
          netPaid >= invoiceTotal ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

        const updatedInvoice = await tx.invoice.update({
          where: { id },
          data: {
            status: newStatus,
            paidAt: newStatus === InvoiceStatus.PAID ? new Date() : invoice.paidAt,
          },
          include: this.invoiceInclude(),
        });

        // Notify Customer
        if (updatedInvoice.customer?.userId) {
          this.notificationsService
            .create({
              userId: updatedInvoice.customer.userId,
              type: NotificationType.BILLING_INVOICE,
              title: `Payment Receipt: ${updatedInvoice.businessId}`,
              message: `Payment of $${dto.amountUsd.toFixed(2)} USD was successfully received. Invoice status: ${newStatus}.`,
              ctaLabel: 'View Invoice',
              ctaUrl: `/billing/invoices/${updatedInvoice.id}`,
              metadata: { invoiceId: updatedInvoice.id, amountUsd: dto.amountUsd },
              sendEmail: true,
              priority: 1,
            })
            .catch((err) => {
              this.logger.warn(`Failed to notify customer of payment: ${err.message}`);
            });
        }

        return {
          success: true,
          message: `Payment of $${dto.amountUsd.toFixed(2)} recorded. Invoice marked ${newStatus}`,
          payment,
          invoice: updatedInvoice,
        };
      });
    } finally {
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  async recordRefund(id: string, dto: RecordRefundDto, user: RequestUser) {
    const lockKey = `billing:invoice:${id}`;
    const lockToken = await this.redis.acquireLock(lockKey, {
      ttlMs: 15000,
      retryCount: 0,
    });

    if (!lockToken) {
      throw new BadRequestException(
        'A billing or refund operation is currently being processed for this invoice.',
      );
    }

    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id },
        include: { payments: true, refunds: true },
      });

      if (!invoice) throw new NotFoundException('Invoice not found');

      const payment = await this.prisma.payment.findUnique({
        where: { id: dto.paymentId },
      });

      if (!payment || payment.invoiceId !== id) {
        throw new NotFoundException('Payment record not found for this invoice');
      }

      return await this.prisma.$transaction(async (tx) => {
        const refund = await tx.refund.create({
          data: {
            invoiceId: id,
            paymentId: dto.paymentId,
            amountUsd: new Prisma.Decimal(dto.amountUsd),
            status: 'COMPLETED',
            reason: dto.reason.trim(),
          },
        });

        const totalPaid = invoice.payments
          .filter((p) => p.status === PaymentStatus.SUCCEEDED)
          .reduce((sum, p) => sum + Number(p.amountUsd), 0);

        const totalRefunded =
          invoice.refunds
            .filter((r) => r.status === 'COMPLETED')
            .reduce((sum, r) => sum + Number(r.amountUsd), 0) + dto.amountUsd;

        const netPaid = Math.max(0, totalPaid - totalRefunded);
        const invoiceTotal = Number(invoice.totalUsd);

        let newStatus: InvoiceStatus;
        if (netPaid <= 0) {
          newStatus = InvoiceStatus.ISSUED;
        } else if (netPaid < invoiceTotal) {
          newStatus = InvoiceStatus.PARTIALLY_PAID;
        } else {
          newStatus = InvoiceStatus.PAID;
        }

        const updatedInvoice = await tx.invoice.update({
          where: { id },
          data: {
            status: newStatus,
            paidAt: newStatus === InvoiceStatus.PAID ? invoice.paidAt : null,
          },
          include: this.invoiceInclude(),
        });

        return {
          success: true,
          message: `Refund of $${dto.amountUsd.toFixed(2)} processed. Invoice status updated to ${newStatus}.`,
          refund,
          invoice: updatedInvoice,
        };
      });
    } finally {
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  async generateHtmlInvoice(id: string, user?: RequestUser | null) {
    const invoice = await this.findOne(id, user);

    const lineItemsHtml = invoice.lineItems
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.unitPriceUsd).toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.totalUsd).toFixed(2)}</td>
        </tr>`,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Invoice ${invoice.businessId}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 40px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #004488; padding-bottom: 20px; }
          .title { font-size: 28px; color: #004488; font-weight: bold; }
          .info-table { width: 100%; margin-top: 30px; border-collapse: collapse; }
          .items-table { width: 100%; margin-top: 30px; border-collapse: collapse; }
          .items-table th { background: #f8f9fa; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
          .totals { margin-top: 30px; width: 300px; margin-left: auto; }
          .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
          .grand-total { font-size: 18px; font-weight: bold; color: #004488; border-top: 2px solid #004488; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">Elite Central Vacuum</div>
            <div>123 Elite Plaza, Wellness Drive</div>
            <div>Greenwich, CT 06830</div>
            <div>support@elitecentralvac.com</div>
          </div>
          <div style="text-align: right;">
            <h2>INVOICE</h2>
            <div><strong>Invoice #:</strong> ${invoice.businessId}</div>
            <div><strong>Status:</strong> ${invoice.status}</div>
            <div><strong>Issue Date:</strong> ${new Date(invoice.issueDate).toLocaleDateString()}</div>
            <div><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</div>
          </div>
        </div>

        <div style="margin-top: 30px;">
          <strong>Billed To:</strong><br/>
          ${invoice.customer.displayName}<br/>
          ${invoice.customer.email}<br/>
          ${invoice.customer.phone || ''}
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span>Subtotal:</span>
            <span>$${Number(invoice.subtotalUsd).toFixed(2)}</span>
          </div>
          <div class="totals-row">
            <span>Discount:</span>
            <span>-$${Number(invoice.discountUsd).toFixed(2)}</span>
          </div>
          <div class="totals-row">
            <span>Tax:</span>
            <span>$${Number(invoice.taxUsd).toFixed(2)}</span>
          </div>
          <div class="totals-row grand-total">
            <span>Total USD:</span>
            <span>$${Number(invoice.totalUsd).toFixed(2)}</span>
          </div>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  // ==========================================
  // ONLINE STRIPE INVOICE PAYMENTS
  // ==========================================

  async createStripePaymentIntent(id: string, user: RequestUser) {
    const invoice = await this.findOne(id, user);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    const existingPaid = invoice.payments
      .filter((p) => p.status === PaymentStatus.SUCCEEDED)
      .reduce((sum, p) => sum + Number(p.amountUsd), 0);

    const existingRefunded = invoice.refunds
      .filter((r) => r.status === 'COMPLETED')
      .reduce((sum, r) => sum + Number(r.amountUsd), 0);

    const totalUsd = Number(invoice.totalUsd);
    const netPaid = Math.max(0, existingPaid - existingRefunded);
    const remainingBalance = Math.max(0, totalUsd - netPaid);

    if (remainingBalance <= 0) {
      throw new BadRequestException('Invoice has no outstanding balance');
    }

    const amountInCents = Math.round(remainingBalance * 100);

    if (this.stripe) {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        metadata: {
          invoiceId: invoice.id,
          businessId: invoice.businessId,
          customerId: invoice.customerId,
          customerEmail: invoice.customer.email,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amountUsd: remainingBalance,
        currency: 'usd',
        invoiceBusinessId: invoice.businessId,
      };
    }

    // Mock fallback when Stripe key is not provided in local dev
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        'Online payment processing is not configured for production.',
      );
    }

    return {
      success: true,
      mockMode: true,
      clientSecret: `pi_mock_secret_${Date.now()}`,
      paymentIntentId: `pi_mock_${Date.now()}`,
      amountUsd: remainingBalance,
      currency: 'usd',
      invoiceBusinessId: invoice.businessId,
      message: 'Stripe running in development preview mode. Pass STRIPE_SECRET_KEY in .env for live processing.',
    };
  }

  async confirmStripePayment(
    id: string,
    paymentIntentId: string,
    user: RequestUser,
  ) {
    const invoice = await this.findOne(id, user);

    let amountPaid = Number(invoice.totalUsd);
    let transactionReference = paymentIntentId;

    if (this.stripe) {
      if (paymentIntentId.startsWith('pi_mock_')) {
        throw new BadRequestException(
          'Mock payment confirmation is not allowed when Stripe is configured.',
        );
      }

      const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== 'succeeded') {
        throw new BadRequestException(
          `Stripe PaymentIntent is in '${intent.status}' state, not succeeded`,
        );
      }
      amountPaid = intent.amount_received / 100;
      transactionReference = intent.id;
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException(
          'Online payment processing is not configured for production.',
        );
      }
      if (!paymentIntentId.startsWith('pi_mock_')) {
        throw new BadRequestException('Invalid mock payment intent ID.');
      }
    }

    return this.recordPayment(
      id,
      {
        amountUsd: amountPaid,
        methodLabel: 'Stripe',
        transactionReference,
        status: PaymentStatus.SUCCEEDED,
      },
      user,
    );
  }
}

