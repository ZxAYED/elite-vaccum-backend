import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TechnicianStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { getPagination } from 'src/common/utils/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { CloudinaryUploadService } from 'src/storage/cloudinary-upload.service';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { TechnicianListQueryDto, UpdateTechnicianDto } from './dto/update-technician.dto';

@Injectable()
export class TechniciansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryUploadService,
  ) {}

  private includeRelations() {
    return {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
        },
      },
      _count: {
        select: {
          assignedRequests: true,
          assignedJobs: true,
          appointments: true,
          serviceReports: true,
        },
      },
    } satisfies Prisma.TechnicianInclude;
  }

  async findAll(query: TechnicianListQueryDto) {
    const where: Prisma.TechnicianWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.specialization
        ? { specializations: { has: query.specialization } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { displayName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const totalItems = await this.prisma.technician.count({ where });
    const { skip, take, meta } = getPagination(
      query.page,
      query.limit,
      totalItems,
    );

    const items = await this.prisma.technician.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: this.includeRelations(),
    });

    const activeCount = await this.prisma.technician.count({
      where: { status: TechnicianStatus.ACTIVE },
    });
    const onLeaveCount = await this.prisma.technician.count({
      where: { status: TechnicianStatus.ON_LEAVE },
    });

    return {
      items,
      meta: {
        ...meta,
        stats: {
          active: activeCount,
          onLeave: onLeaveCount,
          total: totalItems,
        },
      },
    };
  }

  async findOne(id: string) {
    const technician = await this.prisma.technician.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
          },
        },
        assignedRequests: {
          take: 5,
          orderBy: { submittedAt: 'desc' },
          select: {
            id: true,
            businessId: true,
            title: true,
            status: true,
            preferredDate: true,
          },
        },
        assignedJobs: {
          take: 5,
          orderBy: { scheduledAt: 'desc' },
          select: {
            id: true,
            businessId: true,
            status: true,
            scheduledAt: true,
            totalUsd: true,
          },
        },
        appointments: {
          take: 5,
          orderBy: { startAt: 'desc' },
          select: {
            id: true,
            status: true,
            startAt: true,
            endAt: true,
            notes: true,
          },
        },
        serviceReports: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            assignedRequests: true,
            assignedJobs: true,
            appointments: true,
            serviceReports: true,
          },
        },
      },
    });

    if (!technician) {
      throw new NotFoundException('Technician not found');
    }

    return technician;
  }

  async create(dto: CreateTechnicianDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const parts = dto.displayName.trim().split(' ');
    const firstName = parts[0] || 'Technician';
    const lastName = parts.slice(1).join(' ') || '';
    const passwordHash = await bcrypt.hash(dto.password || 'Password123!', 10);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          firstName,
          lastName,
          phone: dto.phone.trim(),
          passwordHash,
          role: UserRole.TECHNICIAN,
          isActive: true,
          emailVerifiedAt: new Date(),
        },
      });

      const technician = await tx.technician.create({
        data: {
          userId: user.id,
          displayName: dto.displayName.trim(),
          email,
          phone: dto.phone.trim(),
          status: dto.status || TechnicianStatus.ACTIVE,
          specializations: dto.specializations || [],
          defaultAvailability: dto.defaultAvailability
            ? (dto.defaultAvailability as Prisma.InputJsonValue)
            : Prisma.DbNull,
          adminNotes: dto.adminNotes?.trim() || null,
        },
        include: this.includeRelations(),
      });

      return {
        success: true,
        message: 'Technician account created successfully',
        technician,
      };
    });
  }

  async update(id: string, dto: UpdateTechnicianDto) {
    const existing = await this.prisma.technician.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Technician not found');
    }

    const updated = await this.prisma.technician.update({
      where: { id },
      data: {
        ...(dto.displayName ? { displayName: dto.displayName.trim() } : {}),
        ...(dto.phone ? { phone: dto.phone.trim() } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.rating !== undefined ? { rating: new Prisma.Decimal(dto.rating) } : {}),
        ...(dto.completedJobs !== undefined ? { completedJobs: dto.completedJobs } : {}),
        ...(dto.specializations ? { specializations: dto.specializations } : {}),
        ...(dto.defaultAvailability !== undefined
          ? {
              defaultAvailability: dto.defaultAvailability
                ? (dto.defaultAvailability as Prisma.InputJsonValue)
                : Prisma.DbNull,
            }
          : {}),
        ...(dto.adminNotes !== undefined ? { adminNotes: dto.adminNotes?.trim() || null } : {}),
      },
      include: this.includeRelations(),
    });

    return {
      success: true,
      message: 'Technician updated successfully',
      technician: updated,
    };
  }

  async remove(id: string) {
    const existing = await this.prisma.technician.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Technician not found');
    }

    await this.prisma.$transaction([
      this.prisma.technician.delete({ where: { id } }),
      this.prisma.user.delete({ where: { id: existing.userId } }),
    ]);

    return {
      success: true,
      message: 'Technician deleted successfully',
    };
  }


  // TECHNICIAN PORTAL (SELF-SERVICE / MOBILE)


  private async getTechnicianByUserId(userId: string) {
    const technician = await this.prisma.technician.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!technician) {
      throw new NotFoundException('Technician profile not found for this user account');
    }

    return technician;
  }

  async getMeProfile(userId: string) {
    const technician = await this.getTechnicianByUserId(userId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const jobsThisMonth = await this.prisma.serviceOrder.count({
      where: {
        assignedTechnicianId: technician.id,
        status: 'COMPLETED',
        updatedAt: { gte: startOfMonth },
      },
    });

    const upcomingAssignments = await this.prisma.appointment.count({
      where: {
        technicianId: technician.id,
        startAt: { gte: now },
        status: { in: ['SCHEDULED', 'RESCHEDULED', 'CONFIRMED'] },
      },
    });

    return {
      id: technician.id,
      userId: technician.userId,
      displayName: technician.displayName,
      email: technician.email,
      phone: technician.phone,
      role: 'TECHNICIAN',
      status: technician.status,
      availability: technician.availability || 'AVAILABLE',
      timezone: technician.timezone || 'America/New_York',
      avatarUrl: technician.avatarUrl || null,
      rating: Number(technician.rating) || 5.0,
      serviceSummary: {
        completedJobs: technician.completedJobs,
        jobsThisMonth,
        upcomingAssignments,
        specializations: technician.specializations || [],
      },
    };
  }

  async updateMeProfile(userId: string, dto: { displayName?: string; phone?: string; specializations?: string[] }) {
    const technician = await this.getTechnicianByUserId(userId);

    const updated = await this.prisma.technician.update({
      where: { id: technician.id },
      data: {
        ...(dto.displayName ? { displayName: dto.displayName.trim() } : {}),
        ...(dto.phone ? { phone: dto.phone.trim() } : {}),
        ...(dto.specializations ? { specializations: dto.specializations } : {}),
      },
    });

    return {
      success: true,
      message: 'Profile updated successfully',
      profile: updated,
    };
  }

  async updateMeAvatar(userId: string, file: Express.Multer.File) {
    const technician = await this.getTechnicianByUserId(userId);

    const uploadResult = await this.cloudinaryService.uploadFile({
      fileBuffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      folder: 'elite-vacuum/technicians',
    });

    const updated = await this.prisma.technician.update({
      where: { id: technician.id },
      data: { avatarUrl: uploadResult.url },
    });

    return {
      success: true,
      message: 'Profile photo updated successfully',
      avatarUrl: updated.avatarUrl,
    };
  }

  async removeMeAvatar(userId: string) {
    const technician = await this.getTechnicianByUserId(userId);

    await this.prisma.technician.update({
      where: { id: technician.id },
      data: { avatarUrl: null },
    });

    return {
      success: true,
      message: 'Profile photo removed successfully',
    };
  }

  async updateMeAvailability(userId: string, dto: { availability: string; timezone?: string }) {
    const technician = await this.getTechnicianByUserId(userId);

    const updated = await this.prisma.technician.update({
      where: { id: technician.id },
      data: {
        availability: dto.availability,
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
      },
    });

    return {
      success: true,
      message: 'Availability status updated successfully',
      availability: updated.availability,
      timezone: updated.timezone,
    };
  }

  async getMeOverview(userId: string) {
    const technician = await this.getTechnicianByUserId(userId);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // 1. Calculate Summary Metric Counters
    const todayJobsCount = await this.prisma.appointment.count({
      where: {
        technicianId: technician.id,
        startAt: { gte: todayStart, lte: todayEnd },
      },
    });

    const activeJobsCount = await this.prisma.serviceOrder.count({
      where: {
        assignedTechnicianId: technician.id,
        status: { in: ['TECHNICIAN_ASSIGNED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'] },
      },
    });

    const completedTodayCount = await this.prisma.serviceOrder.count({
      where: {
        assignedTechnicianId: technician.id,
        status: 'COMPLETED',
        updatedAt: { gte: todayStart, lte: todayEnd },
      },
    });

    const upcomingJobsCount = await this.prisma.appointment.count({
      where: {
        technicianId: technician.id,
        startAt: { gt: todayEnd },
      },
    });

    // 2. Today's Schedule
    const todayAppointments = await this.prisma.appointment.findMany({
      where: {
        technicianId: technician.id,
        startAt: { gte: todayStart, lte: todayEnd },
      },
      include: {
        serviceOrder: {
          include: {
            customer: true,
            serviceRequest: { include: { service: true } },
            addressRef: true,
          },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    // 3. Next Appointment
    const nextAppointment = await this.prisma.appointment.findFirst({
      where: {
        technicianId: technician.id,
        startAt: { gte: now },
        status: { in: ['SCHEDULED', 'RESCHEDULED', 'CONFIRMED'] },
      },
      include: {
        serviceOrder: {
          include: {
            customer: true,
            serviceRequest: { include: { service: true } },
            addressRef: true,
          },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    // 4. Upcoming Jobs (after today)
    const upcomingAppointments = await this.prisma.appointment.findMany({
      where: {
        technicianId: technician.id,
        startAt: { gt: todayEnd },
      },
      take: 5,
      include: {
        serviceOrder: {
          include: {
            customer: true,
            serviceRequest: { include: { service: true } },
            addressRef: true,
          },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    // 5. Recently Completed Jobs
    const recentlyCompleted = await this.prisma.serviceOrder.findMany({
      where: {
        assignedTechnicianId: technician.id,
        status: 'COMPLETED',
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      include: {
        customer: true,
        serviceRequest: { include: { service: true } },
      },
    });

    const formatTimeWindow = (start: Date, end: Date) => {
      const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return `${formatTime(start)} - ${formatTime(end)}`;
    };

    return {
      summary: {
        availability: technician.availability || 'AVAILABLE',
        todayJobsCount,
        activeJobsCount,
        completedTodayCount,
        upcomingJobsCount,
        completedTotalCount: technician.completedJobs,
      },
      todaySchedule: todayAppointments.map((apt) => ({
        appointmentId: apt.id,
        serviceOrderId: apt.serviceOrderId,
        businessId: apt.serviceOrder?.businessId,
        serviceName: apt.serviceOrder?.serviceRequest?.service?.name || 'General Service',
        timeWindow: formatTimeWindow(apt.startAt, apt.endAt),
        status: apt.status,
        customerName: apt.serviceOrder?.customer?.displayName || `${apt.serviceOrder?.customer?.firstName} ${apt.serviceOrder?.customer?.lastName}`,
        customerPhone: apt.serviceOrder?.customer?.phone || apt.serviceOrder?.customer?.cellphone,
        propertyAddress: apt.serviceOrder?.addressRef
          ? `${apt.serviceOrder.addressRef.line1}, ${apt.serviceOrder.addressRef.city}, ${apt.serviceOrder.addressRef.state}`
          : apt.serviceOrder?.serviceRequest?.propertyLabel,
      })),
      nextAppointment: nextAppointment
        ? {
            appointmentId: nextAppointment.id,
            serviceOrderId: nextAppointment.serviceOrderId,
            businessId: nextAppointment.serviceOrder?.businessId,
            serviceName: nextAppointment.serviceOrder?.serviceRequest?.service?.name || 'General Service',
            scheduledDate: nextAppointment.startAt,
            timeWindow: formatTimeWindow(nextAppointment.startAt, nextAppointment.endAt),
            status: nextAppointment.status,
            customerName: nextAppointment.serviceOrder?.customer?.displayName || `${nextAppointment.serviceOrder?.customer?.firstName} ${nextAppointment.serviceOrder?.customer?.lastName}`,
            customerPhone: nextAppointment.serviceOrder?.customer?.phone || nextAppointment.serviceOrder?.customer?.cellphone,
            propertyAddress: nextAppointment.serviceOrder?.addressRef
              ? `${nextAppointment.serviceOrder.addressRef.line1}, ${nextAppointment.serviceOrder.addressRef.city}, ${nextAppointment.serviceOrder.addressRef.state}`
              : nextAppointment.serviceOrder?.serviceRequest?.propertyLabel,
          }
        : null,
      upcomingJobs: upcomingAppointments.map((apt) => ({
        appointmentId: apt.id,
        serviceOrderId: apt.serviceOrderId,
        businessId: apt.serviceOrder?.businessId,
        serviceName: apt.serviceOrder?.serviceRequest?.service?.name || 'General Service',
        scheduledDate: apt.startAt,
        timeWindow: formatTimeWindow(apt.startAt, apt.endAt),
        status: apt.status,
        customerName: apt.serviceOrder?.customer?.displayName || `${apt.serviceOrder?.customer?.firstName} ${apt.serviceOrder?.customer?.lastName}`,
        propertyAddress: apt.serviceOrder?.addressRef
          ? `${apt.serviceOrder.addressRef.line1}, ${apt.serviceOrder.addressRef.city}, ${apt.serviceOrder.addressRef.state}`
          : apt.serviceOrder?.serviceRequest?.propertyLabel,
      })),
      recentlyCompleted: recentlyCompleted.map((so) => ({
        serviceOrderId: so.id,
        businessId: so.businessId,
        serviceName: so.serviceRequest?.service?.name || 'General Service',
        customerName: so.customer?.displayName || `${so.customer?.firstName} ${so.customer?.lastName}`,
        completedAt: so.updatedAt,
        totalAmountUsd: so.totalUsd,
      })),
      recentActivity: [],
    };
  }

  async getMeJobs(userId: string, query: { tab?: string; page?: number; limit?: number }) {
    const technician = await this.getTechnicianByUserId(userId);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Global counters for tabs
    const [todayCount, upcomingCount, activeCount, completedCount] = await Promise.all([
      this.prisma.appointment.count({
        where: {
          technicianId: technician.id,
          startAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.appointment.count({
        where: {
          technicianId: technician.id,
          startAt: { gt: todayEnd },
        },
      }),
      this.prisma.serviceOrder.count({
        where: {
          assignedTechnicianId: technician.id,
          status: { in: ['TECHNICIAN_ASSIGNED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.serviceOrder.count({
        where: {
          assignedTechnicianId: technician.id,
          status: 'COMPLETED',
        },
      }),
    ]);

    let where: Prisma.ServiceOrderWhereInput = {
      assignedTechnicianId: technician.id,
    };

    if (query.tab === 'today') {
      where = {
        assignedTechnicianId: technician.id,
        appointments: {
          some: {
            startAt: { gte: todayStart, lte: todayEnd },
          },
        },
      };
    } else if (query.tab === 'upcoming') {
      where = {
        assignedTechnicianId: technician.id,
        appointments: {
          some: {
            startAt: { gt: todayEnd },
          },
        },
      };
    } else if (query.tab === 'in_progress') {
      where = {
        assignedTechnicianId: technician.id,
        status: { in: ['TECHNICIAN_ASSIGNED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'] },
      };
    } else if (query.tab === 'completed') {
      where = {
        assignedTechnicianId: technician.id,
        status: 'COMPLETED',
      };
    }

    const totalItems = await this.prisma.serviceOrder.count({ where });
    const { skip, take, meta } = getPagination(query.page, query.limit, totalItems);

    const serviceOrders = await this.prisma.serviceOrder.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        serviceRequest: { include: { service: true } },
        appointments: { orderBy: { startAt: 'desc' }, take: 1 },
        etas: { orderBy: { updatedAt: 'desc' }, take: 1 },
        addressRef: true,
      },
    });

    const formatTimeWindow = (start?: Date, end?: Date) => {
      if (!start || !end) return null;
      const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return `${formatTime(start)} - ${formatTime(end)}`;
    };

    const items = serviceOrders.map((so) => ({
      id: so.id,
      businessId: so.businessId,
      status: so.status,
      scheduledDate: so.appointments[0]?.startAt || null,
      timeWindow: formatTimeWindow(so.appointments[0]?.startAt, so.appointments[0]?.endAt),
      customer: {
        id: so.customer?.id,
        displayName: so.customer?.displayName || `${so.customer?.firstName} ${so.customer?.lastName}`,
        phone: so.customer?.phone || so.customer?.cellphone,
        email: so.customer?.email,
      },
      propertyAddress: so.addressRef
        ? `${so.addressRef.line1}, ${so.addressRef.city}, ${so.addressRef.state}`
        : so.serviceRequest?.propertyLabel,
      service: {
        name: so.serviceRequest?.service?.name || 'General Service',
        slug: so.serviceRequest?.service?.slug,
      },
      symptoms: so.serviceRequest?.symptoms || [],
      etaMinutes: so.etas[0]?.minutes || null,
      totalAmountUsd: so.totalUsd,
      createdAt: so.createdAt,
    }));

    return {
      counts: {
        today: todayCount,
        upcoming: upcomingCount,
        active: activeCount,
        completed: completedCount,
      },
      items,
      meta,
    };
  }

  async getMeSchedule(userId: string, query: { from?: string; to?: string }) {
    const technician = await this.getTechnicianByUserId(userId);

    const now = new Date();
    const fromDate = query.from
      ? new Date(query.from)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const toDate = query.to
      ? new Date(query.to)
      : new Date(fromDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        technicianId: technician.id,
        startAt: { gte: fromDate, lte: toDate },
      },
      include: {
        serviceOrder: {
          include: {
            customer: true,
            serviceRequest: { include: { service: true } },
            addressRef: true,
          },
        },
      },
      orderBy: [{ startAt: 'asc' }],
    });

    const formatTimeWindow = (start: Date, end: Date) => {
      const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return `${formatTime(start)} - ${formatTime(end)}`;
    };

    // Group appointments by date (YYYY-MM-DD)
    const groupedMap = new Map<string, any[]>();
    for (const apt of appointments) {
      const dateKey = apt.startAt.toISOString().split('T')[0];
      if (!groupedMap.has(dateKey)) {
        groupedMap.set(dateKey, []);
      }
      groupedMap.get(dateKey)!.push({
        id: apt.id,
        serviceOrderId: apt.serviceOrderId,
        businessId: apt.serviceOrder?.businessId,
        serviceName: apt.serviceOrder?.serviceRequest?.service?.name || 'General Service',
        timeWindow: formatTimeWindow(apt.startAt, apt.endAt),
        status: apt.status,
        customerName: apt.serviceOrder?.customer?.displayName || `${apt.serviceOrder?.customer?.firstName} ${apt.serviceOrder?.customer?.lastName}`,
        customerPhone: apt.serviceOrder?.customer?.phone || apt.serviceOrder?.customer?.cellphone,
        propertyAddress: apt.serviceOrder?.addressRef
          ? `${apt.serviceOrder.addressRef.line1}, ${apt.serviceOrder.addressRef.city}, ${apt.serviceOrder.addressRef.state}`
          : apt.serviceOrder?.serviceRequest?.propertyLabel,
      });
    }

    const todayStr = now.toISOString().split('T')[0];
    const days = Array.from(groupedMap.entries()).map(([date, items]) => ({
      date,
      isToday: date === todayStr,
      appointmentsCount: items.length,
      appointments: items,
    }));

    return {
      range: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      days,
    };
  }

  async requestScheduleChange(userId: string, dto: { serviceOrderId?: string; reason: string; proposedDate?: string; proposedTimeWindow?: string }) {
    const technician = await this.getTechnicianByUserId(userId);

    // Record internal note if service order provided
    if (dto.serviceOrderId) {
      const serviceOrder = await this.prisma.serviceOrder.findUnique({
        where: { id: dto.serviceOrderId },
        select: { customerId: true },
      });

      if (serviceOrder) {
        await this.prisma.customerInternalNote.create({
          data: {
            customerId: serviceOrder.customerId,
            createdById: userId,
            title: 'Schedule Change Request',
            body: `[SCHEDULE CHANGE REQUEST by Tech ${technician.displayName}]: ${dto.reason}. Proposed: ${dto.proposedDate || 'N/A'} (${dto.proposedTimeWindow || 'N/A'})`,
          },
        });
      }
    }

    return {
      success: true,
      message: 'Schedule change request submitted to admin team',
    };
  }
}

