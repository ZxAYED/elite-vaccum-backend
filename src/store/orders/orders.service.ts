import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus, Role, StoreOrderStatus, TaxMode } from '@prisma/client';
import { getPagination } from 'src/common/utils/pagination';
import { AuditLogService } from 'src/notifications/audit-log.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderListQueryDto } from '../dto/order-list-query.dto';
import { UpdateOrderNotesDto } from '../dto/update-order-notes.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';

type Actor = { id: string; role: string };

@Injectable()
export class StoreOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private isAdmin(actor?: Actor) {
    return actor?.role === Role.ADMIN || actor?.role === Role.STAFF;
  }

  private ensureCanAccessOrder(actor: Actor | undefined, customerId: string) {
    if (!actor) throw new ForbiddenException('Unauthorized');
    if (!this.isAdmin(actor) && actor.id !== customerId) {
      throw new ForbiddenException('You can only access your own orders');
    }
  }

  private async generateOrderNumber() {
    const prefix = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    for (let i = 0; i < 20; i++) {
      const suffix = Math.floor(100000 + Math.random() * 900000);
      const orderNumber = `${prefix}-${suffix}`;
      const found = await this.prisma.storeOrder.findUnique({
        where: { orderNumber },
        select: { id: true },
      });
      if (!found) return orderNumber;
    }
    throw new BadRequestException('Unable to generate order number');
  }

  createOrderFromCart(dto: CreateOrderDto, actor?: Actor) {
    return (async () => {
      if (!actor || actor.role !== Role.CUSTOMER) {
        throw new ForbiddenException('Only customer can place orders');
      }

      const cart = await this.prisma.cart.findUnique({
        where: { userId: actor.id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      const shippingAddress = await this.prisma.address.findFirst({
        where: { id: dto.shippingAddressId, userId: actor.id },
      });
      if (!shippingAddress) {
        throw new BadRequestException('Shipping address not found');
      }

      const billingAddress = dto.billingAddressId
        ? await this.prisma.address.findFirst({
            where: { id: dto.billingAddressId, userId: actor.id },
          })
        : null;

      if (dto.billingAddressId && !billingAddress) {
        throw new BadRequestException('Billing address not found');
      }

      for (const item of cart.items) {
        if (!item.product || !item.product.isActive || item.product.status !== ProductStatus.ACTIVE) {
          throw new BadRequestException(`Product unavailable: ${item.product?.name ?? item.productId}`);
        }
        if (item.quantity > item.product.stockQuantity) {
          throw new BadRequestException(
            `Insufficient stock for ${item.product.name}. Available: ${item.product.stockQuantity}`,
          );
        }
      }

      const subtotal = cart.items.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0,
      );
      const shippingAmount = cart.items.reduce(
        (sum, item) => sum + Number(item.product.shippingCost) * item.quantity,
        0,
      );
      const taxAmount = cart.items.reduce((sum, item) => {
        const line = Number(item.unitPrice) * item.quantity;
        const lineTax =
          item.product.taxable === TaxMode.TAXABLE
            ? (line * Number(item.product.taxRatePercent)) / 100
            : 0;
        return sum + lineTax;
      }, 0);
      const discountAmount = 0;
      const totalAmount = subtotal + shippingAmount + taxAmount - discountAmount;
      const orderNumber = await this.generateOrderNumber();

      const created = await this.prisma.$transaction(async (tx) => {
        const order = await tx.storeOrder.create({
          data: {
            orderNumber,
            customerId: actor.id,
            status: StoreOrderStatus.PENDING_PAYMENT,
            shippingAddressId: shippingAddress.id,
            shippingAddressSnapshot: {
              contactName: shippingAddress.contactName,
              phone: shippingAddress.phone,
              addressLine1: shippingAddress.addressLine1,
              addressLine2: shippingAddress.addressLine2,
              city: shippingAddress.city,
              state: shippingAddress.state,
              zipCode: shippingAddress.zipCode,
              country: shippingAddress.country,
              label: shippingAddress.label,
            },
            billingAddressSnapshot: billingAddress
              ? {
                  contactName: billingAddress.contactName,
                  phone: billingAddress.phone,
                  addressLine1: billingAddress.addressLine1,
                  addressLine2: billingAddress.addressLine2,
                  city: billingAddress.city,
                  state: billingAddress.state,
                  zipCode: billingAddress.zipCode,
                  country: billingAddress.country,
                  label: billingAddress.label,
                }
              : undefined,
            subtotalAmount: subtotal,
            shippingAmount,
            taxAmount,
            discountAmount,
            totalAmount,
            notes: dto.notes,
            items: {
              create: cart.items.map((item) => {
                const line = Number(item.unitPrice) * item.quantity;
                const lineTax =
                  item.product.taxable === TaxMode.TAXABLE
                    ? (line * Number(item.product.taxRatePercent)) / 100
                    : 0;
                const lineShipping = Number(item.product.shippingCost) * item.quantity;
                return {
                  productId: item.productId,
                  productName: item.product.name,
                  sku: item.product.sku,
                  model: item.product.model,
                  unitPrice: item.unitPrice,
                  quantity: item.quantity,
                  shippingAmount: lineShipping,
                  taxAmount: lineTax,
                  lineTotal: line + lineTax + lineShipping,
                };
              }),
            },
          },
          include: {
            items: true,
            customer: { select: { id: true, email: true, fullName: true } },
          },
        });

        for (const item of cart.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { decrement: item.quantity } },
          });
        }

        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        return order;
      });

      await this.auditLogService.log({
        actionType: 'STORE_ORDER_CREATED',
        entityType: 'STORE_ORDER',
        entityId: created.id,
        userId: actor.id,
        metadata: {
          orderNumber: created.orderNumber,
          totalAmount: created.totalAmount,
        },
      });

      await this.notificationsService.notify({
        userId: created.customer.id,
        email: created.customer.email,
        title: 'Order placed successfully',
        body: `Your order ${created.orderNumber} has been placed.`,
        referenceType: 'STORE_ORDER',
        referenceId: created.id,
        emailSubject: 'Order placed',
      });

      return {
        id: created.id,
        orderNumber: created.orderNumber,
        status: created.status,
        subtotalAmount: created.subtotalAmount,
        shippingAmount: created.shippingAmount,
        taxAmount: created.taxAmount,
        discountAmount: created.discountAmount,
        totalAmount: created.totalAmount,
        placedAt: created.placedAt,
        items: created.items,
      };
    })();
  }

  getMyOrders(query: OrderListQueryDto, actor?: Actor) {
    return (async () => {
      if (!actor || actor.role !== Role.CUSTOMER) {
        throw new ForbiddenException('Only customer can view own orders');
      }
      const where: Prisma.StoreOrderWhereInput = {
        customerId: actor.id,
        ...(query.status ? { status: query.status } : {}),
      };
      const totalItems = await this.prisma.storeOrder.count({ where });
      const pagination = getPagination(query.page, query.limit, totalItems);
      const data = await this.prisma.storeOrder.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { placedAt: 'desc' },
        include: {
          items: { select: { id: true, quantity: true, lineTotal: true } },
          shipment: true,
        },
      });
      return { data, meta: pagination.meta };
    })();
  }

  getOrderDetails(id: string, actor?: Actor) {
    return (async () => {
      const order = await this.prisma.storeOrder.findUnique({
        where: { id },
        include: {
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
          items: true,
          shipment: true,
          invoice: true,
          returnRequests: { orderBy: { requestedAt: 'desc' } },
        },
      });
      if (!order) throw new NotFoundException('Order not found');
      this.ensureCanAccessOrder(actor, order.customerId);
      return order;
    })();
  }

  cancelOrder(id: string, actor?: Actor) {
    return (async () => {
      const order = await this.prisma.storeOrder.findUnique({
        where: { id },
        include: { customer: { select: { id: true, email: true } }, items: true },
      });
      if (!order) throw new NotFoundException('Order not found');

      const admin = this.isAdmin(actor);
      if (!admin) {
        this.ensureCanAccessOrder(actor, order.customerId);
      }

      const cancellable: StoreOrderStatus[] = [
        StoreOrderStatus.PENDING_PAYMENT,
        StoreOrderStatus.PAID,
        StoreOrderStatus.PROCESSING,
      ];
      if (!cancellable.includes(order.status)) {
        throw new BadRequestException('Order cannot be cancelled at this stage');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.storeOrder.update({
          where: { id },
          data: { status: StoreOrderStatus.CANCELLED, cancelledAt: new Date() },
        });
        for (const item of order.items) {
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }
        }
      });

      await this.auditLogService.log({
        actionType: 'STORE_ORDER_CANCELLED',
        entityType: 'STORE_ORDER',
        entityId: order.id,
        userId: actor?.id,
      });
      await this.notificationsService.notify({
        userId: order.customer.id,
        email: order.customer.email,
        title: 'Order cancelled',
        body: `Order ${order.orderNumber} has been cancelled.`,
        referenceType: 'STORE_ORDER',
        referenceId: order.id,
      });
      return { message: 'Order cancelled successfully' };
    })();
  }

  getAdminOrders(query: OrderListQueryDto, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) {
        throw new ForbiddenException('Only admin/staff can view all orders');
      }
      const where: Prisma.StoreOrderWhereInput = {
        ...(query.status ? { status: query.status } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.orderNumber
          ? { orderNumber: { contains: query.orderNumber, mode: 'insensitive' } }
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
      const totalItems = await this.prisma.storeOrder.count({ where });
      const pagination = getPagination(query.page, query.limit, totalItems);
      const data = await this.prisma.storeOrder.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { placedAt: 'desc' },
        include: {
          customer: { select: { id: true, fullName: true, email: true } },
          shipment: true,
        },
      });
      return { data, meta: pagination.meta };
    })();
  }

  updateOrderStatus(id: string, dto: UpdateOrderStatusDto, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) {
        throw new ForbiddenException('Only admin/staff can update order status');
      }
      const order = await this.prisma.storeOrder.findUnique({ where: { id } });
      if (!order) throw new NotFoundException('Order not found');

      const map: Record<StoreOrderStatus, StoreOrderStatus[]> = {
        PENDING_PAYMENT: ['PAID', 'CANCELLED'],
        PAID: ['PROCESSING', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
        PROCESSING: ['SHIPPED', 'CANCELLED'],
        SHIPPED: ['DELIVERED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
        DELIVERED: ['REFUNDED', 'PARTIALLY_REFUNDED'],
        CANCELLED: [],
        REFUNDED: [],
        PARTIALLY_REFUNDED: ['REFUNDED'],
      } as Record<StoreOrderStatus, StoreOrderStatus[]>;
      if (order.status !== dto.status && !map[order.status].includes(dto.status)) {
        throw new BadRequestException(`Invalid status transition: ${order.status} -> ${dto.status}`);
      }

      const updated = await this.prisma.storeOrder.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === StoreOrderStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
        },
      });

      await this.auditLogService.log({
        actionType: 'STORE_ORDER_STATUS_UPDATED',
        entityType: 'STORE_ORDER',
        entityId: id,
        userId: actor?.id,
        metadata: { from: order.status, to: dto.status },
      });
      return updated;
    })();
  }

  updateOrderNotes(id: string, dto: UpdateOrderNotesDto, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) {
        throw new ForbiddenException('Only admin/staff can update order notes');
      }
      await this.getOrderDetails(id, actor);
      return this.prisma.storeOrder.update({
        where: { id },
        data: { notes: dto.notes },
      });
    })();
  }
}
