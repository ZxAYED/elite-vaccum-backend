import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma, ServiceOrderStatus, ServiceRequestStatus } from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis';
import { STANDARD_TIME_SLOTS } from './constants/services-catalog.constant';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { AvailableSlotsQueryDto, ScheduleBoardQueryDto } from './dto/available-slots-query.dto';
import { CancelAppointmentDto } from './dto/assign-technician.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Helper to parse date and 12-hour time string into a Date object.
   * e.g. date: "2026-09-15", time: "09:00 AM" -> Date
   */
  private parseDateTime(dateStr: string, timeStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    const cleaned = timeStr.trim().toUpperCase();
    const match = cleaned.match(/(\d+):(\d+)\s*(AM|PM)/i);

    let hours = 9;
    let minutes = 0;

    if (match) {
      hours = Number(match[1]);
      minutes = Number(match[2]);
      const ampm = match[3];

      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    }

    return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  }

  private appointmentInclude() {
    return {
      technician: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          phone: true,
          rating: true,
          status: true,
        },
      },
      serviceRequest: {
        select: {
          id: true,
          businessId: true,
          title: true,
          status: true,
          serviceAddress: true,
          customer: {
            select: {
              id: true,
              userId: true,
              displayName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      serviceOrder: {
        select: {
          id: true,
          businessId: true,
          status: true,
          totalUsd: true,
        },
      },
    } satisfies Prisma.AppointmentInclude;
  }


  // AVAILABLE SLOTS CALCULATION


  /**
   * Returns daily booking slots for a given date with explicit FREE vs BOOKED status on every slot.
   * Cached in Redis with 60 seconds TTL.
   */
  async getDailySlots(query: AvailableSlotsQueryDto) {
    const targetDate = query.date.trim();
    const rawTech = (query.technicianId || query.techId)?.trim();
    let resolvedTechnicianId: string | undefined = undefined;

    if (rawTech && rawTech !== '' && rawTech.toLowerCase() !== 'all') {
      const tech = await this.prisma.technician.findFirst({
        where: {
          OR: [{ id: rawTech }, { userId: rawTech }],
        },
        select: { id: true },
      });
      resolvedTechnicianId = tech ? tech.id : rawTech;
    }

    const cacheKey = `schedule:slots:${targetDate}:${resolvedTechnicianId || 'all'}`;

    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const [year, month, day] = targetDate.split('-').map(Number);

    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

    // Fetch active technicians
    const technicians = await this.prisma.technician.findMany({
      where: {
        status: 'ACTIVE',
        ...(resolvedTechnicianId ? { id: resolvedTechnicianId } : {}),
      },
      select: { id: true, displayName: true, phone: true },
    });

    // Fetch existing appointments on this day that are not cancelled
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        startAt: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['CANCELLED'] },
        ...(resolvedTechnicianId ? { technicianId: resolvedTechnicianId } : {}),
      },
      include: {
        technician: { select: { id: true, displayName: true } },
      },
    });

    const totalTechnicians = technicians.length || 1; // Default at least 1 capacity

    const slots = STANDARD_TIME_SLOTS.map((template) => {
      const slotStart = this.parseDateTime(targetDate, template.startTime);
      const slotEnd = this.parseDateTime(targetDate, template.endTime);

      // Find overlapping appointments in this window
      const bookedAppointments = existingAppointments.filter((app) => {
        return (
          (app.startAt < slotEnd && app.endAt > slotStart) ||
          (app.startAt.getTime() === slotStart.getTime())
        );
      });

      const bookedTechIds = new Set(
        bookedAppointments.map((a) => a.technicianId).filter(Boolean),
      );

      const isSingleTechFilter = !!query.technicianId;
      const isBooked = isSingleTechFilter
        ? bookedAppointments.length > 0
        : bookedAppointments.length >= totalTechnicians;

      const freeTechnicians = technicians.filter((t) => !bookedTechIds.has(t.id));

      return {
        slot: template.slot,
        label: template.label,
        timeWindow: template.timeWindow,
        period: template.period,
        startTime: template.startTime,
        endTime: template.endTime,
        isBooked,
        status: isBooked ? ('BOOKED' as const) : ('FREE' as const),
        bookedCount: bookedAppointments.length,
        availableCapacity: Math.max(0, totalTechnicians - bookedAppointments.length),
        availableTechnicians: freeTechnicians,
      };
    });

    const result = {
      success: true,
      date: targetDate,
      totalSlots: slots.length,
      availableSlotsCount: slots.filter((s) => !s.isBooked).length,
      bookedSlotsCount: slots.filter((s) => s.isBooked).length,
      slots,
    };

    await this.redis.set(cacheKey, result, 60); // 60 seconds TTL
    return result;
  }


  // ADMIN DISPATCH BOARD


  async getDispatchBoard(query: ScheduleBoardQueryDto) {
    const [startYear, startMonth, startDay] = query.dateFrom.split('-').map(Number);
    const [endYear, endMonth, endDay] = query.dateTo.split('-').map(Number);

    const startAt = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0));
    const endAt = new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59));

    // Resolve technician filter: supports technicianId or techId, accepts Technician.id or Technician.userId
    const rawTech = (query.technicianId || query.techId)?.trim();
    let resolvedTechnicianId: string | undefined = undefined;

    if (rawTech && rawTech !== '' && rawTech.toLowerCase() !== 'all') {
      const tech = await this.prisma.technician.findFirst({
        where: {
          OR: [{ id: rawTech }, { userId: rawTech }],
        },
        select: { id: true },
      });
      resolvedTechnicianId = tech ? tech.id : rawTech;
    }

    const where: Prisma.AppointmentWhereInput = {
      startAt: { gte: startAt, lte: endAt },
      ...(resolvedTechnicianId ? { technicianId: resolvedTechnicianId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const appointments = await this.prisma.appointment.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: this.appointmentInclude(),
    });

    const totalCount = appointments.length;
    const confirmedCount = appointments.filter((a) => a.status === 'CONFIRMED').length;
    const rescheduledCount = appointments.filter((a) => a.status === 'RESCHEDULED').length;
    const completedCount = appointments.filter((a) => a.status === 'COMPLETED').length;
    const cancelledCount = appointments.filter((a) => a.status === 'CANCELLED').length;

    // Fetch technicians list: if specific technician requested, filter to that technician; otherwise all active technicians
    const technicians = await this.prisma.technician.findMany({
      where: resolvedTechnicianId ? { id: resolvedTechnicianId } : {},
      select: {
        id: true,
        displayName: true,
        phone: true,
        status: true,
        rating: true,
      },
      orderBy: { displayName: 'asc' },
    });

    return {
      success: true,
      data: {
        appointments,
        technicians,
      },
      meta: {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        technicianId: resolvedTechnicianId || null,
        total: totalCount,
        stats: {
          confirmed: confirmedCount,
          rescheduled: rescheduledCount,
          completed: completedCount,
          cancelled: cancelledCount,
          unassigned: appointments.filter((a) => !a.technicianId).length,
        },
      },
    };
  }


  // APPOINTMENT CREATION & DISPATCH


  async createAppointment(dto: CreateScheduleDto, user: RequestUser) {
    let serviceRequestId = dto.serviceRequestId;
    let serviceOrderId = dto.serviceOrderId;
    let addressSnapshot: any = {};

    // 1. Resolve Linked Request or Order
    if (serviceRequestId) {
      const request = await this.prisma.serviceRequest.findUnique({
        where: { id: serviceRequestId },
      });
      if (!request) {
        throw new NotFoundException('Service request not found');
      }
      addressSnapshot = request.serviceAddress;
    } else if (serviceOrderId) {
      const order = await this.prisma.serviceOrder.findUnique({
        where: { id: serviceOrderId },
        include: { serviceRequest: true },
      });
      if (!order) {
        throw new NotFoundException('Service order not found');
      }
      serviceRequestId = order.serviceRequestId;
      addressSnapshot = order.serviceRequest.serviceAddress;
    } else {
      throw new BadRequestException('Either serviceRequestId or serviceOrderId must be provided');
    }

    const startAt = this.parseDateTime(dto.date, dto.startTime);
    const endAt = this.parseDateTime(dto.date, dto.endTime);

    if (startAt >= endAt) {
      throw new BadRequestException('Start time must be earlier than end time');
    }

    const lockKey = `lock:schedule:${dto.technicianId || 'unassigned'}:${dto.date}:${dto.startTime}`;
    const lockToken = await this.redis.acquireLock(lockKey, {
      ttlMs: 10000,
      retryCount: 0,
    });

    if (!lockToken) {
      throw new BadRequestException(
        'This time slot is currently being booked by another request. Please try again.',
      );
    }

    try {
      // 2. Conflict Prevention: Check if technician is already booked
      if (dto.technicianId) {
        const conflict = await this.prisma.appointment.findFirst({
          where: {
            technicianId: dto.technicianId,
            status: { notIn: ['CANCELLED'] },
            AND: [
              { startAt: { lt: endAt } },
              { endAt: { gt: startAt } },
            ],
          },
        });

        if (conflict) {
          throw new BadRequestException(
            `Technician is already booked for another appointment between ${conflict.startAt.toISOString()} and ${conflict.endAt.toISOString()}`,
          );
        }
      }

      return await this.prisma.$transaction(async (tx) => {
        // 3. Create Appointment
        const appointment = await tx.appointment.create({
          data: {
            serviceOrderId: serviceOrderId || null,
            serviceRequestId: serviceRequestId!,
            technicianId: dto.technicianId || null,
            status: 'CONFIRMED',
            startAt,
            endAt,
            addressSnapshot,
            notes: dto.notes?.trim() || null,
            adminNote: dto.adminNote?.trim() || null,
          },
          include: this.appointmentInclude(),
        });

        // 4. Update Service Request status to SCHEDULED
        if (serviceRequestId) {
          await tx.serviceRequest.update({
            where: { id: serviceRequestId },
            data: {
              status: ServiceRequestStatus.SCHEDULED,
              currentSchedule: {
                date: dto.date,
                startTime: dto.startTime,
                endTime: dto.endTime,
                appointmentId: appointment.id,
                scheduledAt: new Date().toISOString(),
                technicianId: dto.technicianId || null,
              },
            },
          });
        }

        // 5. Update Service Order if linked
        if (serviceOrderId) {
          await tx.serviceOrder.update({
            where: { id: serviceOrderId },
            data: {
              status: ServiceOrderStatus.SCHEDULED,
              scheduledAt: startAt,
              assignedTechnicianId: dto.technicianId || null,
            },
          });
        }

        this.logger.log(
          `Appointment scheduled for ${dto.date} (${dto.startTime} - ${dto.endTime}) by Admin (${user.email})`,
        );

        await this.invalidateSlotCache(dto.date);

        return {
          success: true,
          message: 'Appointment successfully created and dispatched',
          appointment,
        };
      });
    } finally {
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  async updateAppointment(
    appointmentId: string,
    dto: UpdateScheduleDto,
    user: RequestUser,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    let startAt = appointment.startAt;
    let endAt = appointment.endAt;

    if (dto.date || dto.startTime || dto.endTime) {
      const targetDate = dto.date || appointment.startAt.toISOString().slice(0, 10);
      const startTimeStr = dto.startTime || '09:00 AM';
      const endTimeStr = dto.endTime || '11:00 AM';

      startAt = this.parseDateTime(targetDate, startTimeStr);
      endAt = this.parseDateTime(targetDate, endTimeStr);

      if (startAt >= endAt) {
        throw new BadRequestException('Start time must be earlier than end time');
      }
    }

    const techId = dto.technicianId !== undefined ? dto.technicianId : appointment.technicianId;

    // Conflict check
    if (techId) {
      const conflict = await this.prisma.appointment.findFirst({
        where: {
          id: { not: appointmentId },
          technicianId: techId,
          status: { notIn: ['CANCELLED'] },
          AND: [
            { startAt: { lt: endAt } },
            { endAt: { gt: startAt } },
          ],
        },
      });

      if (conflict) {
        throw new BadRequestException(
          `Technician is already booked for another appointment between ${conflict.startAt.toISOString()} and ${conflict.endAt.toISOString()}`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const app = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          startAt,
          endAt,
          technicianId: techId || null,
          status: dto.status || 'RESCHEDULED',
          adminNote: dto.adminNote !== undefined ? dto.adminNote?.trim() || null : appointment.adminNote,
          notes: dto.notes !== undefined ? dto.notes?.trim() || null : appointment.notes,
        },
        include: this.appointmentInclude(),
      });

      if (appointment.serviceRequestId) {
        const targetDate = dto.date || appointment.startAt.toISOString().slice(0, 10);
        const timeWindowLabel = dto.startTime && dto.endTime ? `${dto.startTime} - ${dto.endTime}` : undefined;

        await tx.serviceRequest.update({
          where: { id: appointment.serviceRequestId },
          data: {
            preferredDate: targetDate,
            ...(timeWindowLabel ? { preferredTime: timeWindowLabel } : {}),
            assignedTechnicianId: techId || undefined,
            currentSchedule: {
              date: targetDate,
              startTime: dto.startTime || '09:00 AM',
              endTime: dto.endTime || '11:00 AM',
              appointmentId: appointment.id,
              rescheduledAt: new Date().toISOString(),
              technicianId: techId || null,
            },
          },
        });
      }

      if (appointment.serviceOrderId) {
        await tx.serviceOrder.update({
          where: { id: appointment.serviceOrderId },
          data: {
            scheduledAt: startAt,
            assignedTechnicianId: techId || undefined,
          },
        });
      }

      return app;
    });

    const oldDateStr = appointment.startAt.toISOString().slice(0, 10);
    const targetDateStr = (dto.date || oldDateStr);

    await this.invalidateSlotCache(oldDateStr);
    if (targetDateStr !== oldDateStr) {
      await this.invalidateSlotCache(targetDateStr);
    }

    // Notify customer about rescheduled appointment
    if (updated.serviceRequest?.customer?.userId) {
      const startTimeLabel = dto.startTime || '09:00 AM';
      const endTimeLabel = dto.endTime || '11:00 AM';
      this.notificationsService
        .create({
          userId: updated.serviceRequest.customer.userId,
          type: NotificationType.SERVICE_REQUEST_UPDATE,
          title: 'Service Appointment Rescheduled',
          message: `Your service appointment for ${updated.serviceRequest.title} has been rescheduled to ${targetDateStr} (${startTimeLabel} - ${endTimeLabel}).`,
          ctaLabel: 'View Request',
          ctaUrl: `/user/services/requests/${updated.serviceRequest.id}`,
          metadata: {
            serviceRequestId: updated.serviceRequest.id,
            appointmentId: updated.id,
            rescheduledDate: targetDateStr,
            startTime: startTimeLabel,
            endTime: endTimeLabel,
          },
          sendEmail: true,
          priority: 1,
        })
        .catch((err) => {
          this.logger.warn(`Failed to notify customer of rescheduled appointment: ${err.message}`);
        });
    }

    return {
      success: true,
      message: 'Appointment schedule updated successfully',
      appointment: updated,
    };
  }

  async rescheduleForServiceRequest(
    serviceRequestId: string,
    dto: UpdateScheduleDto,
    user: RequestUser,
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      include: {
        appointments: {
          where: { status: { notIn: ['CANCELLED'] } },
          orderBy: { startAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    const activeAppointment = request.appointments[0];
    if (activeAppointment) {
      return this.updateAppointment(activeAppointment.id, dto, user);
    }

    // If no existing active appointment, create a fresh appointment
    return this.createAppointment(
      {
        serviceRequestId,
        date: dto.date || request.preferredDate,
        startTime: dto.startTime || '09:00 AM',
        endTime: dto.endTime || '11:00 AM',
        technicianId: dto.technicianId,
        adminNote: dto.adminNote,
        notes: dto.notes,
      },
      user,
    );
  }

  async assignTechnician(
    appointmentId: string,
    dto: AssignTechnicianDto,
    user: RequestUser,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const tech = await this.prisma.technician.findUnique({
      where: { id: dto.technicianId },
    });

    if (!tech) {
      throw new NotFoundException('Technician not found');
    }

    // Conflict check for target technician
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        id: { not: appointmentId },
        technicianId: dto.technicianId,
        status: { notIn: ['CANCELLED'] },
        AND: [
          { startAt: { lt: appointment.endAt } },
          { endAt: { gt: appointment.startAt } },
        ],
      },
    });

    if (conflict) {
      throw new BadRequestException(
        `Technician '${tech.displayName}' is already booked for another appointment at this time`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const app = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          technicianId: dto.technicianId,
          adminNote: dto.adminNote
            ? `${appointment.adminNote ? `${appointment.adminNote} | ` : ''}Assigned: ${dto.adminNote}`
            : appointment.adminNote,
        },
        include: this.appointmentInclude(),
      });

      if (appointment.serviceRequestId) {
        await tx.serviceRequest.update({
          where: { id: appointment.serviceRequestId },
          data: { assignedTechnicianId: dto.technicianId },
        });
      }

      if (appointment.serviceOrderId) {
        await tx.serviceOrder.update({
          where: { id: appointment.serviceOrderId },
          data: { assignedTechnicianId: dto.technicianId },
        });
      }

      return app;
    });

    const targetDateStr = appointment.startAt.toISOString().slice(0, 10);
    await this.invalidateSlotCache(targetDateStr);

    return {
      success: true,
      message: `Technician '${tech.displayName}' successfully assigned to appointment`,
      appointment: updated,
    };
  }

  async cancelAppointment(
    appointmentId: string,
    dto: CancelAppointmentDto,
    user: RequestUser,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const updatedNotes = `${appointment.notes ? `${appointment.notes}\n` : ''}[CANCELLED by Admin (${user.email}) on ${new Date().toISOString()}]: ${dto.reason.trim()}`;

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CANCELLED',
        notes: updatedNotes,
      },
      include: this.appointmentInclude(),
    });

    const targetDateStr = appointment.startAt.toISOString().slice(0, 10);
    await this.invalidateSlotCache(targetDateStr);

    return {
      success: true,
      message: 'Appointment cancelled successfully',
      appointment: updated,
    };
  }


  // CACHE INVALIDATION HELPER


  async invalidateSlotCache(dateStr?: string) {
    try {
      if (dateStr) {
        await this.redis.deleteByPattern(`schedule:slots:${dateStr}:*`);
      } else {
        await this.redis.deleteByPattern('schedule:slots:*');
      }
    } catch (err: any) {
      this.logger.warn(`Redis slot cache invalidation error: ${err.message}`);
    }
  }
}
