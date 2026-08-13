import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReturnRequestStatus, Role } from '@prisma/client';
import { AuditLogService } from 'src/notifications/audit-log.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminReturnNoteDto } from '../dto/admin-return-note.dto';
import { CreateReturnRequestDto } from '../dto/create-return-request.dto';

type Actor = { id: string; role: string };

@Injectable()
export class StoreReturnsService {
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

  createReturnRequest(orderId: string, dto: CreateReturnRequestDto, actor?: Actor) {
    return (async () => {
      if (!actor || actor.role !== Role.CUSTOMER) {
        throw new ForbiddenException('Only customer can create return requests');
      }
      const order = await this.prisma.storeOrder.findUnique({
        where: { id: orderId },
        include: { customer: { select: { id: true, email: true } }, items: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      this.ensureCanAccessOrder(actor, order.customerId);

      if (dto.storeOrderItemId) {
        const hasItem = order.items.some((item) => item.id === dto.storeOrderItemId);
        if (!hasItem) throw new BadRequestException('Order item does not belong to this order');
      }

      const created = await this.prisma.storeReturnRequest.create({
        data: {
          storeOrderId: orderId,
          storeOrderItemId: dto.storeOrderItemId,
          reason: dto.reason,
          customerNote: dto.customerNote,
          status: ReturnRequestStatus.REQUESTED,
        },
      });

      await this.auditLogService.log({
        actionType: 'STORE_RETURN_REQUEST_CREATED',
        entityType: 'STORE_RETURN_REQUEST',
        entityId: created.id,
        userId: actor.id,
        metadata: { orderId },
      });
      return created;
    })();
  }

  listReturnRequests(orderId: string, actor?: Actor) {
    return (async () => {
      const order = await this.prisma.storeOrder.findUnique({
        where: { id: orderId },
        select: { id: true, customerId: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      this.ensureCanAccessOrder(actor, order.customerId);
      return this.prisma.storeReturnRequest.findMany({
        where: { storeOrderId: orderId },
        orderBy: { requestedAt: 'desc' },
      });
    })();
  }

  approveReturnRequest(id: string, dto: AdminReturnNoteDto, actor?: Actor) {
    return this.updateReturnStatus(id, ReturnRequestStatus.APPROVED, actor, dto);
  }

  rejectReturnRequest(id: string, dto: AdminReturnNoteDto, actor?: Actor) {
    return this.updateReturnStatus(id, ReturnRequestStatus.REJECTED, actor, dto);
  }

  receiveReturnRequest(id: string, dto: AdminReturnNoteDto, actor?: Actor) {
    return this.updateReturnStatus(id, ReturnRequestStatus.RECEIVED, actor, dto);
  }

  refundReturnRequest(id: string, dto: AdminReturnNoteDto, actor?: Actor) {
    return this.updateReturnStatus(id, ReturnRequestStatus.REFUNDED, actor, dto);
  }

  private async updateReturnStatus(
    id: string,
    status: ReturnRequestStatus,
    actor?: Actor,
    dto?: AdminReturnNoteDto,
  ) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Only admin/staff can update return requests');
    const existing = await this.prisma.storeReturnRequest.findUnique({
      where: { id },
      include: {
        storeOrder: { include: { customer: { select: { id: true, email: true } } } },
      },
    });
    if (!existing) throw new NotFoundException('Return request not found');

    const updated = await this.prisma.storeReturnRequest.update({
      where: { id },
      data: {
        status,
        ...(dto?.adminNote !== undefined ? { adminNote: dto.adminNote } : {}),
        ...(status === ReturnRequestStatus.APPROVED ? { approvedAt: new Date() } : {}),
        ...(status === ReturnRequestStatus.REJECTED ? { rejectedAt: new Date() } : {}),
        ...(status === ReturnRequestStatus.REFUNDED ? { refundedAt: new Date() } : {}),
      },
    });

    await this.auditLogService.log({
      actionType: 'STORE_RETURN_REQUEST_UPDATED',
      entityType: 'STORE_RETURN_REQUEST',
      entityId: id,
      userId: actor?.id,
      metadata: { from: existing.status, to: status },
    });
    await this.notificationsService.notify({
      userId: existing.storeOrder.customer.id,
      email: existing.storeOrder.customer.email,
      title: 'Return request updated',
      body: `Your return request status is now ${status}.`,
      referenceType: 'STORE_RETURN_REQUEST',
      referenceId: id,
    });
    return updated;
  }
}
