import {
  BadRequestException,
  ConflictException,
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

  private isUuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );
  }

  /**
   * Resolves an invoice UUID from either form of id. Every endpoint documents
   * "UUID or INV-XXXXX", but querying the uuid column with a business id makes
   * Postgres raise a cast error (500) instead of a clean 404.
   */
  private async resolveInvoiceId(idOrBusinessId: string): Promise<string> {
    const found = await this.prisma.invoice.findFirst({
      where: this.isUuid(idOrBusinessId)
        ? { id: idOrBusinessId }
        : { businessId: idOrBusinessId },
      select: { id: true },
    });

    if (!found) throw new NotFoundException('Invoice not found');
    return found.id;
  }

  /**
   * A store product order is paid through its own Stripe Checkout session
   * (POST /store/orders -> checkoutUrl). Billing must not expose a second,
   * independent payment rail against the same invoice: the customer would be
   * able to pay for one order twice, on two Stripe objects the other rail
   * knows nothing about.
   */
  private assertNotStoreOrderInvoice(invoice: {
    productOrderId: string | null;
    businessId: string;
  }) {
    if (invoice.productOrderId) {
      throw new BadRequestException(
        `Invoice '${invoice.businessId}' belongs to a store order and is paid through the store checkout, not through billing. Use GET /store/orders/checkout/session/:orderId to get its payment link.`,
      );
    }
  }

  /** Escapes text interpolated into the printable HTML invoice. */
  private escapeHtml(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  private async invalidateFinancialCaches() {
    try {
      await this.redis.deleteByPattern('reports:*');
      await this.redis.del('dashboard:admin:v1');
    } catch (err: any) {
      this.logger.warn(`Financial cache invalidation error: ${err.message}`);
    }
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


  // CREATE INVOICE


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
    const initialStatus = dto.status || InvoiceStatus.ISSUED;

    const invoice = await this.prisma.invoice.create({
      data: {
        businessId,
        customerId: dto.customerId,
        serviceOrderId: dto.serviceOrderId || null,
        productOrderId: dto.productOrderId || null,
        status: initialStatus,
        paidAt: initialStatus === InvoiceStatus.PAID ? new Date() : null,
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

    await this.invalidateFinancialCaches();

    return {
      success: true,
      message: 'Invoice created successfully',
      invoice,
    };
  }


  // LIST INVOICES


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
      // Same meta shape as the populated path, so clients never branch on it.
      const { meta } = getPagination(query.page, query.limit, 0);
      return { items: [], meta };
    }

    // DRAFT invoices are pro-forma (an unpaid card order, an admin draft) and
    // must stay hidden. Spreading query.status after the notIn used to
    // OVERWRITE it, letting ?status=DRAFT expose them.
    const where: Prisma.InvoiceWhereInput = {
      customerId: customer.id,
      ...(query.status && query.status !== InvoiceStatus.DRAFT
        ? { status: query.status }
        : { status: { notIn: [InvoiceStatus.DRAFT] } }),
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
      where: this.isUuid(id) ? { id } : { businessId: id },
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


  // UPDATE INVOICE


  async update(idOrBusinessId: string, dto: UpdateInvoiceDto, user: RequestUser) {
    const id = await this.resolveInvoiceId(idOrBusinessId);

    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true },
    });

    if (!existing) throw new NotFoundException('Invoice not found');

    if (existing.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot edit an already paid invoice');
    }

    const result = await this.prisma.$transaction(async (tx) => {
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
      const nextStatus = dto.status || existing.status;
      const nextPaidAt =
        nextStatus === InvoiceStatus.PAID
          ? existing.paidAt || new Date()
          : dto.status
            ? null
            : existing.paidAt;

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          subtotalUsd: new Prisma.Decimal(subtotal),
          discountUsd: new Prisma.Decimal(discount),
          taxUsd: new Prisma.Decimal(tax),
          totalUsd: new Prisma.Decimal(total),
          status: nextStatus,
          paidAt: nextPaidAt,
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

    await this.invalidateFinancialCaches();

    return result;
  }


  // PAYMENTS & REFUNDS


  async recordPayment(
    idOrBusinessId: string,
    dto: RecordPaymentDto,
    user: RequestUser,
  ) {
    const id = await this.resolveInvoiceId(idOrBusinessId);
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

      if (invoice.status === InvoiceStatus.VOID) {
        throw new BadRequestException(
          `Invoice '${invoice.businessId}' is VOID and cannot accept payments.`,
        );
      }

      // A store order already has a live Stripe Checkout rail. Recording a
      // second CARD payment here would double-charge; offline settlement
      // (cash / check for a COD order) stays legitimate.
      if (invoice.productOrderId) {
        const method = dto.methodLabel.trim().toLowerCase();
        if (method.includes('stripe') || method.includes('card')) {
          throw new BadRequestException(
            `Invoice '${invoice.businessId}' belongs to a store order. Card payments must go through the store checkout, not billing. Record only offline settlement (Cash, Check) here.`,
          );
        }
      }

      const reference = dto.transactionReference?.trim() || null;

      // transactionReference is unique; a replayed webhook or double-clicked
      // form would otherwise blow up with a raw constraint violation.
      if (reference) {
        const duplicate = await this.prisma.payment.findUnique({
          where: { transactionReference: reference },
          select: { id: true, invoiceId: true },
        });
        if (duplicate) {
          throw new ConflictException(
            `A payment with reference '${reference}' has already been recorded.`,
          );
        }
      }

      const existingPaid = invoice.payments
        .filter((p) => p.status === PaymentStatus.SUCCEEDED)
        .reduce((sum, p) => sum + Number(p.amountUsd), 0);

      const existingRefunded = invoice.refunds
        .filter((r) => r.status === 'COMPLETED')
        .reduce((sum, r) => sum + Number(r.amountUsd), 0);

      const outstanding = Math.max(
        0,
        Number(invoice.totalUsd) - Math.max(0, existingPaid - existingRefunded),
      );

      // Tolerance of half a cent absorbs float noise without allowing a real
      // overpayment through.
      if (dto.amountUsd > outstanding + 0.005) {
        throw new BadRequestException(
          `Payment of $${dto.amountUsd.toFixed(2)} exceeds the outstanding balance of $${outstanding.toFixed(2)} on invoice '${invoice.businessId}'.`,
        );
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            invoiceId: id,
            customerId: invoice.customerId,
            amountUsd: new Prisma.Decimal(dto.amountUsd),
            methodLabel: dto.methodLabel.trim(),
            transactionReference: reference,
            status: dto.status || PaymentStatus.SUCCEEDED,
          },
        });

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

      await this.invalidateFinancialCaches();

      return result;
    } finally {
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  async recordRefund(
    idOrBusinessId: string,
    dto: RecordRefundDto,
    user: RequestUser,
  ) {
    const id = await this.resolveInvoiceId(idOrBusinessId);
    const lockKey = `billing:invoice:${id}`;
    const lockToken = await this.redis.acquireLock(lockKey, {
      ttlMs: 30000,
      retryCount: 1,
      retryDelayMs: 500,
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

      if (
        payment.status !== PaymentStatus.SUCCEEDED &&
        payment.status !== PaymentStatus.PARTIALLY_REFUNDED
      ) {
        throw new BadRequestException(
          `Payment is '${payment.status}'. Only a settled payment can be refunded.`,
        );
      }

      // Never refund more than this payment actually took.
      const alreadyRefunded = invoice.refunds
        .filter((r) => r.paymentId === dto.paymentId && r.status === 'COMPLETED')
        .reduce((sum, r) => sum + Number(r.amountUsd), 0);

      const refundable = Number(payment.amountUsd) - alreadyRefunded;

      if (dto.amountUsd > refundable + 0.005) {
        throw new BadRequestException(
          `Refund of $${dto.amountUsd.toFixed(2)} exceeds the $${refundable.toFixed(2)} still refundable on this payment.`,
        );
      }

      // Move the money before writing the ledger. An external call inside the
      // transaction would hold row locks for the whole round trip, and a
      // rollback cannot claw a Stripe refund back anyway.
      const stripeRefund = await this.issueStripeRefund(
        payment.transactionReference,
        dto.amountUsd,
        invoice.businessId,
        dto.reason,
      );

      const refundedAfter = alreadyRefunded + dto.amountUsd;

      const result = await this.prisma.$transaction(async (tx) => {
        const refund = await tx.refund.create({
          data: {
            invoiceId: id,
            paymentId: dto.paymentId,
            amountUsd: new Prisma.Decimal(dto.amountUsd),
            status: stripeRefund ? 'COMPLETED' : 'MANUAL_REQUIRED',
            reason: dto.reason.trim(),
            transactionReference: stripeRefund?.id || null,
          },
        });

        // Reverse the payment itself so the ledger does not still read SUCCEEDED
        await tx.payment.update({
          where: { id: dto.paymentId },
          data: {
            status:
              refundedAfter >= Number(payment.amountUsd) - 0.005
                ? PaymentStatus.REFUNDED
                : PaymentStatus.PARTIALLY_REFUNDED,
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
          message: stripeRefund
            ? `Refund of $${dto.amountUsd.toFixed(2)} issued to the customer's card. Invoice status updated to ${newStatus}.`
            : `Refund of $${dto.amountUsd.toFixed(2)} recorded. Invoice status updated to ${newStatus}. The money must be returned to the customer offline.`,
          refund,
          stripeRefundId: stripeRefund?.id || null,
          requiresManualPayout: !stripeRefund,
          invoice: updatedInvoice,
        };
      });

      await this.invalidateFinancialCaches();

      return result;
    } finally {
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  /**
   * Issues a Stripe refund when the payment settled through Stripe.
   *
   * Refunds are created against a PaymentIntent (pi_...) or Charge (ch_...).
   * Returns null for cash, check, or any other offline payment so the caller
   * records a manual refund instead of failing the whole operation.
   */
  private async issueStripeRefund(
    transactionReference: string | null,
    amountUsd: number,
    invoiceBusinessId: string,
    reason: string,
  ): Promise<{ id: string; status: string } | null> {
    const reference = transactionReference?.trim();

    if (
      !reference ||
      !(reference.startsWith('pi_') || reference.startsWith('ch_'))
    ) {
      this.logger.warn(
        `Invoice '${invoiceBusinessId}' payment reference '${reference || 'none'}' is not a Stripe charge. The refund must be returned offline.`,
      );
      return null;
    }

    if (!this.stripe) {
      throw new BadRequestException(
        'Stripe is not configured on this server, so the card refund cannot be issued.',
      );
    }

    const refund = await this.stripe.refunds.create(
      {
        ...(reference.startsWith('pi_')
          ? { payment_intent: reference }
          : { charge: reference }),
        amount: Math.round(amountUsd * 100),
        reason: 'requested_by_customer',
        metadata: { invoiceBusinessId, note: reason.slice(0, 400) },
      },
      {
        idempotencyKey: `refund:invoice:${invoiceBusinessId}:${Math.round(amountUsd * 100)}`,
      },
    );

    this.logger.log(
      `Stripe refund '${refund.id}' (${refund.status}) issued for invoice '${invoiceBusinessId}'.`,
    );

    return { id: refund.id, status: refund.status || 'unknown' };
  }

  async generateHtmlInvoice(id: string, user?: RequestUser | null) {
    const invoice = await this.findOne(id, user);

    const esc = (v: unknown) => this.escapeHtml(v);

    const lineItemsHtml = invoice.lineItems
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${esc(item.description)}</td>
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
        <title>Invoice ${esc(invoice.businessId)}</title>
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
            <div><strong>Invoice #:</strong> ${esc(invoice.businessId)}</div>
            <div><strong>Status:</strong> ${esc(invoice.status)}</div>
            <div><strong>Issue Date:</strong> ${new Date(invoice.issueDate).toLocaleDateString()}</div>
            <div><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</div>
          </div>
        </div>

        <div style="margin-top: 30px;">
          <strong>Billed To:</strong><br/>
          ${esc(invoice.customer.displayName)}<br/>
          ${esc(invoice.customer.email)}<br/>
          ${esc(invoice.customer.phone || '')}
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


  // ONLINE STRIPE INVOICE PAYMENTS


  async createStripePaymentIntent(id: string, user: RequestUser) {
    const invoice = await this.findOne(id, user);

    // Store orders are paid through their own Checkout session. Opening a
    // PaymentIntent here would be a second way to pay the same order.
    this.assertNotStoreOrderInvoice(invoice);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    if (invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Invoice is VOID and cannot be paid');
    }

    if (invoice.status === InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        'Invoice is still a draft and has not been issued for payment yet.',
      );
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
    if (!paymentIntentId?.trim()) {
      throw new BadRequestException('paymentIntentId is required');
    }

    const invoice = await this.findOne(id, user);

    this.assertNotStoreOrderInvoice(invoice);

    // Idempotent: a retried confirm (double click, refreshed return page) must
    // report the existing payment rather than recording a second one or
    // blowing up on the unique transactionReference constraint.
    const already = invoice.payments.find(
      (p) => p.transactionReference === paymentIntentId.trim(),
    );
    if (already) {
      return {
        success: true,
        message: 'Payment was already recorded for this PaymentIntent.',
        payment: already,
        invoice,
      };
    }

    let amountPaid = Number(invoice.totalUsd);
    let transactionReference = paymentIntentId.trim();

    if (this.stripe) {
      if (paymentIntentId.startsWith('pi_mock_')) {
        throw new BadRequestException(
          'Mock payment confirmation is not allowed when Stripe is configured.',
        );
      }

      const intent = await this.stripe.paymentIntents.retrieve(
        transactionReference,
      );
      if (intent.status !== 'succeeded') {
        throw new BadRequestException(
          `Stripe PaymentIntent is in '${intent.status}' state, not succeeded`,
        );
      }

      // The intent must be the one created for THIS invoice. Without this a
      // caller could settle a $500 invoice by quoting the PaymentIntent of a
      // $5 one they genuinely paid.
      if (intent.metadata?.invoiceId !== invoice.id) {
        throw new BadRequestException(
          'This PaymentIntent was not created for this invoice.',
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

