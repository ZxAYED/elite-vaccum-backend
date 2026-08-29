import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  ProductOrderStatus,
  UserRole,
} from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminReturnNoteDto } from '../dto/admin-return-note.dto';
import { CreateReturnRequestDto } from '../dto/create-return-request.dto';
import { StoreProductsService } from '../products/products.service';

@Injectable()
export class StoreReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: StoreProductsService,
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
   * Admin approves return & processes refund (automatically restores inventory).
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
        invoices: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === ProductOrderStatus.REFUNDED) {
      throw new BadRequestException('Order has already been refunded');
    }

    return this.prisma.$transaction(async (tx) => {
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
          note: `Return approved & refund processed: ${dto.adminNote || 'Returned items received at warehouse. Inventory restored.'}`,
          actorLabel: `Admin (${user.email})`,
        },
      });

      // 4. Update Invoice status if applicable
      const invoice = order.invoices[0];
      if (invoice) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            notes: `${invoice.notes ? invoice.notes + ' | ' : ''}Refunded on ${new Date().toISOString()}`,
          },
        });
      }

      return {
        success: true,
        message: 'Order status updated to REFUNDED and product stock inventory has been restored.',
        order: updated,
      };
    });
  }
}
