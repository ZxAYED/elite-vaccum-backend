import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, ShipmentStatus, StoreOrderStatus } from '@prisma/client';
import { AuditLogService } from 'src/notifications/audit-log.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateShipmentDto } from '../dto/create-shipment.dto';
import { UpdateShipmentDto } from '../dto/update-shipment.dto';

type Actor = { id: string; role: string };

@Injectable()
export class StoreShipmentService {
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

  getShipment(id: string, actor?: Actor) {
    return (async () => {
      const order = await this.prisma.storeOrder.findUnique({
        where: { id },
        include: { shipment: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      this.ensureCanAccessOrder(actor, order.customerId);
      return order.shipment;
    })();
  }

  createShipment(id: string, dto: CreateShipmentDto, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) throw new ForbiddenException('Only admin/staff can create shipment');
      const order = await this.prisma.storeOrder.findUnique({
        where: { id },
        include: { shipment: true, customer: { select: { id: true, email: true } } },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.shipment) throw new NotFoundException('Shipment already exists');

      const shipment = await this.prisma.storeShipment.create({
        data: {
          storeOrderId: id,
          carrier: dto.carrier ?? 'UPS',
          trackingNumber: dto.trackingNumber,
          shipmentDate: dto.shipmentDate ? new Date(dto.shipmentDate) : undefined,
          deliveryEstimate: dto.deliveryEstimate ? new Date(dto.deliveryEstimate) : undefined,
          status: dto.status ?? ShipmentStatus.PENDING,
          notes: dto.notes,
        },
      });

      const shipmentToOrderStatus: ShipmentStatus[] = [
        ShipmentStatus.SHIPPED,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.DELIVERED,
      ];
      if (shipmentToOrderStatus.includes(shipment.status)) {
        await this.prisma.storeOrder.update({
          where: { id },
          data: {
            status:
              shipment.status === ShipmentStatus.DELIVERED
                ? StoreOrderStatus.DELIVERED
                : StoreOrderStatus.SHIPPED,
            ...(shipment.status === ShipmentStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
          },
        });
      }

      await this.auditLogService.log({
        actionType: 'STORE_SHIPMENT_CREATED',
        entityType: 'STORE_SHIPMENT',
        entityId: shipment.id,
        userId: actor?.id,
        metadata: { orderId: id, trackingNumber: shipment.trackingNumber },
      });
      await this.notificationsService.notify({
        userId: order.customer.id,
        email: order.customer.email,
        title: 'Shipment created',
        body: `Shipment created for order ${order.orderNumber}.`,
        referenceType: 'STORE_ORDER',
        referenceId: order.id,
        emailSubject: 'Order shipment update',
      });
      return shipment;
    })();
  }

  updateShipment(id: string, dto: UpdateShipmentDto, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) throw new ForbiddenException('Only admin/staff can update shipment');
      const order = await this.prisma.storeOrder.findUnique({
        where: { id },
        include: { shipment: true, customer: { select: { id: true, email: true } } },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (!order.shipment) throw new NotFoundException('Shipment not found');

      const shipment = await this.prisma.storeShipment.update({
        where: { storeOrderId: id },
        data: {
          ...(dto.carrier ? { carrier: dto.carrier } : {}),
          ...(dto.trackingNumber !== undefined ? { trackingNumber: dto.trackingNumber } : {}),
          ...(dto.shipmentDate ? { shipmentDate: new Date(dto.shipmentDate) } : {}),
          ...(dto.deliveryEstimate ? { deliveryEstimate: new Date(dto.deliveryEstimate) } : {}),
          ...(dto.deliveredAt ? { deliveredAt: new Date(dto.deliveredAt) } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });

      if (dto.status) {
        await this.prisma.storeOrder.update({
          where: { id },
          data: {
            ...(dto.status === ShipmentStatus.DELIVERED
              ? { status: StoreOrderStatus.DELIVERED, deliveredAt: new Date() }
              : dto.status === ShipmentStatus.SHIPPED || dto.status === ShipmentStatus.IN_TRANSIT
              ? { status: StoreOrderStatus.SHIPPED }
              : {}),
          },
        });
      }

      await this.auditLogService.log({
        actionType: 'STORE_SHIPMENT_UPDATED',
        entityType: 'STORE_SHIPMENT',
        entityId: shipment.id,
        userId: actor?.id,
        metadata: { orderId: id, status: shipment.status },
      });
      await this.notificationsService.notify({
        userId: order.customer.id,
        email: order.customer.email,
        title: 'Shipment updated',
        body: `Shipment updated for order ${order.orderNumber}.`,
        referenceType: 'STORE_ORDER',
        referenceId: order.id,
        emailSubject: 'Order shipment update',
      });
      return shipment;
    })();
  }
}
