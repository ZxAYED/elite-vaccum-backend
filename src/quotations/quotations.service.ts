import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  QuotationStatus,
  ServiceOrderStatus,
  ServiceRequestStatus,
  UserRole,
} from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { generateBusinessId } from 'src/common/utils/business-id.util';
import { getPagination } from 'src/common/utils/pagination';
import { EmailService } from 'src/email/email.service';
import { EmailTemplateKey } from 'src/email/types/email.types';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import {
  QuotationDecisionAction,
  QuotationListQueryDto,
  RejectQuotationDto,
  UpdateQuotationDto,
  UpdateQuotationStatusDto,
} from './dto/update-quotation.dto';

@Injectable()
export class QuotationsService {
  private readonly logger = new Logger(QuotationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly redis: RedisService,
  ) {}

  private isAdmin(user?: RequestUser | null) {
    return user?.role === UserRole.ADMIN;
  }

  private async generateQuotationBusinessId(): Promise<string> {
    return generateBusinessId('QUO', async (id) => {
      const exists = await this.prisma.quotation.findUnique({
        where: { businessId: id },
        select: { id: true },
      });
      return !!exists;
    });
  }

  private async generateServiceOrderBusinessId(): Promise<string> {
    return generateBusinessId('SO', async (id) => {
      const exists = await this.prisma.serviceOrder.findUnique({
        where: { businessId: id },
        select: { id: true },
      });
      return !!exists;
    });
  }

  private quotationInclude() {
    return {
      customer: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          email: true,
          phone: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
        },
      },
      serviceRequest: {
        select: {
          id: true,
          businessId: true,
          title: true,
          status: true,
          preferredDate: true,
          preferredTime: true,
          serviceAddress: true,
        },
      },
      lineItems: {
        orderBy: { sortOrder: 'asc' },
      },
      revisionHistory: {
        orderBy: { version: 'desc' },
      },
      rejectionHistory: {
        orderBy: { rejectedAt: 'desc' },
      },
      serviceOrder: {
        select: {
          id: true,
          businessId: true,
          status: true,
          scheduledAt: true,
        },
      },
    } satisfies Prisma.QuotationInclude;
  }


  // CREATE QUOTATION


  async create(dto: CreateQuotationDto, user: RequestUser) {
    const serviceRequest = await this.prisma.serviceRequest.findUnique({
      where: { id: dto.serviceRequestId },
      include: { customer: true, service: true },
    });

    if (!serviceRequest) {
      throw new NotFoundException('Service request not found');
    }

    if (dto.lineItems.length === 0) {
      throw new BadRequestException('Quotation must contain at least one itemized line item');
    }

    const businessId = await this.generateQuotationBusinessId();

    const subtotal = dto.lineItems.reduce(
      (sum, item) => sum + item.unitPriceUsd * item.quantity,
      0,
    );
    const discount = dto.discountUsd || 0;
    const tax = dto.taxUsd || 0;
    const total = Math.max(0, subtotal - discount + tax);

    return this.prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          businessId,
          serviceRequestId: serviceRequest.id,
          customerId: serviceRequest.customerId,
          serviceId: serviceRequest.serviceId,
          status: QuotationStatus.SENT,
          sentAt: new Date(),
          version: 1,
          subtotalUsd: new Prisma.Decimal(subtotal),
          discountUsd: new Prisma.Decimal(discount),
          taxUsd: new Prisma.Decimal(tax),
          totalUsd: new Prisma.Decimal(total),
          notes: dto.notes?.trim() || null,
          terms: dto.terms?.trim() || null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          lineItems: {
            create: dto.lineItems.map((item, idx) => ({
              description: item.description.trim(),
              quantity: item.quantity,
              unitPriceUsd: new Prisma.Decimal(item.unitPriceUsd),
              totalUsd: new Prisma.Decimal(item.unitPriceUsd * item.quantity),
              note: item.note?.trim() || null,
              sortOrder: idx + 1,
            })),
          },
        },
        include: this.quotationInclude(),
      });

      await tx.serviceRequest.update({
        where: { id: serviceRequest.id },
        data: {
          status: ServiceRequestStatus.QUOTED,
          estimatedAmountUsd: new Prisma.Decimal(total),
        },
      });

      this.logger.log(`Quotation '${quotation.businessId}' created and automatically sent to customer (${serviceRequest.customer?.email}) by Admin (${user.email})`);

      // Dispatch real-time in-app notification & BullMQ email to customer
      if (serviceRequest.customer?.userId) {
        this.notificationsService
          .create({
            userId: serviceRequest.customer.userId,
            type: NotificationType.QUOTATION_UPDATE,
            title: `Quotation Prepared for Service Request ${serviceRequest.businessId}`,
            message: `A new itemized quotation (${quotation.businessId}) totaling $${total.toFixed(2)} USD is ready for your review.`,
            ctaLabel: 'Review Quotation',
            ctaUrl: `/quotations/${quotation.id}`,
            metadata: {
              quotationId: quotation.id,
              serviceRequestId: serviceRequest.id,
              totalUsd: total,
            },
            sendEmail: true,
            priority: 1,
          })
          .catch((err) => {
            this.logger.warn(`Failed to dispatch quotation notification: ${err.message}`);
          });
      }

      // Dispatch quotation notification email to customer
      if (serviceRequest.customer?.email) {
        this.emailService
          .sendTemplateEmail({
            to: serviceRequest.customer.email,
            template: EmailTemplateKey.QUOTATION_EVENT,
            payload: {
              subject: `Quotation Prepared for Service Request ${serviceRequest.businessId}`,
              message: `A new itemized quotation (${quotation.businessId}) totaling $${total.toFixed(2)} USD has been prepared and sent for your review. Please sign in to your account to review and accept.`,
            },
          })
          .catch((err) => {
            this.logger.warn(`Failed to dispatch quotation notification email to ${serviceRequest.customer?.email}: ${err.message}`);
          });
      }

      return {
        success: true,
        message: 'Quotation created and sent to customer successfully',
        quotation,
      };
    });
  }


  // LIST QUOTATIONS


  async findAll(query: QuotationListQueryDto) {
    const where: Prisma.QuotationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { businessId: { contains: query.search, mode: 'insensitive' } },
              { customer: { displayName: { contains: query.search, mode: 'insensitive' } } },
              { customer: { email: { contains: query.search, mode: 'insensitive' } } },
              { serviceRequest: { businessId: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const totalItems = await this.prisma.quotation.count({ where });
    const { skip, take, meta } = getPagination(query.page, query.limit, totalItems);

    const [items, draftCount, sentCount, acceptedCount, rejectedCount] =
      await Promise.all([
        this.prisma.quotation.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: this.quotationInclude(),
        }),
        this.prisma.quotation.count({ where: { status: QuotationStatus.DRAFT } }),
        this.prisma.quotation.count({ where: { status: QuotationStatus.SENT } }),
        this.prisma.quotation.count({ where: { status: QuotationStatus.ACCEPTED } }),
        this.prisma.quotation.count({ where: { status: QuotationStatus.REJECTED } }),
      ]);

    return {
      items,
      meta: {
        ...meta,
        kpi: {
          draft: draftCount,
          sent: sentCount,
          accepted: acceptedCount,
          rejected: rejectedCount,
          total: totalItems,
        },
      },
    };
  }

  async getMyQuotations(query: QuotationListQueryDto, user: RequestUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!customer) {
      return { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
    }

    const where: Prisma.QuotationWhereInput = {
      customerId: customer.id,
      status: { notIn: [QuotationStatus.DRAFT] }, // Customers only see sent/accepted/rejected quotes
      ...(query.status ? { status: query.status } : {}),
    };

    const totalItems = await this.prisma.quotation.count({ where });
    const { skip, take, meta } = getPagination(query.page, query.limit, totalItems);

    const items = await this.prisma.quotation.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: this.quotationInclude(),
    });

    return { items, meta };
  }

  async findOne(id: string, user?: RequestUser | null) {
    const quotation = await this.prisma.quotation.findFirst({
      where: {
        OR: [{ id }, { businessId: id }],
      },
      include: this.quotationInclude(),
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (!this.isAdmin(user)) {
      if (!user || user.id !== quotation.customer.userId) {
        throw new ForbiddenException('You do not have permission to view this quotation');
      }
      // If customer views a SENT quotation, mark as VIEWED
      if (quotation.status === QuotationStatus.SENT) {
        await this.prisma.quotation.update({
          where: { id: quotation.id },
          data: { status: QuotationStatus.VIEWED, viewedAt: new Date() },
        });
        quotation.status = QuotationStatus.VIEWED;
      }
    }

    return quotation;
  }


  // UPDATE / REVISE QUOTATION


  async update(id: string, dto: UpdateQuotationDto, user: RequestUser) {
    const existing = await this.prisma.quotation.findUnique({
      where: { id },
      include: { lineItems: true },
    });

    if (!existing) {
      throw new NotFoundException('Quotation not found');
    }

    if (existing.status === QuotationStatus.ACCEPTED) {
      throw new BadRequestException('Cannot modify an already accepted quotation');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Capture snapshot into QuotationRevision
      await tx.quotationRevision.create({
        data: {
          quotationId: existing.id,
          version: existing.version,
          status: existing.status,
          subtotalUsd: existing.subtotalUsd,
          discountUsd: existing.discountUsd,
          taxUsd: existing.taxUsd,
          totalUsd: existing.totalUsd,
          reason: dto.revisionReason?.trim() || `Revised by Admin (${user.email})`,
          snapshotData: {
            lineItems: existing.lineItems,
            notes: existing.notes,
            terms: existing.terms,
          },
        },
      });

      // 2. Recompute totals if lineItems provided
      let subtotal = Number(existing.subtotalUsd);
      let discount = dto.discountUsd !== undefined ? dto.discountUsd : Number(existing.discountUsd);
      let tax = dto.taxUsd !== undefined ? dto.taxUsd : Number(existing.taxUsd);

      if (dto.lineItems && dto.lineItems.length > 0) {
        subtotal = dto.lineItems.reduce(
          (sum, item) => sum + item.unitPriceUsd * item.quantity,
          0,
        );

        // Delete old line items and replace
        await tx.quotationLineItem.deleteMany({ where: { quotationId: id } });
        await tx.quotationLineItem.createMany({
          data: dto.lineItems.map((item, idx) => ({
            quotationId: id,
            description: item.description.trim(),
            quantity: item.quantity,
            unitPriceUsd: new Prisma.Decimal(item.unitPriceUsd),
            totalUsd: new Prisma.Decimal(item.unitPriceUsd * item.quantity),
            note: item.note?.trim() || null,
            sortOrder: idx + 1,
          })),
        });
      }

      const total = Math.max(0, subtotal - discount + tax);

      const updated = await tx.quotation.update({
        where: { id },
        data: {
          version: existing.version + 1,
          subtotalUsd: new Prisma.Decimal(subtotal),
          discountUsd: new Prisma.Decimal(discount),
          taxUsd: new Prisma.Decimal(tax),
          totalUsd: new Prisma.Decimal(total),
          notes: dto.notes !== undefined ? dto.notes?.trim() || null : existing.notes,
          terms: dto.terms !== undefined ? dto.terms?.trim() || null : existing.terms,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : existing.expiresAt,
        },
        include: this.quotationInclude(),
      });

      return {
        success: true,
        message: 'Quotation revised successfully and revision history captured',
        quotation: updated,
      };
    });
  }


  // ACCEPT / REJECT / STATUS


  async accept(id: string, user: RequestUser) {
    if (!user) {
      throw new ForbiddenException('Authentication is required');
    }

    if (this.isAdmin(user)) {
      throw new ForbiddenException('Admin cannot accept quotations. Only the customer can accept this quotation.');
    }

    const lockKey = `quotation:action:${id}`;
    const lockToken = await this.redis.acquireLock(lockKey, {
      ttlMs: 15000,
      retryCount: 1,
      retryDelayMs: 300,
    });

    if (!lockToken) {
      throw new BadRequestException(
        'A status update is currently in progress for this quotation. Please wait a moment.',
      );
    }

    try {
      const quotation = await this.prisma.quotation.findUnique({
        where: { id },
        include: { serviceRequest: true, customer: true, lineItems: true },
      });

      if (!quotation) throw new NotFoundException('Quotation not found');

      if (
        quotation.customer.userId !== user.id &&
        quotation.customer.email.toLowerCase() !== user.email?.toLowerCase()
      ) {
        throw new ForbiddenException('You do not have permission to accept this quotation');
      }

      if (quotation.status === QuotationStatus.ACCEPTED) {
        throw new BadRequestException('Quotation has already been accepted');
      }

      const serviceOrderBusinessId = await this.generateServiceOrderBusinessId();

      return await this.prisma.$transaction(async (tx) => {
        // 1. Mark Quotation Accepted
        const updatedQuotation = await tx.quotation.update({
          where: { id },
          data: {
            status: QuotationStatus.ACCEPTED,
            acceptedAt: new Date(),
          },
        });

        // 2. Auto-Provision Service Order linked to Quotation
        const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Defaults next day
        const serviceOrder = await tx.serviceOrder.create({
          data: {
            businessId: serviceOrderBusinessId,
            serviceRequestId: quotation.serviceRequestId,
            quotationId: quotation.id,
            customerId: quotation.customerId,
            status: ServiceOrderStatus.SCHEDULED,
            scheduledAt,
            estimatedDurationMin: 90,
            totalUsd: quotation.totalUsd,
            summary: `Service Order for ${quotation.serviceRequest.title}`,
            customerNotes: quotation.serviceRequest.description,
            adminInstructions: quotation.notes || 'Proceed with approved quotation items',
          },
        });

        // 3. Link Service Order back to Quotation
        await tx.quotation.update({
          where: { id },
          data: { serviceOrderId: serviceOrder.id },
        });

        // 4. Update Service Request status
        await tx.serviceRequest.update({
          where: { id: quotation.serviceRequestId },
          data: { status: ServiceRequestStatus.ACCEPTED },
        });

        // 5. Record initial status history
        await tx.serviceOrderStatusHistory.create({
          data: {
            serviceOrderId: serviceOrder.id,
            fromStatus: ServiceOrderStatus.SCHEDULED,
            toStatus: ServiceOrderStatus.SCHEDULED,
            note: `Service Order automatically created upon acceptance of Quotation ${quotation.businessId}`,
            actorLabel: `Customer (${user.email})`,
          },
        });

        const fullQuotation = await tx.quotation.findUnique({
          where: { id },
          include: this.quotationInclude(),
        });

        // Dispatch Admin Real-Time Notification
        this.notificationsService
          .notifyAdmins({
            type: NotificationType.QUOTATION_UPDATE,
            title: `Quotation ${quotation.businessId} Accepted`,
            message: `Customer ${quotation.customer.displayName || quotation.customer.email} accepted Quotation ${quotation.businessId} ($${Number(quotation.totalUsd).toFixed(2)}). Service Order ${serviceOrder.businessId} created.`,
            ctaLabel: 'View Service Order',
            ctaUrl: `/admin/service-orders/${serviceOrder.id}`,
            metadata: {
              quotationId: quotation.id,
              serviceOrderId: serviceOrder.id,
              totalUsd: quotation.totalUsd,
            },
            priority: 1,
          })
          .catch((err) => {
            this.logger.warn(`Failed to notify admins of quotation acceptance: ${err.message}`);
          });

        return {
          success: true,
          message: 'Quotation accepted and Service Order generated successfully',
          quotation: fullQuotation,
          serviceOrder,
        };
      });
    } finally {
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  async reject(id: string, dto: RejectQuotationDto, user: RequestUser) {
    if (!user) {
      throw new ForbiddenException('Authentication is required');
    }

    if (this.isAdmin(user)) {
      throw new ForbiddenException('Admin cannot reject quotations. Only the customer can reject this quotation.');
    }

    const lockKey = `quotation:action:${id}`;
    const lockToken = await this.redis.acquireLock(lockKey, {
      ttlMs: 15000,
      retryCount: 1,
      retryDelayMs: 300,
    });

    if (!lockToken) {
      throw new BadRequestException(
        'A status update is currently in progress for this quotation.',
      );
    }

    try {
      const quotation = await this.prisma.quotation.findUnique({
        where: { id },
        include: { customer: true },
      });

      if (!quotation) throw new NotFoundException('Quotation not found');

      if (
        quotation.customer.userId !== user.id &&
        quotation.customer.email.toLowerCase() !== user.email?.toLowerCase()
      ) {
        throw new ForbiddenException('You do not have permission to reject this quotation');
      }

      if (quotation.status === QuotationStatus.ACCEPTED) {
        throw new BadRequestException('Cannot reject an already accepted quotation');
      }

      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.quotation.update({
          where: { id },
          data: {
            status: QuotationStatus.REJECTED,
            rejectedAt: new Date(),
          },
        });

        await tx.quotationRejection.create({
          data: {
            quotationId: id,
            reason: dto.reason.trim(),
            comments: dto.comments?.trim() || null,
            actorLabel: `Customer (${user.email})`,
          },
        });

        const fullQuotation = await tx.quotation.findUnique({
          where: { id },
          include: this.quotationInclude(),
        });

        // Dispatch Admin Real-Time Notification
        this.notificationsService
          .notifyAdmins({
            type: NotificationType.QUOTATION_UPDATE,
            title: `Quotation ${quotation.businessId} Rejected`,
            message: `Customer ${quotation.customer.displayName || quotation.customer.email} rejected Quotation ${quotation.businessId}. Reason: ${dto.reason}`,
            ctaLabel: 'View Quotation',
            ctaUrl: `/admin/quotations/${id}`,
            metadata: {
              quotationId: id,
              reason: dto.reason,
            },
            priority: 2,
          })
          .catch((err) => {
            this.logger.warn(`Failed to notify admins of quotation rejection: ${err.message}`);
          });

        return {
          success: true,
          message: 'Quotation rejected successfully',
          quotation: fullQuotation,
        };
      });
    } finally {
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }


  // UNIFIED STATUS / DECISION ENDPOINT


  async updateStatus(
    id: string,
    dto: UpdateQuotationStatusDto,
    user: RequestUser,
  ) {
    if (dto.action === QuotationDecisionAction.ACCEPTED) {
      return this.accept(id, user);
    }

    if (dto.action === QuotationDecisionAction.REJECTED) {
      const reason = dto.reason?.trim() || 'Declined by customer';
      return this.reject(id, { reason, comments: dto.comments }, user);
    }

    throw new BadRequestException(`Invalid quotation decision action '${(dto as any).action}'`);
  }
}
