import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentStatus,
  ProductOrderStatus,
  ServiceOrderStatus,
  ServiceRequestStatus,
  TechnicianStatus,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis';

/** Service request statuses that still need a quotation raised against them. */
const AWAITING_QUOTE_STATUSES = [
  ServiceRequestStatus.SUBMITTED,
  ServiceRequestStatus.UNDER_REVIEW,
  ServiceRequestStatus.ACCEPTED,
];

/** Work that is confirmed and ready to deliver. */
const CONFIRMED_WORK_STATUSES = [
  ServiceOrderStatus.SCHEDULED,
  ServiceOrderStatus.RESCHEDULED,
  ServiceOrderStatus.TECHNICIAN_ASSIGNED,
  ServiceOrderStatus.ON_THE_WAY,
  ServiceOrderStatus.ARRIVED,
  ServiceOrderStatus.IN_PROGRESS,
];

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** First instant of the month, `monthsAgo` months back from now. */
  private monthStart(monthsAgo: number): Date {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCMonth(d.getUTCMonth() - monthsAgo);
    return d;
  }

  private monthKey(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Everything the admin dashboard screen renders, in ONE round trip:
   * KPI cards, the six-month revenue trend, the service-distribution donut,
   * the latest requests, and the un-quoted request queue.
   *
   * Every figure is derived from settled payments and live counts - nothing is
   * estimated or hard-coded.
   */
  async getDashboard() {
    const cacheKey = 'dashboard:admin:v1';
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    // Current window = last 6 months; previous window = the 6 before it, used
    // only to derive the growth percentage.
    const currentFrom = this.monthStart(5);
    const previousFrom = this.monthStart(11);

    const [
      payments,
      previousPaymentsAgg,
      trackedOrders,
      activeTechnicians,
      offlineTechnicians,
      activeCustomers,
      pendingReview,
      confirmedWork,
      scheduledVisits,
      serviceDistribution,
      recentRequests,
      awaitingQuoteCount,
      awaitingQuoteLatest,
    ] = await Promise.all([
      // Settled payments in the current 6-month window, split by domain so the
      // trend chart can separate product from service revenue.
      this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.SUCCEEDED,
          processedAt: { gte: currentFrom },
        },
        select: {
          amountUsd: true,
          processedAt: true,
          invoice: { select: { productOrderId: true, serviceOrderId: true } },
        },
      }),

      // Previous 6 months, aggregated in the database - the rows themselves are
      // never needed, only the sum.
      this.prisma.payment.aggregate({
        _sum: { amountUsd: true },
        where: {
          status: PaymentStatus.SUCCEEDED,
          processedAt: { gte: previousFrom, lt: currentFrom },
        },
      }),

      this.prisma.productOrder.count({
        where: { status: { not: ProductOrderStatus.CANCELLED } },
      }),
      this.prisma.technician.count({
        where: { status: TechnicianStatus.ACTIVE },
      }),
      this.prisma.technician.count({
        where: { status: { not: TechnicianStatus.ACTIVE } },
      }),
      this.prisma.customer.count({
        where: {
          OR: [
            { productOrders: { some: {} } },
            { serviceRequests: { some: {} } },
          ],
        },
      }),
      this.prisma.serviceRequest.count({
        where: {
          status: {
            in: [
              ServiceRequestStatus.SUBMITTED,
              ServiceRequestStatus.UNDER_REVIEW,
            ],
          },
        },
      }),
      this.prisma.serviceOrder.count({
        where: { status: { in: CONFIRMED_WORK_STATUSES } },
      }),
      this.prisma.appointment.count({
        where: { startAt: { gte: new Date() } },
      }),

      // Donut: counted in the database, not by pulling every request into node.
      this.prisma.serviceRequest.groupBy({
        by: ['serviceId'],
        _count: { _all: true },
        orderBy: { _count: { serviceId: 'desc' } },
      }),

      this.prisma.serviceRequest.findMany({
        orderBy: { submittedAt: 'desc' },
        take: 10,
        select: this.requestListSelect(),
      }),

      this.prisma.serviceRequest.count({
        where: {
          quotations: { none: {} },
          status: { in: AWAITING_QUOTE_STATUSES },
        },
      }),
      this.prisma.serviceRequest.findMany({
        where: {
          quotations: { none: {} },
          status: { in: AWAITING_QUOTE_STATUSES },
        },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        select: this.requestListSelect(),
      }),
    ]);

    // ── Revenue: six monthly buckets, pre-seeded so empty months still plot ──
    const buckets = new Map<
      string,
      { month: string; label: string; product: number; service: number; total: number }
    >();

    for (let i = 5; i >= 0; i--) {
      const d = this.monthStart(i);
      buckets.set(this.monthKey(d), {
        month: this.monthKey(d),
        label: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
        product: 0,
        service: 0,
        total: 0,
      });
    }

    let sixMonthRevenue = 0;
    for (const payment of payments) {
      const amount = Number(payment.amountUsd);
      sixMonthRevenue += amount;

      const bucket = buckets.get(this.monthKey(new Date(payment.processedAt)));
      if (!bucket) continue;

      if (payment.invoice.productOrderId) bucket.product += amount;
      if (payment.invoice.serviceOrderId) bucket.service += amount;
      bucket.total += amount;
    }

    const previousRevenue = Number(previousPaymentsAgg._sum.amountUsd || 0);
    const revenueGrowthPercent =
      previousRevenue > 0
        ? Number((((sixMonthRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1))
        : sixMonthRevenue > 0
          ? 100
          : 0;

    // ── Donut: resolve service names for the grouped ids ──
    const serviceIds = serviceDistribution.map((row) => row.serviceId);
    const services = serviceIds.length
      ? await this.prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true, category: true },
        })
      : [];

    const serviceById = new Map(services.map((s) => [s.id, s]));
    const distributionTotal = serviceDistribution.reduce(
      (sum, row) => sum + row._count._all,
      0,
    );

    const result = {
      success: true,
      data: {
        metrics: {
          sixMonthRevenueUsd: Number(sixMonthRevenue.toFixed(2)),
          revenueGrowthPercent,
          trackedOrders,
          scheduledVisits,
          activeTechnicians,
          offlineTechnicians,
          activeCustomers,
          pendingReview,
          confirmedWork,
          awaitingQuotation: awaitingQuoteCount,
        },
        revenueTrend: [...buckets.values()].map((b) => ({
          month: b.month,
          label: b.label,
          productRevenue: Number(b.product.toFixed(2)),
          serviceRevenue: Number(b.service.toFixed(2)),
          totalRevenue: Number(b.total.toFixed(2)),
        })),
        serviceDistribution: serviceDistribution.map((row) => ({
          serviceId: row.serviceId,
          serviceName: serviceById.get(row.serviceId)?.name || 'Unknown Service',
          category: serviceById.get(row.serviceId)?.category || null,
          count: row._count._all,
          percentage: distributionTotal
            ? Number(((row._count._all / distributionTotal) * 100).toFixed(1))
            : 0,
        })),
        recentRequests: recentRequests.map((r) => this.toRequestRow(r)),
        awaitingQuotation: {
          totalCount: awaitingQuoteCount,
          items: awaitingQuoteLatest.map((r) => this.toRequestRow(r)),
        },
      },
    };

    await this.redis.set(cacheKey, result, 60);
    return result;
  }

  private requestListSelect() {
    return {
      id: true,
      businessId: true,
      title: true,
      status: true,
      urgency: true,
      propertyLabel: true,
      preferredDate: true,
      preferredTime: true,
      estimatedAmountUsd: true,
      submittedAt: true,
      customer: {
        select: { id: true, displayName: true, email: true, phone: true },
      },
      service: { select: { id: true, name: true } },
      assignedTechnician: { select: { id: true, displayName: true } },
      _count: { select: { quotations: true } },
    } as const;
  }

  private toRequestRow(request: any) {
    return {
      id: request.id,
      businessId: request.businessId,
      title: request.title,
      status: request.status,
      urgency: request.urgency,
      serviceId: request.service?.id || null,
      serviceName: request.service?.name || null,
      customerId: request.customer?.id || null,
      customerName: request.customer?.displayName || null,
      customerEmail: request.customer?.email || null,
      customerPhone: request.customer?.phone || null,
      propertyLabel: request.propertyLabel,
      preferredDate: request.preferredDate,
      preferredTime: request.preferredTime,
      estimatedAmountUsd:
        request.estimatedAmountUsd !== null && request.estimatedAmountUsd !== undefined
          ? Number(request.estimatedAmountUsd).toFixed(2)
          : null,
      assignedTechnicianId: request.assignedTechnician?.id || null,
      assignedTechnician: request.assignedTechnician?.displayName || null,
      isQuoted: (request._count?.quotations ?? 0) > 0,
      submittedAt: request.submittedAt,
    };
  }
}
