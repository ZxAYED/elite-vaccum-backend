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
  Prisma,
  ServiceOrderStatus,
  UserRole,
} from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { generateBusinessId } from 'src/common/utils/business-id.util';
import { getPagination } from 'src/common/utils/pagination';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import {
  AssignServiceOrderTechnicianDto,
  ServiceOrderListQueryDto,
  UpdateEtaDto,
  UpdateServiceOrderDto,
  UpdateServiceOrderStatusDto,
} from './dto/update-service-order.dto';

@Injectable()
export class ServiceOrdersService {
  private readonly logger = new Logger(ServiceOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private isAdmin(user?: RequestUser | null) {
    return user?.role === UserRole.ADMIN;
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

  private orderInclude() {
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
          equipment: true,
          attachments: true,
        },
      },
      quotation: {
        select: {
          id: true,
          businessId: true,
          totalUsd: true,
          lineItems: true,
        },
      },
      statusHistory: {
        orderBy: { changedAt: 'desc' },
      },
      etas: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
      appointments: {
        orderBy: { startAt: 'asc' },
      },
      invoices: {
        include: {
          lineItems: true,
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      serviceReport: {
        include: {
          partsUsed: true,
          evidence: true,
        },
      },
    } satisfies Prisma.ServiceOrderInclude;
  }

  // ==========================================
  // CREATE SERVICE ORDER
  // ==========================================

  async create(dto: CreateServiceOrderDto, user: RequestUser) {
    const serviceRequest = await this.prisma.serviceRequest.findUnique({
      where: { id: dto.serviceRequestId },
    });

    if (!serviceRequest) {
      throw new NotFoundException('Service request not found');
    }

    const businessId = await this.generateServiceOrderBusinessId();

    return this.prisma.$transaction(async (tx) => {
      const serviceOrder = await tx.serviceOrder.create({
        data: {
          businessId,
          serviceRequestId: dto.serviceRequestId,
          quotationId: dto.quotationId || null,
          customerId: serviceRequest.customerId,
          assignedTechnicianId: dto.assignedTechnicianId || null,
          status: dto.status || ServiceOrderStatus.SCHEDULED,
          scheduledAt: new Date(dto.scheduledAt),
          estimatedDurationMin: dto.estimatedDurationMin || 60,
          totalUsd: new Prisma.Decimal(dto.totalUsd),
          summary: dto.summary.trim(),
          customerNotes: dto.customerNotes?.trim() || null,
          adminInstructions: dto.adminInstructions?.trim() || null,
        },
        include: this.orderInclude(),
      });

      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: serviceOrder.id,
          fromStatus: serviceOrder.status,
          toStatus: serviceOrder.status,
          note: 'Service Order created',
          actorLabel: `Admin (${user.email})`,
        },
      });

      this.logger.log(`Service Order '${serviceOrder.businessId}' created by Admin (${user.email})`);

      // Notify Customer
      if (serviceOrder.customer?.userId) {
        this.notificationsService
          .create({
            userId: serviceOrder.customer.userId,
            type: NotificationType.SCHEDULE_DISPATCH,
            title: `Service Order ${serviceOrder.businessId} Scheduled`,
            message: `Your service visit is confirmed for ${new Date(serviceOrder.scheduledAt).toLocaleDateString()} at ${new Date(serviceOrder.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
            ctaLabel: 'View Service Order',
            ctaUrl: `/services/orders/${serviceOrder.id}`,
            metadata: {
              serviceOrderId: serviceOrder.id,
              businessId: serviceOrder.businessId,
              scheduledAt: serviceOrder.scheduledAt,
            },
            sendEmail: true,
            priority: 1,
          })
          .catch((err) => {
            this.logger.warn(`Failed to notify customer of scheduled order: ${err.message}`);
          });
      }

      // Notify Assigned Technician if set
      if (serviceOrder.technician?.userId) {
        this.notificationsService
          .create({
            userId: serviceOrder.technician.userId,
            type: NotificationType.SCHEDULE_DISPATCH,
            title: `New Service Job Assigned: ${serviceOrder.businessId}`,
            message: `You have been assigned to ${serviceOrder.summary} scheduled for ${new Date(serviceOrder.scheduledAt).toLocaleString()}.`,
            ctaLabel: 'Open Job',
            ctaUrl: `/technician/orders/${serviceOrder.id}`,
            metadata: {
              serviceOrderId: serviceOrder.id,
              businessId: serviceOrder.businessId,
            },
            sendEmail: true,
            priority: 1,
          })
          .catch((err) => {
            this.logger.warn(`Failed to notify technician of assignment: ${err.message}`);
          });
      }

      return {
        success: true,
        message: 'Service order created successfully',
        serviceOrder,
      };
    });
  }

  // ==========================================
  // LIST SERVICE ORDERS
  // ==========================================

  async findAll(query: ServiceOrderListQueryDto) {
    const where: Prisma.ServiceOrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.technicianId ? { assignedTechnicianId: query.technicianId } : {}),
      ...(query.search
        ? {
            OR: [
              { businessId: { contains: query.search, mode: 'insensitive' } },
              { summary: { contains: query.search, mode: 'insensitive' } },
              { customer: { displayName: { contains: query.search, mode: 'insensitive' } } },
              { customer: { email: { contains: query.search, mode: 'insensitive' } } },
              { technician: { displayName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const totalItems = await this.prisma.serviceOrder.count({ where });
    const { skip, take, meta } = getPagination(query.page, query.limit, totalItems);

    const [items, scheduledCount, assignedCount, inProgressCount, completedCount, cancelledCount] =
      await Promise.all([
        this.prisma.serviceOrder.findMany({
          where,
          skip,
          take,
          orderBy: { scheduledAt: 'desc' },
          include: this.orderInclude(),
        }),
        this.prisma.serviceOrder.count({ where: { status: ServiceOrderStatus.SCHEDULED } }),
        this.prisma.serviceOrder.count({ where: { status: ServiceOrderStatus.TECHNICIAN_ASSIGNED } }),
        this.prisma.serviceOrder.count({ where: { status: ServiceOrderStatus.IN_PROGRESS } }),
        this.prisma.serviceOrder.count({ where: { status: ServiceOrderStatus.COMPLETED } }),
        this.prisma.serviceOrder.count({ where: { status: ServiceOrderStatus.CANCELLED } }),
      ]);

    return {
      items,
      meta: {
        ...meta,
        kpi: {
          scheduled: scheduledCount,
          technicianAssigned: assignedCount,
          inProgress: inProgressCount,
          completed: completedCount,
          cancelled: cancelledCount,
          total: totalItems,
        },
      },
    };
  }

  async getMyOrders(query: ServiceOrderListQueryDto, user: RequestUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!customer) {
      return { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
    }

    const where: Prisma.ServiceOrderWhereInput = {
      customerId: customer.id,
      ...(query.status ? { status: query.status } : {}),
    };

    const totalItems = await this.prisma.serviceOrder.count({ where });
    const { skip, take, meta } = getPagination(query.page, query.limit, totalItems);

    const items = await this.prisma.serviceOrder.findMany({
      where,
      skip,
      take,
      orderBy: { scheduledAt: 'desc' },
      include: this.orderInclude(),
    });

    return { items, meta };
  }

  async findOne(id: string, user?: RequestUser | null) {
    const serviceOrder = await this.prisma.serviceOrder.findFirst({
      where: {
        OR: [{ id }, { businessId: id }],
      },
      include: this.orderInclude(),
    });

    if (!serviceOrder) {
      throw new NotFoundException('Service order not found');
    }

    if (!this.isAdmin(user)) {
      if (!user || user.id !== serviceOrder.customer.userId) {
        throw new ForbiddenException('You do not have permission to view this service order');
      }
    }

    return serviceOrder;
  }

  // ==========================================
  // UPDATE / ACTIONS
  // ==========================================

  async update(id: string, dto: UpdateServiceOrderDto, user: RequestUser) {
    const existing = await this.prisma.serviceOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Service order not found');

    const updated = await this.prisma.serviceOrder.update({
      where: { id },
      data: {
        ...(dto.summary ? { summary: dto.summary.trim() } : {}),
        ...(dto.scheduledAt ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
        ...(dto.estimatedDurationMin !== undefined ? { estimatedDurationMin: dto.estimatedDurationMin } : {}),
        ...(dto.totalUsd !== undefined ? { totalUsd: new Prisma.Decimal(dto.totalUsd) } : {}),
        ...(dto.customerNotes !== undefined ? { customerNotes: dto.customerNotes?.trim() || null } : {}),
        ...(dto.adminInstructions !== undefined ? { adminInstructions: dto.adminInstructions?.trim() || null } : {}),
      },
      include: this.orderInclude(),
    });

    return {
      success: true,
      message: 'Service order updated successfully',
      serviceOrder: updated,
    };
  }

  async updateStatus(
    id: string,
    dto: UpdateServiceOrderStatusDto,
    user: RequestUser,
  ) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: { invoices: true, customer: true, serviceRequest: true },
    });

    if (!order) throw new NotFoundException('Service order not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceOrder.update({
        where: { id },
        data: { status: dto.status },
        include: this.orderInclude(),
      });

      // Record status transition in timeline history
      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: id,
          fromStatus: order.status,
          toStatus: dto.status,
          note: dto.note?.trim() || `Status changed to ${dto.status}`,
          actorLabel: `${user.role} (${user.email})`,
        },
      });

      // If status changed to COMPLETED and no invoice exists, auto-generate service invoice!
      if (dto.status === ServiceOrderStatus.COMPLETED && order.invoices.length === 0) {
        const invoiceBusinessId = await this.generateInvoiceBusinessId();
        await tx.invoice.create({
          data: {
            businessId: invoiceBusinessId,
            customerId: order.customerId,
            serviceOrderId: order.id,
            status: InvoiceStatus.ISSUED,
            subtotalUsd: order.totalUsd,
            totalUsd: order.totalUsd,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days net
            notes: `Invoice generated for completed Service Order ${order.businessId}`,
            lineItems: {
              create: [
                {
                  description: `${order.summary} (Completed On-Site Service)`,
                  quantity: 1,
                  unitPriceUsd: order.totalUsd,
                  totalUsd: order.totalUsd,
                  sortOrder: 1,
                },
              ],
            },
          },
        });
      }

      // Real-Time Notification on Status Change
      if (updated.customer?.userId) {
        let statusTitle = `Service Order ${updated.businessId} Update`;
        let statusMsg = `Your service order status is now ${dto.status.replace(/_/g, ' ')}.`;
        let priority = 2;

        if (dto.status === ServiceOrderStatus.ON_THE_WAY) {
          statusTitle = `Technician En Route! (${updated.businessId})`;
          statusMsg = `Technician ${updated.technician?.displayName || 'Our technician'} is on the way to your property.`;
          priority = 1;
        } else if (dto.status === ServiceOrderStatus.ARRIVED) {
          statusTitle = `Technician Arrived (${updated.businessId})`;
          statusMsg = `Technician ${updated.technician?.displayName || 'Our technician'} has arrived on-site.`;
          priority = 1;
        } else if (dto.status === ServiceOrderStatus.COMPLETED) {
          statusTitle = `Service Completed (${updated.businessId})`;
          statusMsg = `Your central vacuum service has been completed! View your inspection summary and rate your service.`;
          priority = 1;
        }

        this.notificationsService
          .create({
            userId: updated.customer.userId,
            type: NotificationType.SCHEDULE_DISPATCH,
            title: statusTitle,
            message: statusMsg,
            ctaLabel: 'View Order',
            ctaUrl: `/services/orders/${updated.id}`,
            metadata: {
              serviceOrderId: updated.id,
              status: dto.status,
            },
            sendEmail: dto.status === ServiceOrderStatus.COMPLETED,
            priority,
          })
          .catch((err) => {
            this.logger.warn(`Failed to notify customer of order status: ${err.message}`);
          });
      }

      // Notify Admins on completion
      if (dto.status === ServiceOrderStatus.COMPLETED) {
        this.notificationsService
          .notifyAdmins({
            type: NotificationType.SCHEDULE_DISPATCH,
            title: `Service Order Completed: ${updated.businessId}`,
            message: `Service Order ${updated.businessId} was marked COMPLETED by ${user.role} (${user.email}).`,
            ctaLabel: 'View Order',
            ctaUrl: `/admin/service-orders/${updated.id}`,
            metadata: { serviceOrderId: updated.id, status: dto.status },
            priority: 2,
          })
          .catch((err) => {
            this.logger.warn(`Failed to notify admins of completed service: ${err.message}`);
          });
      }

      return {
        success: true,
        message: `Service order status updated to ${dto.status}`,
        serviceOrder: updated,
      };
    });
  }

  async assignTechnician(
    id: string,
    dto: AssignServiceOrderTechnicianDto,
    user: RequestUser,
  ) {
    const order = await this.prisma.serviceOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Service order not found');

    const tech = await this.prisma.technician.findUnique({ where: { id: dto.technicianId } });
    if (!tech) throw new NotFoundException('Technician not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceOrder.update({
        where: { id },
        data: {
          assignedTechnicianId: dto.technicianId,
          status: ServiceOrderStatus.TECHNICIAN_ASSIGNED,
        },
        include: this.orderInclude(),
      });

      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: id,
          fromStatus: order.status,
          toStatus: ServiceOrderStatus.TECHNICIAN_ASSIGNED,
          note: dto.note?.trim() || `Assigned to technician ${tech.displayName}`,
          actorLabel: `Admin (${user.email})`,
        },
      });

      // Notify Assigned Technician
      if (tech.userId) {
        this.notificationsService
          .create({
            userId: tech.userId,
            type: NotificationType.SCHEDULE_DISPATCH,
            title: `New Job Assignment: ${order.businessId}`,
            message: `You have been assigned to Service Order ${order.businessId} (${order.summary}).`,
            ctaLabel: 'View Job',
            ctaUrl: `/technician/orders/${order.id}`,
            metadata: { serviceOrderId: order.id, businessId: order.businessId },
            sendEmail: true,
            priority: 1,
          })
          .catch((err) => {
            this.logger.warn(`Failed to notify technician of assignment: ${err.message}`);
          });
      }

      // Notify Customer
      if (updated.customer?.userId) {
        this.notificationsService
          .create({
            userId: updated.customer.userId,
            type: NotificationType.SCHEDULE_DISPATCH,
            title: `Technician Assigned (${order.businessId})`,
            message: `Technician ${tech.displayName} has been assigned to your service appointment.`,
            ctaLabel: 'View Order',
            ctaUrl: `/services/orders/${order.id}`,
            metadata: { serviceOrderId: order.id, technicianId: tech.id },
            priority: 2,
          })
          .catch((err) => {
            this.logger.warn(`Failed to notify customer of technician assignment: ${err.message}`);
          });
      }

      return {
        success: true,
        message: `Technician '${tech.displayName}' assigned to Service Order`,
        serviceOrder: updated,
      };
    });
  }

  async updateEta(id: string, dto: UpdateEtaDto, user: RequestUser) {
    const order = await this.prisma.serviceOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Service order not found');

    if (!order.assignedTechnicianId) {
      throw new BadRequestException('Cannot update ETA for an unassigned service order');
    }

    const eta = await this.prisma.technicianEta.create({
      data: {
        serviceOrderId: id,
        technicianId: order.assignedTechnicianId,
        minutes: dto.minutes,
        updatedBy: `${user.role} (${user.email})`,
      },
    });

    return {
      success: true,
      message: `Technician ETA updated to ${dto.minutes} minutes`,
      eta,
    };
  }
}
