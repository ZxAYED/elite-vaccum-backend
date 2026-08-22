import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateServiceQuotationDto } from './dto/create-service-quotation.dto';
import { QuotationStatus, Role, ServiceRequestStatus } from '@prisma/client';
import { NotificationsService } from 'src/notifications/notifications.service';
import { AuditLogService } from 'src/notifications/audit-log.service';

type Actor = { id: string; role: string };

@Injectable()
export class ServiceQuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private isAdmin(actor?: Actor) {
    return actor?.role === Role.ADMIN || actor?.role === Role.STAFF;
  }

  private expireAt(quotation: { sentAt: Date | null; validForHours: number }) {
    if (!quotation.sentAt) return null;
    return new Date(
      quotation.sentAt.getTime() + quotation.validForHours * 60 * 60 * 1000,
    );
  }

  private async autoExpireIfNeeded(quotationId: string) {
    const q = await this.prisma.serviceQuotation.findUnique({
      where: { id: quotationId },
      select: { id: true, status: true, sentAt: true, validForHours: true },
    });
    if (!q) return;
    const expirableStatuses: QuotationStatus[] = [
      QuotationStatus.SENT,
      QuotationStatus.VIEWED,
    ];
    if (!expirableStatuses.includes(q.status)) return;
    const expiresAt = this.expireAt(q);
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      await this.prisma.serviceQuotation.update({
        where: { id: quotationId },
        data: { status: QuotationStatus.EXPIRED },
      });
    }
  }

  async create(dto: CreateServiceQuotationDto, actor?: Actor) {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException('Only admin can create quotations');
    }

    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: dto.serviceRequestId },
      include: {
        customer: { select: { id: true, email: true, fullName: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    const existingQuotation = await this.prisma.serviceQuotation.findFirst({
      where: { serviceRequestId: dto.serviceRequestId },
      select: { id: true, status: true, sentAt: true, validForHours: true },
    });

    if (existingQuotation) {
      await this.autoExpireIfNeeded(existingQuotation.id);
      const refreshed = await this.prisma.serviceQuotation.findUnique({
        where: { id: existingQuotation.id },
        select: { status: true },
      });
      if (refreshed?.status === QuotationStatus.EXPIRED) {
        throw new BadRequestException(
          'Quotation already expired for this request. Customer must create a new service request to reorder.',
        );
      }
      throw new BadRequestException(
        'Only one quotation is allowed per service request. Update the existing quotation status instead.',
      );
    }

    const subtotal = dto.amount;
    const tax = dto.taxAmount ?? 0;
    const discount = dto.discountAmount ?? 0;
    const finalAmount = subtotal + tax - discount;

    const quotation = await this.prisma.serviceQuotation.create({
      data: {
        serviceRequestId: dto.serviceRequestId,
        version: 1,
        status: QuotationStatus.SENT,
        subtotalAmount: subtotal,
        taxAmount: tax,
        discountAmount: discount,
        finalAmount,
        termsAndNotes: dto.notes,
        validForHours: dto.validityPeriodInHours ?? 24,
        sentAt: new Date(),
        createdById: actor?.id,
        updatedById: actor?.id,
      },
    });

    await this.prisma.serviceRequest.update({
      where: { id: request.id },
      data: {
        status: ServiceRequestStatus.QUOTED,
        latestQuotedAmount: finalAmount,
      },
    });

    await this.auditLogService.log({
      actionType: 'CREATE_QUOTATION',
      entityType: 'SERVICE_QUOTATION',
      entityId: quotation.id,
      userId: actor?.id,
      metadata: {
        serviceRequestId: request.id,
        finalAmount,
        version: 1,
      },
    });

    await this.notificationsService.notify({
      userId: request.customer.id,
      email: request.customer.email,
      title: 'New quotation available',
      body: `A new quotation has been sent for request ${request.requestNumber}.`,
      referenceType: 'SERVICE_QUOTATION',
      referenceId: quotation.id,
      emailSubject: 'Service quotation available',
    });

    return quotation;
  }

  async acceptQuotation(id: string, actor?: Actor) {
    if (!actor || actor.role !== Role.CUSTOMER) {
      throw new ForbiddenException('Only customer can accept quotations');
    }

    await this.autoExpireIfNeeded(id);

    const quotation = await this.prisma.serviceQuotation.findUnique({
      where: { id },
      include: {
        serviceRequest: {
          include: {
            customer: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (quotation.serviceRequest.customerId !== actor.id) {
      throw new ForbiddenException('You can only accept your own quotation');
    }

    const acceptableStatuses: QuotationStatus[] = [
      QuotationStatus.SENT,
      QuotationStatus.VIEWED,
    ];

    if (!acceptableStatuses.includes(quotation.status)) {
      throw new BadRequestException('Quotation cannot be accepted');
    }

    const expiresAt = this.expireAt(quotation);
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      await this.prisma.serviceQuotation.update({
        where: { id },
        data: { status: QuotationStatus.EXPIRED },
      });
      await this.prisma.serviceRequest.update({
        where: { id: quotation.serviceRequestId },
        data: {
          status: ServiceRequestStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });
      throw new BadRequestException(
        'Quotation expired and can no longer be accepted. Please create a new service request to reorder.',
      );
    }

    const updated = await this.prisma.serviceQuotation.update({
      where: { id },
      data: {
        status: QuotationStatus.ACCEPTED,
        acceptedAt: new Date(),
        respondedAt: new Date(),
      },
    });

    await this.prisma.serviceRequest.update({
      where: { id: quotation.serviceRequestId },
      data: {
        status: ServiceRequestStatus.QUOTATION_ACCEPTED,
        quotationAcceptedAt: new Date(),
      },
    });

    await this.auditLogService.log({
      actionType: 'ACCEPT_QUOTATION',
      entityType: 'SERVICE_QUOTATION',
      entityId: updated.id,
      userId: actor.id,
    });

    const admins = await this.prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.STAFF] }, isDeleted: false },
      select: { id: true, email: true },
    });

    for (const admin of admins) {
      await this.notificationsService.notify({
        userId: admin.id,
        email: admin.email,
        title: 'Quotation accepted',
        body: `Quotation ${updated.id} has been accepted by customer.`,
        referenceType: 'SERVICE_QUOTATION',
        referenceId: updated.id,
      });
    }

    await this.notificationsService.notify({
      userId: quotation.serviceRequest.customer.id,
      email: quotation.serviceRequest.customer.email,
      title: 'Quotation accepted',
      body: 'You have accepted the quotation successfully.',
      referenceType: 'SERVICE_QUOTATION',
      referenceId: updated.id,
    });

    return updated;
  }

  async rejectQuotation(id: string, reason: string | undefined, actor?: Actor) {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException('Only admin can reject quotations');
    }

    const quotation = await this.prisma.serviceQuotation.findUnique({
      where: { id },
      include: {
        serviceRequest: {
          include: {
            customer: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    const updated = await this.prisma.serviceQuotation.update({
      where: { id },
      data: {
        status: QuotationStatus.REJECTED,
        rejectedAt: new Date(),
        respondedAt: new Date(),
        rejectionReason: reason,
        updatedById: actor?.id,
      },
    });

    await this.prisma.serviceRequest.update({
      where: { id: quotation.serviceRequestId },
      data: {
        status: ServiceRequestStatus.QUOTATION_REJECTED,
        quotationRejectedAt: new Date(),
      },
    });

    await this.auditLogService.log({
      actionType: 'REJECT_QUOTATION',
      entityType: 'SERVICE_QUOTATION',
      entityId: updated.id,
      userId: actor?.id,
      metadata: { reason },
    });

    await this.notificationsService.notify({
      userId: quotation.serviceRequest.customer.id,
      email: quotation.serviceRequest.customer.email,
      title: 'Quotation rejected',
      body: `Quotation has been rejected${reason ? `: ${reason}` : '.'}`,
      referenceType: 'SERVICE_QUOTATION',
      referenceId: updated.id,
    });

    return updated;
  }
}
