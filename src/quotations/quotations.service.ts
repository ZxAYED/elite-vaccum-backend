import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  NotificationType,
  PaymentStatus,
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
import Stripe from 'stripe';
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
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly redis: RedisService,
  ) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && stripeKey.trim().length > 0 && !stripeKey.includes('...')) {
      this.stripe = new Stripe(stripeKey);
      this.logger.log('Stripe initialized for quotations checkout');
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY is unconfigured in .env. Quotations checkout sessions will operate in mock preview mode.',
      );
    }
  }

  private isAdmin(user?: RequestUser | null) {
    return user?.role === UserRole.ADMIN;
  }

  private isUuid(val: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
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

  private async generateInvoiceBusinessId(): Promise<string> {
    return generateBusinessId('INV', async (id) => {
      const exists = await this.prisma.invoice.findUnique({
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
      invoices: {
        include: {
          payments: true,
          lineItems: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    } satisfies Prisma.QuotationInclude;
  }


  // CREATE QUOTATION


  async create(
    dto: CreateQuotationDto,
    user: RequestUser,
    serviceRequestIdOverride?: string,
  ) {
    const targetRequestId = serviceRequestIdOverride || dto.serviceRequestId;
    if (!targetRequestId) {
      throw new BadRequestException('serviceRequestId is required to create a quotation');
    }

    const isUuid = this.isUuid(targetRequestId);
    const serviceRequest = await this.prisma.serviceRequest.findFirst({
      where: isUuid ? { id: targetRequestId } : { businessId: targetRequestId },
      include: { customer: true, service: true },
    });

    if (!serviceRequest) {
      throw new NotFoundException('Service request not found');
    }

    if (dto.lineItems.length === 0) {
      throw new BadRequestException('Quotation must contain at least one itemized line item');
    }

    // Auto-expire any past-due pending quotations
    const now = new Date();
    await this.prisma.quotation.updateMany({
      where: {
        serviceRequestId: serviceRequest.id,
        status: QuotationStatus.SENT,
        expiresAt: { lt: now },
      },
      data: {
        status: QuotationStatus.EXPIRED,
      },
    });

    // Enforce only one active quotation at a time per service request
    const activeQuotation = await this.prisma.quotation.findFirst({
      where: {
        serviceRequestId: serviceRequest.id,
        status: { in: [QuotationStatus.DRAFT, QuotationStatus.SENT, QuotationStatus.ACCEPTED] },
      },
    });

    if (activeQuotation) {
      throw new BadRequestException(
        `An active quotation (${activeQuotation.businessId}) with status '${activeQuotation.status}' already exists for this service request. Only one active quotation is allowed at a time. You can modify it, delete it, or wait until it is rejected or expired before creating a new one.`,
      );
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

      // Resolve recipient customer user ID (handles unlinked guests who now have user accounts)
      let targetUserId = serviceRequest.customer?.userId;
      if (!targetUserId && serviceRequest.customer?.email) {
        const foundUser = await this.prisma.user.findFirst({
          where: { email: { equals: serviceRequest.customer.email.trim(), mode: 'insensitive' } },
          select: { id: true },
        });
        if (foundUser) {
          targetUserId = foundUser.id;
          if (serviceRequest.customer?.id) {
            await this.prisma.customer.update({
              where: { id: serviceRequest.customer.id },
              data: { userId: foundUser.id },
            }).catch(() => {});
          }
        }
      }

      // Dispatch real-time in-app notification & BullMQ email to customer
      if (targetUserId) {
        this.notificationsService
          .create({
            userId: targetUserId,
            type: NotificationType.QUOTATION_UPDATE,
            title: `Quotation Prepared for Service Request ${serviceRequest.businessId}`,
            message: `A new itemized quotation (${quotation.businessId}) totaling $${total.toFixed(2)} USD is ready for your review.`,
            ctaLabel: 'Review Quotation',
            ctaUrl: `/user/services/${serviceRequest.id}`,
            metadata: {
              quotationId: quotation.id,
              quotationBusinessId: quotation.businessId,
              serviceRequestId: serviceRequest.id,
              serviceRequestBusinessId: serviceRequest.businessId,
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
      include: { lineItems: true, customer: true, serviceRequest: true },
    });

    if (!existing) {
      throw new NotFoundException('Quotation not found');
    }

    if (existing.status === QuotationStatus.ACCEPTED) {
      throw new BadRequestException(
        'Cannot modify an already accepted quotation. Quotation has been approved by the customer and is finalized.',
      );
    }

    if (existing.status === QuotationStatus.REJECTED) {
      throw new BadRequestException(
        'Cannot modify a rejected quotation. Once declined by the customer, the quotation is finalized and cannot be modified.',
      );
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

      // Notify customer of revised quotation
      let recipientUserId = existing.customer?.userId;
      if (!recipientUserId && existing.customer?.email) {
        const foundUser = await this.prisma.user.findFirst({
          where: { email: { equals: existing.customer.email.trim(), mode: 'insensitive' } },
          select: { id: true },
        });
        if (foundUser) recipientUserId = foundUser.id;
      }

      if (recipientUserId) {
        this.notificationsService
          .create({
            userId: recipientUserId,
            type: NotificationType.QUOTATION_UPDATE,
            title: `Quotation Revised for Service Request ${existing.serviceRequest?.businessId || existing.businessId}`,
            message: `Quotation ${existing.businessId} (v${updated.version}) has been updated with revised items totaling $${total.toFixed(2)} USD.`,
            ctaLabel: 'Review Quotation',
            ctaUrl: `/user/services/${existing.serviceRequestId}`,
            metadata: {
              quotationId: updated.id,
              quotationBusinessId: updated.businessId,
              serviceRequestId: existing.serviceRequestId,
              totalUsd: total,
              version: updated.version,
            },
            sendEmail: true,
            priority: 1,
          })
          .catch((err) => {
            this.logger.warn(`Failed to dispatch quotation revision notification: ${err.message}`);
          });
      }

      return {
        success: true,
        message: 'Quotation revised successfully and revision history captured',
        quotation: updated,
      };
    });
  }


  // ACCEPT / REJECT / STATUS


  /**
   * Generates a Stripe Checkout Session for a quotation.
   */
  async createStripeCheckoutSessionForQuotation(
    quotation: any,
    user?: RequestUser | null,
  ): Promise<{ id: string; url: string }> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const successUrl = (
      process.env.STRIPE_QUOTATION_SUCCESS_URL ||
      `${frontendUrl}/user/quotations/${quotation.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`
    )
      .replace('{QUOTATION_ID}', quotation.id)
      .replace('{BUSINESS_ID}', quotation.businessId);

    const cancelUrl = (
      process.env.STRIPE_QUOTATION_CANCEL_URL ||
      `${frontendUrl}/user/quotations/${quotation.id}?payment=cancelled`
    )
      .replace('{QUOTATION_ID}', quotation.id)
      .replace('{BUSINESS_ID}', quotation.businessId);

    if (!this.stripe) {
      return {
        id: `mock_cs_quo_${quotation.id.slice(0, 8)}`,
        url: `${frontendUrl}/user/quotations/${quotation.id}?payment=success&session_id=mock_cs_quo_${quotation.id.slice(0, 8)}`,
      };
    }

    try {
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        quotation.lineItems.map((item: any) => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.description || `Service Item`,
            },
            unit_amount: Math.round(Number(item.unitPriceUsd) * 100),
          },
          quantity: item.quantity,
        }));

      if (Number(quotation.taxUsd) > 0) {
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Estimated Service Tax',
            },
            unit_amount: Math.round(Number(quotation.taxUsd) * 100),
          },
          quantity: 1,
        });
      }

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: lineItems,
        customer_email: quotation.customer?.email || user?.email || undefined,
        client_reference_id: quotation.id,
        metadata: {
          type: 'QUOTATION',
          quotationId: quotation.id,
          quotationBusinessId: quotation.businessId,
          serviceRequestId: quotation.serviceRequestId,
          customerId: quotation.customerId,
          totalUsd: quotation.totalUsd.toString(),
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      if (!session.url) {
        throw new Error('Stripe session URL is empty');
      }

      return {
        id: session.id,
        url: session.url,
      };
    } catch (err: any) {
      this.logger.error(
        `Failed to create Stripe checkout session for quotation: ${err.message}`,
        err.stack,
      );
      return {
        id: `mock_cs_quo_${quotation.id.slice(0, 8)}`,
        url: `${frontendUrl}/user/quotations/${quotation.id}?payment=success&session_id=mock_cs_quo_${quotation.id.slice(0, 8)}`,
      };
    }
  }

  /**
   * Customer accepts a quotation.
   * Marks status as ACCEPTED and creates/returns a Stripe Checkout URL.
   * DOES NOT provision the ServiceOrder yet — that happens upon successful payment.
   */
  async accept(id: string, user: RequestUser) {
    if (!user) {
      throw new ForbiddenException('Authentication is required');
    }

    if (this.isAdmin(user)) {
      throw new ForbiddenException(
        'Admin cannot accept quotations. Only the customer can accept this quotation.',
      );
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
      const isUuid = this.isUuid(id);
      const quotation = await this.prisma.quotation.findFirst({
        where: isUuid ? { id } : { businessId: id },
        include: {
          serviceRequest: true,
          customer: true,
          lineItems: true,
          serviceOrder: true,
        },
      });

      if (!quotation) throw new NotFoundException('Quotation not found');

      if (
        quotation.customer.userId !== user.id &&
        quotation.customer.email.toLowerCase() !== user.email?.toLowerCase()
      ) {
        throw new ForbiddenException('You do not have permission to accept this quotation');
      }

      const existingPaidInvoice = await this.prisma.invoice.findFirst({
        where: {
          quotationId: quotation.id,
          status: InvoiceStatus.PAID,
        },
      });

      if (existingPaidInvoice) {
        throw new BadRequestException(
          `This quotation has already been accepted and paid (Invoice '${existingPaidInvoice.businessId}').`,
        );
      }

      if (quotation.status === QuotationStatus.REJECTED) {
        throw new BadRequestException('Cannot accept an already rejected quotation.');
      }

      if (
        quotation.status === QuotationStatus.EXPIRED ||
        (quotation.expiresAt && new Date(quotation.expiresAt) < new Date())
      ) {
        if (quotation.status !== QuotationStatus.EXPIRED) {
          await this.prisma.quotation.update({
            where: { id: quotation.id },
            data: { status: QuotationStatus.EXPIRED },
          });
        }
        throw new BadRequestException(
          'This quotation has expired. Please contact support or request a new quotation.',
        );
      }

      // Atomically mark Quotation and Service Request as ACCEPTED
      await this.prisma.$transaction(async (tx) => {
        if (quotation.status !== QuotationStatus.ACCEPTED) {
          await tx.quotation.update({
            where: { id: quotation.id },
            data: {
              status: QuotationStatus.ACCEPTED,
              acceptedAt: new Date(),
            },
          });
        }

        await tx.serviceRequest.update({
          where: { id: quotation.serviceRequestId },
          data: { status: ServiceRequestStatus.ACCEPTED },
        });
      });

      // Notify Admins that quotation has been accepted and is awaiting payment checkout
      this.notificationsService
        .notifyAdmins({
          type: NotificationType.QUOTATION_UPDATE,
          title: `Quotation ${quotation.businessId} Accepted`,
          message: `Customer ${quotation.customer.displayName || quotation.customer.email} accepted Quotation ${quotation.businessId} ($${Number(quotation.totalUsd).toFixed(2)}). Proceeding to Stripe checkout.`,
          ctaLabel: 'View Quotation',
          ctaUrl: `/admin/quotations/${quotation.id}`,
          metadata: {
            quotationId: quotation.id,
            totalUsd: quotation.totalUsd,
          },
          priority: 1,
        })
        .catch((err) => {
          this.logger.warn(`Failed to notify admins of quotation acceptance: ${err.message}`);
        });

      // Generate Stripe Checkout session
      const checkoutSession = await this.createStripeCheckoutSessionForQuotation(
        quotation,
        user,
      );

      return {
        success: true,
        message:
          'Quotation accepted successfully. Please complete payment to confirm your service order.',
        checkoutUrl: checkoutSession.url,
      };
    } finally {
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  /**
   * Retrieves or regenerates a checkout session for an accepted quotation that is not yet paid.
   */
  async getCheckoutSession(id: string, user: RequestUser) {
    const isUuid = this.isUuid(id);
    const quotation = await this.prisma.quotation.findFirst({
      where: isUuid ? { id } : { businessId: id },
      include: {
        customer: true,
        lineItems: true,
        serviceOrder: true,
      },
    });

    if (!quotation) throw new NotFoundException('Quotation not found');

    if (
      !this.isAdmin(user) &&
      quotation.customer.userId !== user.id &&
      quotation.customer.email.toLowerCase() !== user.email?.toLowerCase()
    ) {
      throw new ForbiddenException(
        'You do not have permission to access checkout for this quotation',
      );
    }

    if (quotation.serviceOrderId || quotation.serviceOrder) {
      throw new BadRequestException(
        'This quotation has already been paid and converted to a Service Order.',
      );
    }

    const session = await this.createStripeCheckoutSessionForQuotation(quotation, user);
    return {
      success: true,
      message: 'Checkout URL generated successfully',
      checkoutUrl: session.url,
    };
  }

  /**
   * Manually confirm payment for testing / mock preview mode in local development.
   */
  async confirmMockPayment(id: string, user: RequestUser) {
    const isUuid = this.isUuid(id);
    const quotation = await this.prisma.quotation.findFirst({
      where: isUuid ? { id } : { businessId: id },
      include: { customer: true },
    });

    if (!quotation) throw new NotFoundException('Quotation not found');

    if (
      !this.isAdmin(user) &&
      quotation.customer.userId !== user.id &&
      quotation.customer.email.toLowerCase() !== user.email?.toLowerCase()
    ) {
      throw new ForbiddenException('You do not have permission to pay for this quotation');
    }

    const ref = `mock_tx_${Date.now()}`;
    return this.fulfillQuotationPayment(
      quotation.id,
      ref,
      Number(quotation.totalUsd),
      user.email,
    );
  }

  /**
   * Fulfills a paid quotation:
   * Called upon successful Stripe payment completion (checkout.session.completed webhook).
   * Atomically:
   * 1. Creates the ServiceOrder (status: SCHEDULED).
   * 2. Links the ServiceOrder to the Quotation and updates ServiceRequest.
   * 3. Creates the Invoice under this ServiceOrder with status PAID and matching line items.
   * 4. Records the Payment record with method 'Stripe' and transaction reference.
   * 5. Emits real-time notifications to Admin and Customer.
   */
  async fulfillQuotationPayment(
    quotationId: string,
    transactionReference: string,
    amountPaidUsd?: number,
    customerEmail?: string,
  ) {
    const lockKey = `payment:quotation:${quotationId}`;
    const lockToken = await this.redis.acquireLock(lockKey, {
      ttlMs: 20000,
      retryCount: 2,
      retryDelayMs: 400,
    });

    if (!lockToken) {
      this.logger.warn(
        `Parallel payment reconciliation blocked for quotation '${quotationId}'. Lock already held.`,
      );
      return;
    }

    try {
      const isUuid = this.isUuid(quotationId);
      const quotation = await this.prisma.quotation.findFirst({
        where: isUuid ? { id: quotationId } : { businessId: quotationId },
        include: {
          serviceRequest: true,
          customer: true,
          lineItems: true,
          serviceOrder: true,
        },
      });

      if (!quotation) {
        this.logger.warn(`Quotation '${quotationId}' not found during payment fulfillment.`);
        return;
      }

      // Idempotency: If a paid invoice is already linked to this quotation, skip duplicate fulfillment
      const existingInvoice = await this.prisma.invoice.findFirst({
        where: {
          quotationId: quotation.id,
          status: InvoiceStatus.PAID,
        },
        include: { payments: true, lineItems: true },
      });

      if (existingInvoice) {
        this.logger.log(
          `Quotation '${quotation.businessId}' already has paid Invoice '${existingInvoice.businessId}'. Skipping duplicate fulfillment.`,
        );
        return {
          success: true,
          message: 'Quotation payment already fulfilled',
          invoice: existingInvoice,
        };
      }

      const invoiceBusinessId = await this.generateInvoiceBusinessId();

      return await this.prisma.$transaction(async (tx) => {
        // 1. Ensure Quotation is marked ACCEPTED
        await tx.quotation.update({
          where: { id: quotation.id },
          data: {
            status: QuotationStatus.ACCEPTED,
            acceptedAt: quotation.acceptedAt || new Date(),
          },
        });

        // 2. Update Service Request status
        await tx.serviceRequest.update({
          where: { id: quotation.serviceRequestId },
          data: { status: ServiceRequestStatus.ACCEPTED },
        });

        // 3. Generate Paid Invoice under this Service Request and Quotation
        const invoice = await tx.invoice.create({
          data: {
            businessId: invoiceBusinessId,
            customerId: quotation.customerId,
            serviceRequestId: quotation.serviceRequestId,
            quotationId: quotation.id,
            status: InvoiceStatus.PAID,
            issueDate: new Date(),
            dueDate: new Date(),
            paidAt: new Date(),
            subtotalUsd: quotation.subtotalUsd,
            taxUsd: quotation.taxUsd,
            discountUsd: quotation.discountUsd,
            totalUsd: quotation.totalUsd,
            notes: `Paid invoice for Service Request ${quotation.serviceRequest.businessId} (Quotation ${quotation.businessId})`,
            lineItems: {
              create: quotation.lineItems.map((li, idx) => ({
                description: li.description,
                quantity: li.quantity,
                unitPriceUsd: li.unitPriceUsd,
                totalUsd: li.totalUsd,
                sortOrder: li.sortOrder || idx + 1,
              })),
            },
          },
        });

        // 4. Record Payment transaction
        const finalAmount =
          amountPaidUsd && amountPaidUsd > 0 ? amountPaidUsd : Number(quotation.totalUsd);
        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            customerId: quotation.customerId,
            amountUsd: new Prisma.Decimal(finalAmount),
            status: PaymentStatus.SUCCEEDED,
            methodLabel: 'Stripe',
            transactionReference,
            processedAt: new Date(),
          },
        });

        // 5. Real-time notifications
        this.notificationsService
          .notifyAdmins({
            type: NotificationType.BILLING_INVOICE,
            title: `Payment Received for Quotation ${quotation.businessId}`,
            message: `Customer ${quotation.customer.displayName || quotation.customer.email} completed payment of $${finalAmount.toFixed(2)}. Invoice ${invoice.businessId} generated for Service Request ${quotation.serviceRequest.businessId}.`,
            ctaLabel: 'View Invoice',
            ctaUrl: `/admin/financials/invoices/${invoice.id}`,
            metadata: {
              quotationId: quotation.id,
              serviceRequestId: quotation.serviceRequestId,
              invoiceId: invoice.id,
              totalUsd: quotation.totalUsd,
            },
            priority: 1,
          })
          .catch((err) => {
            this.logger.warn(`Failed to notify admins of quotation payment: ${err.message}`);
          });

        if (quotation.customer.userId) {
          this.notificationsService
            .create({
              userId: quotation.customer.userId,
              type: NotificationType.BILLING_INVOICE,
              title: 'Payment Confirmed & Invoice Issued!',
              message: `Your payment of $${finalAmount.toFixed(2)} for ${quotation.serviceRequest.title} was successful. Paid Invoice ${invoice.businessId} is now available.`,
              ctaLabel: 'View Service Request',
              ctaUrl: `/user/services/requests/${quotation.serviceRequestId}`,
              metadata: {
                quotationId: quotation.id,
                serviceRequestId: quotation.serviceRequestId,
                invoiceId: invoice.id,
              },
              sendEmail: true,
              priority: 1,
            })
            .catch((err) => {
              this.logger.warn(`Failed to notify customer of quotation payment: ${err.message}`);
            });
        }

        return {
          success: true,
          message: 'Payment fulfilled successfully. Paid Invoice generated.',
          invoice,
          quotationId: quotation.id,
          serviceRequestId: quotation.serviceRequestId,
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

  // SERVICE-SCOPED QUOTATION METHODS

  async getByServiceRequest(
    serviceRequestIdOrBusinessId: string,
    user?: RequestUser | null,
  ) {
    const isUuid = this.isUuid(serviceRequestIdOrBusinessId);
    const serviceRequest = await this.prisma.serviceRequest.findFirst({
      where: isUuid
        ? { id: serviceRequestIdOrBusinessId }
        : { businessId: serviceRequestIdOrBusinessId },
      select: {
        id: true,
        businessId: true,
        customerId: true,
        customer: { select: { userId: true } },
      },
    });

    if (!serviceRequest) {
      throw new NotFoundException('Service request not found');
    }

    if (user && user.role !== UserRole.ADMIN) {
      if (user.id !== serviceRequest.customer?.userId) {
        throw new ForbiddenException(
          'You do not have permission to view quotations for this service request',
        );
      }
    }

    // Auto-expire past-due pending quotations
    const now = new Date();
    await this.prisma.quotation.updateMany({
      where: {
        serviceRequestId: serviceRequest.id,
        status: QuotationStatus.SENT,
        expiresAt: { lt: now },
      },
      data: {
        status: QuotationStatus.EXPIRED,
      },
    });

    const quotations = await this.prisma.quotation.findMany({
      where: { serviceRequestId: serviceRequest.id },
      include: this.quotationInclude(),
      orderBy: { createdAt: 'desc' },
    });

    const active =
      quotations.find((q) =>
        (
          [
            QuotationStatus.SENT,
            QuotationStatus.DRAFT,
            QuotationStatus.ACCEPTED,
          ] as QuotationStatus[]
        ).includes(q.status),
      ) || quotations[0] || null;

    return {
      success: true,
      serviceRequestId: serviceRequest.id,
      serviceRequestBusinessId: serviceRequest.businessId,
      activeQuotation: active,
      history: quotations,
    };
  }

  async delete(idOrBusinessId: string, _user: RequestUser) {
    const isUuid = this.isUuid(idOrBusinessId);
    const quotation = await this.prisma.quotation.findFirst({
      where: isUuid ? { id: idOrBusinessId } : { businessId: idOrBusinessId },
      include: { serviceRequest: true, serviceOrder: true },
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (quotation.serviceOrder) {
      throw new BadRequestException(
        'Cannot delete this quotation because an active Service Order has already been provisioned from it. Cancel or delete the Service Order first.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.quotation.delete({
        where: { id: quotation.id },
      });

      // If the service request was QUOTED, roll it back to UNDER_REVIEW
      if (quotation.serviceRequest?.status === ServiceRequestStatus.QUOTED) {
        await tx.serviceRequest.update({
          where: { id: quotation.serviceRequestId },
          data: { status: ServiceRequestStatus.UNDER_REVIEW },
        });
      }

      this.logger.log(`Quotation ${quotation.businessId} deleted by Admin ${_user.email}`);

      return {
        success: true,
        message: `Quotation ${quotation.businessId} has been deleted successfully.`,
      };
    });
  }

  async deleteByServiceRequest(
    serviceRequestIdOrBusinessId: string,
    user: RequestUser,
  ) {
    const isUuid = this.isUuid(serviceRequestIdOrBusinessId);
    const serviceRequest = await this.prisma.serviceRequest.findFirst({
      where: isUuid
        ? { id: serviceRequestIdOrBusinessId }
        : { businessId: serviceRequestIdOrBusinessId },
      select: { id: true },
    });

    if (!serviceRequest) {
      throw new NotFoundException('Service request not found');
    }

    const quotation = await this.prisma.quotation.findFirst({
      where: { serviceRequestId: serviceRequest.id },
      orderBy: { createdAt: 'desc' },
      include: { serviceRequest: true, serviceOrder: true },
    });

    if (!quotation) {
      throw new NotFoundException(
        'No quotation found for this service request to delete',
      );
    }

    return this.delete(quotation.id, user);
  }

  async updateByServiceRequest(
    serviceRequestIdOrBusinessId: string,
    dto: UpdateQuotationDto,
    user: RequestUser,
  ) {
    const isUuid = this.isUuid(serviceRequestIdOrBusinessId);
    const serviceRequest = await this.prisma.serviceRequest.findFirst({
      where: isUuid
        ? { id: serviceRequestIdOrBusinessId }
        : { businessId: serviceRequestIdOrBusinessId },
      select: { id: true },
    });

    if (!serviceRequest) {
      throw new NotFoundException('Service request not found');
    }

    const quotation = await this.prisma.quotation.findFirst({
      where: {
        serviceRequestId: serviceRequest.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!quotation) {
      throw new NotFoundException(
        'No quotation found for this service request to update',
      );
    }

    return this.update(quotation.id, dto, user);
  }
}
