import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AttachmentKind,
  CustomerStatus,
  Prisma,
  RequestUrgency,
  ServiceCatalogStatus,
  ServiceGroup,
  ServiceRequestStatus,
  UserRole,
} from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { generateBusinessId } from 'src/common/utils/business-id.util';
import { getPagination } from 'src/common/utils/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis';
import { CloudinaryUploadService } from 'src/storage/cloudinary-upload.service';
import { FIXED_SERVICES_CATALOG } from './constants/services-catalog.constant';
import { AddServiceRequestAttachmentDto } from './dto/add-service-request-attachment.dto';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { RejectServiceRequestDto } from './dto/reject-service-request.dto';
import { ServiceRequestListQueryDto } from './dto/service-request-list-query.dto';
import { UpdateServiceRequestStatusDto } from './dto/update-service-request-status.dto';

@Injectable()
export class ServiceRequestsService {
  private readonly logger = new Logger(ServiceRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryUploadService,
    private readonly redis: RedisService,
  ) {}

  private async uploadMulterFiles(
    files: Array<Express.Multer.File>,
    folder = 'elite-vacuum/service-requests',
  ) {
    if (!files || files.length === 0) return [];
    return Promise.all(
      files.map(async (file) => {
        const uploaded = await this.cloudinary.uploadFile({
          fileBuffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
          folder,
        });

        const kind = file.mimetype.startsWith('image')
          ? AttachmentKind.PHOTO
          : file.mimetype.startsWith('video')
            ? AttachmentKind.VIDEO
            : AttachmentKind.DOCUMENT;

        return {
          fileName: file.originalname,
          fileType: file.mimetype,
          sizeBytes: file.size,
          url: uploaded.url,
          kind,
          category: 'Issue Attachment',
          note: null as string | null,
        };
      }),
    );
  }

  private isAdmin(user?: RequestUser | null): boolean {
    return user?.role === UserRole.ADMIN;
  }

  private isUuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );
  }

  private async generateRequestBusinessId(): Promise<string> {
    return generateBusinessId('REQ', async (id) => {
      const exists = await this.prisma.serviceRequest.findUnique({
        where: { businessId: id },
        select: { id: true },
      });
      return !!exists;
    });
  }

  /**
   * Resolves or provisions a Customer profile for an intake request.
   */
  private async resolveOrCreateCustomer(
    dto: {
      fullName: string;
      email?: string;
      phone: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    },
    user?: RequestUser | null,
  ): Promise<string> {
    const email = (user?.email || dto.email || '').trim().toLowerCase();

    if (!email) {
      throw new BadRequestException(
        'Email is required to submit a service request (or provide an authentication token)',
      );
    }

    if (user && user.id) {
      const existingByUserId = await this.prisma.customer.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (existingByUserId) return existingByUserId.id;

      const existingByEmail = await this.prisma.customer.findFirst({
        where: { email },
      });
      if (existingByEmail) {
        const updated = await this.prisma.customer.update({
          where: { id: existingByEmail.id },
          data: {
            userId: user.id,
            status: CustomerStatus.ACTIVE,
            phone: dto.phone.trim(),
            displayName: dto.fullName.trim(),
          },
          select: { id: true },
        });
        return updated.id;
      }

      const parts = dto.fullName.trim().split(' ');
      const firstName = parts[0] || 'Customer';
      const lastName = parts.slice(1).join(' ') || '';

      const created = await this.prisma.customer.create({
        data: {
          userId: user.id,
          displayName: dto.fullName.trim(),
          firstName,
          lastName,
          email,
          phone: dto.phone.trim(),
          status: CustomerStatus.ACTIVE,
        },
        select: { id: true },
      });
      return created.id;
    }

    const byEmail = await this.prisma.customer.findFirst({
      where: { email },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;

    // Check if a User exists with this email
    const userRecord = await this.prisma.user.findUnique({
      where: { email },
    });

    const parts = dto.fullName.trim().split(' ');
    const firstName = parts[0] || 'Customer';
    const lastName = parts.slice(1).join(' ') || '';

    const created = await this.prisma.customer.create({
      data: {
        userId: userRecord?.id || null,
        displayName: dto.fullName.trim(),
        firstName,
        lastName,
        email,
        phone: dto.phone.trim(),
        status: userRecord ? CustomerStatus.ACTIVE : CustomerStatus.LEAD,
      },
      select: { id: true },
    });

    return created.id;
  }

  /**
   * Resolves or auto-creates the Service record in database by slug.
   */
  private async resolveService(serviceSlug: string) {
    const slug = serviceSlug.toLowerCase().trim();
    const existing = await this.prisma.service.findUnique({
      where: { slug },
    });
    if (existing) return existing;

    const catalogItem = FIXED_SERVICES_CATALOG.find(
      (s) => s.slug.toLowerCase() === slug,
    );

    const title = catalogItem ? catalogItem.title : serviceSlug;
    const group = catalogItem ? catalogItem.group : ServiceGroup.SERVICE_AND_MAINTENANCE;
    const desc = catalogItem ? catalogItem.description : 'Central vacuum service';

    return this.prisma.service.create({
      data: {
        slug,
        name: title,
        category: group,
        description: desc,
        basePriceUsd: catalogItem?.basePriceUsd
          ? new Prisma.Decimal(catalogItem.basePriceUsd)
          : null,
        status: ServiceCatalogStatus.ACTIVE,
      },
    });
  }

  private requestInclude() {
    return {
      customer: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
        },
      },
      service: {
        select: {
          id: true,
          slug: true,
          name: true,
          category: true,
          basePriceUsd: true,
        },
      },
      equipment: true,
      attachments: {
        orderBy: { uploadedAt: 'asc' },
      },
      rejectionHistory: {
        orderBy: { rejectedAt: 'desc' },
      },
      appointments: {
        include: {
          technician: {
            select: {
              id: true,
              displayName: true,
              phone: true,
              rating: true,
            },
          },
        },
        orderBy: { startAt: 'desc' },
      },
      serviceOrder: {
        select: {
          id: true,
          businessId: true,
          status: true,
          scheduledAt: true,
          totalUsd: true,
        },
      },
      quotations: {
        select: {
          id: true,
          businessId: true,
          status: true,
          totalUsd: true,
          expiresAt: true,
        },
      },
    } satisfies Prisma.ServiceRequestInclude;
  }

  // ==========================================
  // INTAKE & CREATION
  // ==========================================

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

  private parseTimeWindow(dateStr: string, timeWindow: string): { startAt: Date; endAt: Date } {
    const parts = timeWindow.split('-');
    const startStr = (parts[0] || '09:00 AM').trim();
    const endStr = (parts[1] || '11:00 AM').trim();
    const startAt = this.parseDateTime(dateStr, startStr);
    const endAt = this.parseDateTime(dateStr, endStr);
    return { startAt, endAt };
  }

  async createRequest(
    dto: CreateServiceRequestDto,
    files?: Array<Express.Multer.File>,
    user?: RequestUser | null,
  ) {
    const customerId = await this.resolveOrCreateCustomer(dto, user);
    const service = await this.resolveService(dto.serviceSlug);
    const businessId = await this.generateRequestBusinessId();

    // 1. Validate requested slot availability against active capacity
    const { startAt, endAt } = this.parseTimeWindow(dto.preferredDate, dto.timeWindow);

    const activeTechCount = await this.prisma.technician.count({
      where: { status: 'ACTIVE' },
    });
    const maxCapacity = Math.max(1, activeTechCount);

    const overlappingBookings = await this.prisma.appointment.count({
      where: {
        status: { notIn: ['CANCELLED'] },
        OR: [
          { startAt: { lt: endAt }, endAt: { gt: startAt } },
          { startAt: startAt },
        ],
      },
    });

    if (overlappingBookings >= maxCapacity) {
      throw new BadRequestException(
        `The selected time window '${dto.timeWindow}' on ${dto.preferredDate} is already fully booked. Please choose another time slot.`,
      );
    }

    // Upload any multipart files to Cloudinary
    const uploadedAttachments =
      files && files.length > 0
        ? await this.uploadMulterFiles(files)
        : [];
    const allAttachments = [
      ...uploadedAttachments,
      ...(dto.attachments || []),
    ];

    const effectiveEmail = (user?.email || dto.email || '').trim().toLowerCase();

    const serviceAddressSnapshot = {
      address: dto.address.trim(),
      city: dto.city.trim(),
      state: dto.state.trim(),
      zipCode: dto.zipCode.trim(),
      problemLocation: dto.problemLocation?.trim() || null,
      contactName: dto.fullName.trim(),
      contactPhone: dto.phone.trim(),
      contactEmail: effectiveEmail,
    };

    const requestedScheduleSnapshot = {
      preferredDate: dto.preferredDate.trim(),
      timeWindow: dto.timeWindow.trim(),
      submittedAt: new Date().toISOString(),
    };

    const title = `${service.name} Request - ${dto.city}, ${dto.state}`;

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Service Request record
      const request = await tx.serviceRequest.create({
        data: {
          businessId,
          customerId,
          serviceId: service.id,
          title,
          description: dto.problemDescription.trim(),
          symptoms: dto.symptoms || [],
          status: ServiceRequestStatus.SUBMITTED,
          urgency: RequestUrgency.MEDIUM,
          preferredDate: dto.preferredDate.trim(),
          preferredTime: dto.timeWindow.trim(),
          propertyLabel: `${dto.city}, ${dto.state}`.trim(),
          serviceAddress: serviceAddressSnapshot,
          requestedSchedule: requestedScheduleSnapshot,
          currentSchedule: requestedScheduleSnapshot,
          problemLocation: dto.problemLocation?.trim() || null,
          additionalNotes: dto.additionalNotes?.trim() || null,
        },
      });

      // 2. Create Equipment record if provided
      if (
        dto.manufacturer ||
        dto.modelNumber ||
        dto.serialNumber ||
        dto.unitLocation
      ) {
        await tx.serviceRequestEquipment.create({
          data: {
            serviceRequestId: request.id,
            manufacturer: dto.manufacturer?.trim() || null,
            modelNumber: dto.modelNumber?.trim() || null,
            serialNumber: dto.serialNumber?.trim() || null,
            unitLocation: dto.unitLocation?.trim() || null,
          },
        });
      }

      // 3. Create Attachments if provided or uploaded
      if (allAttachments.length > 0) {
        await tx.serviceRequestAttachment.createMany({
          data: allAttachments.map((att) => ({
            serviceRequestId: request.id,
            fileName: att.fileName.trim(),
            fileType: att.fileType.trim(),
            sizeBytes: att.sizeBytes,
            url: att.url.trim(),
            kind: att.kind,
            category: att.category?.trim() || null,
            note: att.note?.trim() || null,
          })),
        });
      }

      // 4. Immediately create Appointment record to lock and book the requested slot in the system
      await tx.appointment.create({
        data: {
          serviceRequestId: request.id,
          status: 'CONFIRMED',
          startAt,
          endAt,
          addressSnapshot: serviceAddressSnapshot,
          notes: `Customer booking: ${dto.timeWindow} on ${dto.preferredDate}`,
        },
      });

      const fullRecord = await tx.serviceRequest.findUnique({
        where: { id: request.id },
        include: this.requestInclude(),
      });

      // Invalidate cached schedule slots for preferredDate
      this.redis
        .deleteByPattern(`schedule:slots:${dto.preferredDate}:*`)
        .catch((err) => {
          this.logger.warn(`Redis slot invalidation note: ${err.message}`);
        });

      return {
        success: true,
        message: 'Service intake request submitted successfully and time slot reserved',
        businessId: request.businessId,
        request: fullRecord,
      };
    });
  }

  // ==========================================
  // REQUEST QUERIES
  // ==========================================

  async getMyRequests(
    query: ServiceRequestListQueryDto,
    user: RequestUser,
  ) {
    const userEmail = user.email.trim().toLowerCase();
    let customer = await this.prisma.customer.findFirst({
      where: {
        OR: [
          { userId: user.id },
          { email: userEmail },
        ],
      },
    });

    if (customer && !customer.userId) {
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: { userId: user.id, status: CustomerStatus.ACTIVE },
      });
    }

    if (!customer) {
      return {
        items: [],
        meta: { page: query.page || 1, limit: query.limit || 10, total: 0, totalPages: 0 },
      };
    }

    const where: Prisma.ServiceRequestWhereInput = {
      customerId: customer.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.urgency ? { urgency: query.urgency } : {}),
      ...(query.serviceSlug
        ? { service: { slug: query.serviceSlug.toLowerCase().trim() } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { businessId: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const totalItems = await this.prisma.serviceRequest.count({ where });
    const { skip, take, meta } = getPagination(
      query.page,
      query.limit,
      totalItems,
    );

    const sortBy = query.sortBy || 'submittedAt';
    const sortOrder = query.sortOrder || 'desc';

    const items = await this.prisma.serviceRequest.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: this.requestInclude(),
    });

    return {
      items,
      meta,
    };
  }

  async getAdminRequests(query: ServiceRequestListQueryDto) {
    const where: Prisma.ServiceRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.urgency ? { urgency: query.urgency } : {}),
      ...(query.serviceSlug
        ? { service: { slug: query.serviceSlug.toLowerCase().trim() } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { businessId: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
              {
                customer: {
                  displayName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                customer: {
                  email: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                customer: {
                  phone: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            submittedAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const totalItems = await this.prisma.serviceRequest.count({ where });
    const { skip, take, meta } = getPagination(
      query.page,
      query.limit,
      totalItems,
    );

    const sortBy = query.sortBy || 'submittedAt';
    const sortOrder = query.sortOrder || 'desc';

    const [items, submittedCount, underReviewCount, acceptedCount, rejectedCount, scheduledCount] =
      await Promise.all([
        this.prisma.serviceRequest.findMany({
          where,
          skip,
          take,
          orderBy: { [sortBy]: sortOrder },
          include: this.requestInclude(),
        }),
        this.prisma.serviceRequest.count({ where: { status: ServiceRequestStatus.SUBMITTED } }),
        this.prisma.serviceRequest.count({ where: { status: ServiceRequestStatus.UNDER_REVIEW } }),
        this.prisma.serviceRequest.count({ where: { status: ServiceRequestStatus.ACCEPTED } }),
        this.prisma.serviceRequest.count({ where: { status: ServiceRequestStatus.REJECTED } }),
        this.prisma.serviceRequest.count({ where: { status: ServiceRequestStatus.SCHEDULED } }),
      ]);

    return {
      items,
      meta: {
        ...meta,
        kpi: {
          submitted: submittedCount,
          underReview: underReviewCount,
          accepted: acceptedCount,
          rejected: rejectedCount,
          scheduled: scheduledCount,
          total: totalItems,
        },
      },
    };
  }

  async getRequestDetails(
    idOrBusinessId: string,
    user?: RequestUser | null,
  ) {
    const isUuid = this.isUuid(idOrBusinessId);

    const request = await this.prisma.serviceRequest.findFirst({
      where: isUuid
        ? { id: idOrBusinessId }
        : { businessId: idOrBusinessId },
      include: this.requestInclude(),
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (!this.isAdmin(user)) {
      if (!user || user.id !== request.customer.userId) {
        throw new ForbiddenException('You do not have permission to view this service request');
      }
    }

    return request;
  }

  // ==========================================
  // ADMIN STATUS TRANSITIONS & TRIAGE
  // ==========================================

  async updateStatus(
    id: string,
    dto: UpdateServiceRequestStatusDto,
    user: RequestUser,
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: dto.status,
      },
      include: this.requestInclude(),
    });

    this.logger.log(
      `Service Request '${request.businessId}' status updated to '${dto.status}' by ${user.email}`,
    );

    return {
      success: true,
      message: `Service request status updated to '${dto.status}'`,
      request: updated,
    };
  }

  async rejectRequest(
    id: string,
    dto: RejectServiceRequestDto,
    user: RequestUser,
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.status === ServiceRequestStatus.REJECTED) {
      throw new BadRequestException('Service request is already marked as REJECTED');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceRequest.update({
        where: { id },
        data: { status: ServiceRequestStatus.REJECTED },
      });

      await tx.serviceRequestRejection.create({
        data: {
          serviceRequestId: id,
          reason: dto.reason.trim(),
          comments: dto.comments?.trim() || null,
          actorLabel: `Admin (${user.email})`,
        },
      });

      const fullRecord = await tx.serviceRequest.findUnique({
        where: { id },
        include: this.requestInclude(),
      });

      return {
        success: true,
        message: 'Service request rejected and audit note recorded',
        request: fullRecord,
      };
    });
  }

  async addAttachments(
    id: string,
    dto?: AddServiceRequestAttachmentDto,
    files?: Array<Express.Multer.File>,
    user?: RequestUser | null,
  ) {
    const request = await this.getRequestDetails(id, user);

    const uploaded =
      files && files.length > 0 ? await this.uploadMulterFiles(files) : [];
    const allAttachments = [...uploaded, ...(dto?.attachments || [])];

    if (allAttachments.length === 0) {
      throw new BadRequestException('No attachments or files provided');
    }

    await this.prisma.serviceRequestAttachment.createMany({
      data: allAttachments.map((att) => ({
        serviceRequestId: request.id,
        fileName: att.fileName.trim(),
        fileType: att.fileType.trim(),
        sizeBytes: att.sizeBytes,
        url: att.url.trim(),
        kind: att.kind,
        category: att.category?.trim() || null,
        note: att.note?.trim() || null,
      })),
    });

    return this.getRequestDetails(id, user);
  }
}
