import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  ProductOrderStatus,
  UserRole,
} from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis';
import { AdminReturnNoteDto } from '../dto/admin-return-note.dto';
import { CreateReturnRequestDto } from '../dto/create-return-request.dto';
import { StoreOrdersService } from '../orders/orders.service';
import { StoreProductsService } from '../products/products.service';

@Injectable()
export class StoreReturnsService {
  private readonly logger = new Logger(StoreReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: StoreProductsService,
    private readonly ordersService: StoreOrdersService,
    private readonly redis: RedisService,
  ) {}

  private isAdmin(user?: RequestUser | null) {
    return user?.role === UserRole.ADMIN;
  }

  private isUuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );
  }

  /**
   * Submit return request for a delivered order.
   */
  async createReturnRequest(
    orderId: string,
    dto: CreateReturnRequestDto,
    user?: RequestUser | null,
  ) {
    const isUuid = this.isUuid(orderId);

    const order = await this.prisma.productOrder.findFirst({
      where: isUuid ? { id: orderId } : { businessId: orderId },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!this.isAdmin(user) && (!user || user.id !== order.customer.userId)) {
      throw new ForbiddenException(
        'You do not have permission to request a return for this order',
      );
    }

    if (
      order.status !== ProductOrderStatus.DELIVERED &&
      order.status !== ProductOrderStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Returns can only be requested for orders that have been delivered (Current status: '${order.status}')`,
      );
    }

    const historyEntry = await this.prisma.productOrderStatusHistory.create({
      data: {
        orderId: order.id,
        status: order.status,
        note: `Return Requested: Reason=${dto.reason}, Note=${dto.customerNote || 'None'}`,
        actorLabel: `Customer (${user?.email || order.customer.email})`,
      },
    });

    return {
      success: true,
      message:
        'Return request submitted successfully. Our support team will review your request and contact you with return shipping instructions.',
      orderId: order.id,
      orderBusinessId: order.businessId,
      status: order.status,
      returnTimelineId: historyEntry.id,
      submittedAt: historyEntry.changedAt,
    };
  }

  /**
   * Get return timeline and order status.
   */
  async getReturnStatus(orderId: string, user?: RequestUser | null) {
    const isUuid = this.isUuid(orderId);

    const order = await this.prisma.productOrder.findFirst({
      where: isUuid ? { id: orderId } : { businessId: orderId },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                images: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!this.isAdmin(user) && (!user || user.id !== order.customer.userId)) {
      throw new ForbiddenException(
        'You do not have permission to view return details for this order',
      );
    }

    const returnLogs = order.statusHistory.filter((h) =>
      h.note?.toLowerCase().includes('return') || h.status === ProductOrderStatus.REFUNDED,
    );

    return {
      orderId: order.id,
      orderBusinessId: order.businessId,
      currentStatus: order.status,
      items: order.items,
      returnHistory: returnLogs,
    };
  }

  /**
   * Admin approves a return, refunds the customer through Stripe, and restores
   * inventory.
   *
   * The invoice is the proof of payment, so the money trail hangs off it:
   *   ProductOrder -> Invoice -> Payment (SUCCEEDED, holds the Stripe
   *   PaymentIntent) -> Refund (holds the Stripe refund id).
   *
   * The invoice itself stays PAID - payment genuinely happened - and the
   * reversal is recorded as a Refund attached to that invoice.
   */
  async processReturnRefund(
    orderId: string,
    dto: AdminReturnNoteDto,
    user: RequestUser,
  ) {
    const isUuid = this.isUuid(orderId);

    const order = await this.prisma.productOrder.findFirst({
      where: isUuid ? { id: orderId } : { businessId: orderId },
      include: {
        items: true,
        invoices: { include: { payments: true, refunds: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Only an order whose stock actually left the warehouse can be refunded.
    // PENDING / FAILED / CANCELLED / REFUNDED orders either never shipped or
    // have already had their inventory restored, so restoring again would
    // double-credit stock.
    const refundableStatuses: ProductOrderStatus[] = [
      ProductOrderStatus.PAID,
      ProductOrderStatus.PROCESSING,
      ProductOrderStatus.SHIPPED,
      ProductOrderStatus.OUT_FOR_DELIVERY,
      ProductOrderStatus.DELIVERED,
      ProductOrderStatus.COMPLETED,
    ];

    if (!refundableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order with status '${order.status}' cannot be refunded. Its inventory was never shipped or has already been restored.`,
      );
    }

    // Serialise refunds per order: two admins approving at the same moment must
    // not both hit Stripe or both restore stock.
    const lockKey = `refund:order:${order.id}`;
    const lockToken = await this.redis.acquireLock(lockKey, {
      ttlMs: 30000,
      retryCount: 1,
      retryDelayMs: 500,
    });

    if (!lockToken) {
      throw new ConflictException(
        'A refund is already being processed for this order. Please retry in a moment.',
      );
    }

    try {
      // The invoice is the proof of payment; without one there is nothing to
      // refund against.
      const invoice = order.invoices[0];
      if (!invoice) {
        throw new BadRequestException(
          'This order has no invoice, so there is no recorded payment to refund.',
        );
      }

      if (invoice.refunds.length > 0) {
        throw new BadRequestException(
          `Order '${order.businessId}' has already been refunded (refund '${invoice.refunds[0].id}').`,
        );
      }

      const payment =
        invoice.payments.find((p) => p.status === PaymentStatus.SUCCEEDED) ||
        invoice.payments[0];

      if (!payment) {
        throw new BadRequestException(
          'No payment is recorded against this order, so there is nothing to refund.',
        );
      }

      // Talk to Stripe BEFORE opening the database transaction. An external HTTP
      // call inside a transaction holds row locks for the whole round trip, and
      // a rollback cannot claw the money back anyway.
      let stripeRefund: {
        id: string;
        status: string;
        amountUsd: number;
      } | null = null;

      if (payment.status === PaymentStatus.SUCCEEDED) {
        stripeRefund = await this.ordersService.refundStripePayment({
          transactionReference: payment.transactionReference,
          amountUsd: Number(payment.amountUsd),
          orderBusinessId: order.businessId,
          reason: dto.adminNote,
        });
      }

      const refundedAmount = stripeRefund
        ? new Prisma.Decimal(stripeRefund.amountUsd)
        : payment.amountUsd;

      // Card refunds come back 'succeeded' immediately; some settle
      // asynchronously and come back 'pending'. A COD order never went through
      // Stripe at all, so the cash has to be handed back offline.
      const refundStatus = !stripeRefund
        ? 'MANUAL_REQUIRED'
        : stripeRefund.status === 'succeeded'
          ? 'COMPLETED'
          : stripeRefund.status.toUpperCase();

      try {
        return await this.prisma.$transaction(async (tx) => {
          // 1. Restore returned products inventory back to stock
          for (const item of order.items) {
            if (item.productId) {
              await this.productsService.restoreProductStock(
                item.productId,
                item.quantity,
                tx,
              );
            }
          }

          // 2. Update order status to REFUNDED
          const updated = await tx.productOrder.update({
            where: { id: order.id },
            data: { status: ProductOrderStatus.REFUNDED },
          });

          // 3. Write to Status History
          await tx.productOrderStatusHistory.create({
            data: {
              orderId: order.id,
              status: ProductOrderStatus.REFUNDED,
              note: stripeRefund
                ? `Return approved. Stripe refund '${stripeRefund.id}' of $${stripeRefund.amountUsd.toFixed(2)} issued. ${dto.adminNote || 'Inventory restored.'}`
                : `Return approved. ${Number(refundedAmount).toFixed(2)} must be returned to the customer offline. ${dto.adminNote || 'Inventory restored.'}`,
              actorLabel: `Admin (${user.email})`,
            },
          });

          // 4. The invoice stays PAID - payment genuinely happened, and it
          // remains the proof of it. The reversal is recorded as a Refund
          // attached to that invoice.
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              notes: `${invoice.notes ? invoice.notes + ' | ' : ''}Refunded ${new Date().toISOString()}${stripeRefund ? ` (Stripe ${stripeRefund.id})` : ' (offline refund pending)'}`,
            },
          });

          // 5. Reverse the payment
          if (payment.status === PaymentStatus.SUCCEEDED) {
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: PaymentStatus.REFUNDED },
            });
          }

          // 6. Record the refund against the invoice and the payment it reverses
          const refund = await tx.refund.create({
            data: {
              paymentId: payment.id,
              invoiceId: invoice.id,
              amountUsd: refundedAmount,
              status: refundStatus,
              reason:
                dto.adminNote ||
                'Return approved by admin. Items received at warehouse.',
              transactionReference: stripeRefund?.id || null,
            },
          });

          return {
            success: true,
            message: stripeRefund
              ? `Refund of $${Number(refundedAmount).toFixed(2)} issued to the customer's card. Inventory restored.`
              : `Order marked REFUNDED and inventory restored. $${Number(refundedAmount).toFixed(2)} must be returned to the customer offline.`,
            order: updated,
            refund: {
              id: refund.id,
              invoiceId: invoice.id,
              invoiceBusinessId: invoice.businessId,
              paymentId: payment.id,
              amountUsd: Number(refundedAmount).toFixed(2),
              status: refund.status,
              stripeRefundId: stripeRefund?.id || null,
              requiresManualPayout: !stripeRefund,
              processedAt: refund.processedAt,
            },
          };
        });
      } catch (dbErr: any) {
        if (stripeRefund) {
          this.logger.error(
            `CRITICAL: Stripe refund '${stripeRefund.id}' for order '${order.businessId}' succeeded, but persisting it failed: ${dbErr.message}. The customer HAS been refunded - reconcile this order manually.`,
            dbErr.stack,
          );
        }
        throw dbErr;
      }
    } finally {
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }
}
