import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateServiceScheduleDto } from './dto/create-service-schedule.dto';
import { UpdateServiceScheduleDto } from './dto/update-service-schedule.dto';
import { Role, ScheduleStatus, ServiceRequestStatus } from '@prisma/client';
import { NotificationsService } from 'src/notifications/notifications.service';
import { AuditLogService } from 'src/notifications/audit-log.service';

type Actor = { id: string; role: string };

@Injectable()
export class ServiceSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private isAdmin(actor?: Actor) {
    return actor?.role === Role.ADMIN || actor?.role === Role.STAFF;
  }

  private ensureFutureDate(date: Date) {
    if (date.getTime() <= Date.now()) {
      throw new BadRequestException('Scheduled date must be in the future');
    }
  }

  async create(dto: CreateServiceScheduleDto, actor?: Actor) {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException('Only admin can schedule service');
    }

    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: dto.serviceRequestId },
      include: {
        customer: { select: { id: true, email: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.status !== ServiceRequestStatus.QUOTATION_ACCEPTED) {
      throw new BadRequestException('Service can be scheduled only after quotation acceptance');
    }

    const scheduledStart = new Date(dto.scheduledDate);
    this.ensureFutureDate(scheduledStart);

    const schedule = await this.prisma.serviceSchedule.create({
      data: {
        serviceRequestId: dto.serviceRequestId,
        quotationId: dto.quotationId,
        assignedTechnicianId: dto.technicianId,
        scheduledStart,
        estimatedDurationMinutes: dto.estimatedDurationMinutes
          ? Number(dto.estimatedDurationMinutes)
          : undefined,
        internalNote: dto.internalNote,
        status: ScheduleStatus.SCHEDULED,
        createdById: actor?.id,
        updatedById: actor?.id,
      },
    });

    await this.prisma.serviceRequest.update({
      where: { id: dto.serviceRequestId },
      data: {
        status: ServiceRequestStatus.SCHEDULED,
        scheduledAt: new Date(dto.scheduledDate),
      },
    });

    await this.auditLogService.log({
      actionType: 'SCHEDULE_SERVICE',
      entityType: 'SERVICE_SCHEDULE',
      entityId: schedule.id,
      userId: actor?.id,
      metadata: { serviceRequestId: request.id },
    });

    await this.notificationsService.notify({
      userId: request.customer.id,
      email: request.customer.email,
      title: 'Service scheduled',
      body: `Your service request ${request.requestNumber} is scheduled on ${new Date(dto.scheduledDate).toISOString()}.`,
      referenceType: 'SERVICE_SCHEDULE',
      referenceId: schedule.id,
      emailSubject: 'Service schedule confirmation',
    });

    if (dto.technicianId) {
      const technician = await this.prisma.user.findUnique({
        where: { id: dto.technicianId },
        select: { id: true, email: true },
      });

      if (technician) {
        await this.notificationsService.notify({
          userId: technician.id,
          email: technician.email,
          title: 'New service assignment',
          body: `A service has been assigned for ${new Date(dto.scheduledDate).toISOString()}.`,
          referenceType: 'SERVICE_SCHEDULE',
          referenceId: schedule.id,
        });
      }
    }

    return schedule;
  }

  async update(id: string, dto: UpdateServiceScheduleDto, actor?: Actor) {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException('Only admin can reschedule service');
    }

    const schedule = await this.prisma.serviceSchedule.findUnique({
      where: { id },
      include: {
        serviceRequest: {
          include: {
            customer: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Service schedule not found');
    }

    if (dto.scheduledDate) {
      this.ensureFutureDate(new Date(dto.scheduledDate));
    }

    const isLastMinute =
      schedule.scheduledStart.getTime() - Date.now() <= 12 * 60 * 60 * 1000;

    const updated = await this.prisma.serviceSchedule.update({
      where: { id },
      data: {
        ...(dto.scheduledDate ? { scheduledStart: new Date(dto.scheduledDate) } : {}),
        ...(dto.reasonForReschedule
          ? { cancelReason: dto.reasonForReschedule }
          : {}),
        ...(dto.technicianId !== undefined
          ? { assignedTechnicianId: dto.technicianId }
          : {}),
        status: ScheduleStatus.RESCHEDULED,
        updatedById: actor?.id,
      },
    });

    await this.auditLogService.log({
      actionType: 'RESCHEDULE_SERVICE',
      entityType: 'SERVICE_SCHEDULE',
      entityId: updated.id,
      userId: actor?.id,
      metadata: {
        reason: dto.reasonForReschedule,
        isLastMinute,
      },
    });

    await this.notificationsService.notify({
      userId: schedule.serviceRequest.customer.id,
      email: schedule.serviceRequest.customer.email,
      title: 'Service rescheduled',
      body: `Your service request ${schedule.serviceRequest.requestNumber} was rescheduled.${isLastMinute ? ' (Last-minute change)' : ''}`,
      referenceType: 'SERVICE_SCHEDULE',
      referenceId: updated.id,
      emailSubject: 'Service schedule updated',
    });

    return updated;
  }

  async requestRescheduleByCustomer(
    id: string,
    params: { reason?: string; preferredDate?: string },
    actor?: Actor,
  ) {
    if (!actor || actor.role !== Role.CUSTOMER) {
      throw new ForbiddenException('Only customer can request reschedule');
    }

    const schedule = await this.prisma.serviceSchedule.findUnique({
      where: { id },
      include: {
        serviceRequest: {
          include: {
            customer: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Service schedule not found');
    }

    if (schedule.serviceRequest.customerId !== actor.id) {
      throw new ForbiddenException('You can only request reschedule for your own service');
    }

    if (schedule.status !== ScheduleStatus.SCHEDULED && schedule.status !== ScheduleStatus.RESCHEDULED) {
      throw new BadRequestException('Reschedule can be requested only for scheduled services');
    }

    const isLastMinute =
      schedule.scheduledStart.getTime() - Date.now() <= 12 * 60 * 60 * 1000;

    await this.prisma.serviceSchedule.update({
      where: { id },
      data: {
        customerNote: `Reschedule requested by customer.${params.reason ? ` Reason: ${params.reason}` : ''}${params.preferredDate ? ` Preferred: ${params.preferredDate}` : ''}`,
        updatedById: actor.id,
      },
    });

    await this.auditLogService.log({
      actionType: 'REQUEST_RESCHEDULE',
      entityType: 'SERVICE_SCHEDULE',
      entityId: id,
      userId: actor.id,
      metadata: {
        reason: params.reason ?? null,
        preferredDate: params.preferredDate ?? null,
        isLastMinute,
      },
    });

    const admins = await this.prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.STAFF] }, isDeleted: false },
      select: { id: true, email: true },
    });

    for (const adminUser of admins) {
      await this.notificationsService.notify({
        userId: adminUser.id,
        email: adminUser.email,
        title: 'Customer requested reschedule',
        body: `Customer requested reschedule for ${schedule.serviceRequest.requestNumber}.${isLastMinute ? ' Last-minute request.' : ''}`,
        referenceType: 'SERVICE_SCHEDULE',
        referenceId: id,
      });
    }

    await this.notificationsService.notify({
      userId: schedule.serviceRequest.customer.id,
      email: schedule.serviceRequest.customer.email,
      title: 'Reschedule request submitted',
      body: 'Your reschedule request has been sent to admin.',
      referenceType: 'SERVICE_SCHEDULE',
      referenceId: id,
    });

    return { message: 'Reschedule request submitted' };
  }

  async cancel(id: string, actor?: Actor) {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException('Only admin can cancel schedules');
    }

    const schedule = await this.prisma.serviceSchedule.findUnique({
      where: { id },
      include: {
        serviceRequest: {
          include: {
            customer: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Service schedule not found');
    }

    await this.prisma.serviceSchedule.update({
      where: { id },
      data: {
        status: ScheduleStatus.CANCELLED,
        updatedById: actor?.id,
      },
    });

    await this.prisma.serviceRequest.update({
      where: { id: schedule.serviceRequestId },
      data: {
        status: ServiceRequestStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    await this.auditLogService.log({
      actionType: 'CANCEL_SERVICE',
      entityType: 'SERVICE_SCHEDULE',
      entityId: schedule.id,
      userId: actor?.id,
    });

    await this.notificationsService.notify({
      userId: schedule.serviceRequest.customer.id,
      email: schedule.serviceRequest.customer.email,
      title: 'Service schedule cancelled',
      body: `Service schedule for request ${schedule.serviceRequest.requestNumber} has been cancelled.`,
      referenceType: 'SERVICE_SCHEDULE',
      referenceId: schedule.id,
    });

    return { message: 'Service schedule cancelled successfully' };
  }
}
