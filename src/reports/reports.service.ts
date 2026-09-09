import { Injectable, Logger } from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  ProductOrderStatus,
  QuotationStatus,
  ServiceOrderStatus,
  ServiceRequestStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis';
import { ReportsQueryDto } from './dto/reports-query.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private getCacheKey(prefix: string, query?: any): string {
    if (!query || Object.keys(query).length === 0) {
      return `reports:${prefix}:all`;
    }
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(query))
      .digest('hex');
    return `reports:${prefix}:${hash}`;
  }

  private getDateRange(query: ReportsQueryDto) {
    const to = query.to ? new Date(query.to) : new Date();
    let from = query.from ? new Date(query.from) : new Date();

    if (!query.from) {
      const days = query.period === '7d' ? 7 : query.period === '90d' ? 90 : query.period === '1y' ? 365 : 30;
      from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    return { from, to };
  }

  private async getRevenueEntries(
    from: Date,
    to: Date,
    orderType: ReportsQueryDto['orderType'] = 'ALL',
  ) {
    const invoiceTypeWhere =
      orderType === 'PRODUCT'
        ? { productOrderId: { not: null } }
        : orderType === 'SERVICE'
          ? { serviceOrderId: { not: null } }
          : {};

    const [payments, paidInvoicesWithoutPayments] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.SUCCEEDED,
          processedAt: { gte: from, lte: to },
          invoice: invoiceTypeWhere,
        },
        select: {
          amountUsd: true,
          processedAt: true,
          invoice: { select: { productOrderId: true, serviceOrderId: true } },
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.PAID,
          payments: { none: { status: PaymentStatus.SUCCEEDED } },
          OR: [
            { paidAt: { gte: from, lte: to } },
            { paidAt: null, updatedAt: { gte: from, lte: to } },
          ],
          ...invoiceTypeWhere,
        },
        select: {
          totalUsd: true,
          paidAt: true,
          updatedAt: true,
          productOrderId: true,
          serviceOrderId: true,
        },
      }),
    ]);

    return [
      ...payments.map((payment) => ({
        amountUsd: Number(payment.amountUsd),
        occurredAt: payment.processedAt,
        productOrderId: payment.invoice.productOrderId,
        serviceOrderId: payment.invoice.serviceOrderId,
      })),
      ...paidInvoicesWithoutPayments.map((invoice) => ({
        amountUsd: Number(invoice.totalUsd),
        occurredAt: invoice.paidAt || invoice.updatedAt,
        productOrderId: invoice.productOrderId,
        serviceOrderId: invoice.serviceOrderId,
      })),
    ];
  }


  // OVERVIEW DASHBOARD METRICS


  async getOverview(query: ReportsQueryDto) {
    const cacheKey = this.getCacheKey('overview', query);
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const { from, to } = this.getDateRange(query);
    const orderType = query.orderType || 'ALL';

    const [
      revenueEntries,
      allRefunds,
      productOrdersCount,
      serviceOrdersCount,
      completedServicesCount,
      pendingRequestsCount,
      outstandingInvoicesCount,
      funnelRequested,
      funnelAccepted,
      funnelQuoted,
      funnelQuoteAccepted,
      funnelServiceOrders,
      funnelCompleted,
      awaitingQuoteCount,
      awaitingQuoteLatest,
    ] = await Promise.all([
      this.getRevenueEntries(from, to, orderType),
      // Refunds - only settled ones. A MANUAL_REQUIRED refund is money that has
      // NOT left the account yet and must not be deducted from revenue.
      this.prisma.refund.findMany({
        where: {
          status: 'COMPLETED',
          processedAt: { gte: from, lte: to },
        },
        select: { amountUsd: true },
      }),
      // Counts
      this.prisma.productOrder.count({
        where: { status: { not: ProductOrderStatus.CANCELLED } },
      }),
      this.prisma.serviceOrder.count(),
      this.prisma.serviceOrder.count({ where: { status: ServiceOrderStatus.COMPLETED } }),
      this.prisma.serviceRequest.count({
        where: { status: { in: [ServiceRequestStatus.SUBMITTED, ServiceRequestStatus.UNDER_REVIEW] } },
      }),
      this.prisma.invoice.count({
        where: { status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID] } },
      }),
      // Service Funnel counts
      this.prisma.serviceRequest.count(),
      this.prisma.serviceRequest.count({
        where: { status: { notIn: [ServiceRequestStatus.REJECTED, ServiceRequestStatus.CANCELLED] } },
      }),
      this.prisma.quotation.count(),
      this.prisma.quotation.count({ where: { status: QuotationStatus.ACCEPTED } }),
      this.prisma.serviceOrder.count(),
      this.prisma.serviceOrder.count({ where: { status: ServiceOrderStatus.COMPLETED } }),

      // Service requests raised but never quoted - the admin's work queue.
      // "Not quoted" means no Quotation row exists at all, and the request is
      // still live (not cancelled, rejected, or already past quoting).
      this.prisma.serviceRequest.count({
        where: {
          quotations: { none: {} },
          status: {
            in: [
              ServiceRequestStatus.SUBMITTED,
              ServiceRequestStatus.UNDER_REVIEW,
              ServiceRequestStatus.ACCEPTED,
            ],
          },
        },
      }),
      this.prisma.serviceRequest.findMany({
        where: {
          quotations: { none: {} },
          status: {
            in: [
              ServiceRequestStatus.SUBMITTED,
              ServiceRequestStatus.UNDER_REVIEW,
              ServiceRequestStatus.ACCEPTED,
            ],
          },
        },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          businessId: true,
          title: true,
          status: true,
          urgency: true,
          preferredDate: true,
          preferredTime: true,
          propertyLabel: true,
          estimatedAmountUsd: true,
          submittedAt: true,
          customer: { select: { id: true, displayName: true, email: true, phone: true } },
          service: { select: { id: true, name: true } },
          assignedTechnician: { select: { id: true, displayName: true } },
        },
      }),
    ]);

    const totalPaymentsUsd = revenueEntries.reduce((sum, p) => sum + p.amountUsd, 0);
    const refundAmountUsd = allRefunds.reduce((sum, r) => sum + Number(r.amountUsd), 0);

    const productRevenueUsd = revenueEntries
      .filter((p) => p.productOrderId)
      .reduce((sum, p) => sum + p.amountUsd, 0);

    const serviceRevenueUsd = revenueEntries
      .filter((p) => p.serviceOrderId)
      .reduce((sum, p) => sum + p.amountUsd, 0);

    // Timeseries: Group revenue by day for last 14 days
    const revenueOverTimeMap: Record<string, { product: number; service: number; total: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      revenueOverTimeMap[key] = { product: 0, service: 0, total: 0 };
    }

    revenueEntries.forEach((p) => {
      const key = new Date(p.occurredAt).toISOString().split('T')[0];
      if (revenueOverTimeMap[key]) {
        const amt = p.amountUsd;
        if (p.productOrderId) revenueOverTimeMap[key].product += amt;
        if (p.serviceOrderId) revenueOverTimeMap[key].service += amt;
        revenueOverTimeMap[key].total += amt;
      }
    });

    const revenueOverTime = Object.entries(revenueOverTimeMap).map(([date, val]) => ({
      date,
      productRevenue: Number(val.product.toFixed(2)),
      serviceRevenue: Number(val.service.toFixed(2)),
      totalRevenue: Number(val.total.toFixed(2)),
    }));

    const result = {
      success: true,
      data: {
        metrics: {
          totalRevenue: Number(totalPaymentsUsd.toFixed(2)),
          productRevenue: Number(productRevenueUsd.toFixed(2)),
          serviceRevenue: Number(serviceRevenueUsd.toFixed(2)),
          totalOrders: productOrdersCount + serviceOrdersCount,
          refundAmount: Number(refundAmountUsd.toFixed(2)),
          productOrdersCount,
          serviceOrdersCount,
          completedServicesCount,
          pendingRequestsCount,
          outstandingInvoicesCount,
        },
        revenueOverTime,
        serviceFunnel: {
          requested: funnelRequested,
          accepted: funnelAccepted,
          quoted: funnelQuoted,
          quoteAccepted: funnelQuoteAccepted,
          serviceOrder: funnelServiceOrders,
          completed: funnelCompleted,
        },
        // Requests waiting on a quotation: the count for the KPI card, the 10
        // most recent for the dashboard list.
        awaitingQuotation: {
          totalCount: awaitingQuoteCount,
          items: awaitingQuoteLatest.map((request) => ({
            id: request.id,
            businessId: request.businessId,
            title: request.title,
            status: request.status,
            urgency: request.urgency,
            serviceName: request.service?.name || null,
            customerName: request.customer?.displayName || null,
            customerEmail: request.customer?.email || null,
            customerPhone: request.customer?.phone || null,
            propertyLabel: request.propertyLabel,
            preferredDate: request.preferredDate,
            preferredTime: request.preferredTime,
            estimatedAmountUsd:
              request.estimatedAmountUsd !== null
                ? Number(request.estimatedAmountUsd).toFixed(2)
                : null,
            assignedTechnician: request.assignedTechnician?.displayName || null,
            submittedAt: request.submittedAt,
          })),
        },
        dateRange: { from, to, orderType },
      },
    };

    await this.redis.set(cacheKey, result, 60);
    return result;
  }


  // SALES REPORTS


  async getSales(query: ReportsQueryDto) {
    const cacheKey = this.getCacheKey('sales', query);
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const { from, to } = this.getDateRange(query);

    const orderWhere: Prisma.ProductOrderWhereInput = {
      status: { not: ProductOrderStatus.CANCELLED },
      placedAt: { gte: from, lte: to },
    };

    // Totals and the top-product ranking are computed by Postgres. The previous
    // version pulled every order AND every line item into memory to do it.
    const [orderAgg, topItems] = await Promise.all([
      this.prisma.productOrder.aggregate({
        _sum: { totalUsd: true },
        _avg: { totalUsd: true },
        _count: { _all: true },
        where: orderWhere,
      }),
      this.prisma.productOrderItem.groupBy({
        by: ['productId', 'productName'],
        _sum: { quantity: true, totalUsd: true },
        where: { order: orderWhere },
        orderBy: { _sum: { totalUsd: 'desc' } },
        take: 5,
      }),
    ]);

    const result = {
      success: true,
      data: {
        totalSalesUsd: Number(Number(orderAgg._sum.totalUsd || 0).toFixed(2)),
        averageOrderValueUsd: Number(Number(orderAgg._avg.totalUsd || 0).toFixed(2)),
        totalProductOrders: orderAgg._count._all,
        topProducts: topItems.map((item) => ({
          productId: item.productId,
          name: item.productName,
          quantity: item._sum.quantity || 0,
          revenue: Number(Number(item._sum.totalUsd || 0).toFixed(2)),
        })),
        dateRange: { from, to },
      },
    };

    await this.redis.set(cacheKey, result, 60);
    return result;
  }


  // SERVICE OPERATIONS REPORTS


  async getServiceOperations(query: ReportsQueryDto) {
    const cacheKey = this.getCacheKey('services', query);
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const { from, to } = this.getDateRange(query);
    const where: Prisma.ServiceRequestWhereInput = {
      submittedAt: { gte: from, lte: to },
    };

    // Grouped in the database rather than by loading every request into node.
    const [totalRequests, grouped] = await Promise.all([
      this.prisma.serviceRequest.count({ where }),
      this.prisma.serviceRequest.groupBy({
        by: ['serviceId'],
        _count: { _all: true },
        where,
        orderBy: { _count: { serviceId: 'desc' } },
      }),
    ]);

    const services = grouped.length
      ? await this.prisma.service.findMany({
          where: { id: { in: grouped.map((g) => g.serviceId) } },
          select: { id: true, name: true, category: true },
        })
      : [];

    const serviceById = new Map(services.map((s) => [s.id, s]));

    const result = {
      success: true,
      data: {
        totalRequests,
        topServices: grouped.map((row) => ({
          serviceId: row.serviceId,
          serviceName:
            serviceById.get(row.serviceId)?.name || 'General Vacuum Service',
          category: serviceById.get(row.serviceId)?.category || null,
          count: row._count._all,
          percentage: totalRequests
            ? Number(((row._count._all / totalRequests) * 100).toFixed(1))
            : 0,
        })),
        dateRange: { from, to },
      },
    };

    await this.redis.set(cacheKey, result, 60);
    return result;
  }


  // TECHNICIAN LEADERBOARD


  async getTechnicians() {
    const cacheKey = 'reports:technicians:leaderboard';
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const technicians = await this.prisma.technician.findMany({
      include: {
        _count: {
          select: {
            assignedJobs: true,
            appointments: true,
            serviceReports: true,
          },
        },
      },
      orderBy: { completedJobs: 'desc' },
    });

    const leaderboard = technicians.map((t) => ({
      id: t.id,
      displayName: t.displayName,
      rating: Number(t.rating),
      status: t.status,
      completedJobs: t.completedJobs,
      assignedJobsCount: t._count.assignedJobs,
      serviceReportsCount: t._count.serviceReports,
    }));

    const result = {
      success: true,
      data: leaderboard,
    };

    await this.redis.set(cacheKey, result, 60);
    return result;
  }


  // CUSTOMER GROWTH REPORTS


  async getCustomers() {
    const cacheKey = 'reports:customers:growth';
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const totalCustomers = await this.prisma.customer.count();
    const customersWithOrders = await this.prisma.customer.count({
      where: {
        OR: [
          { productOrders: { some: {} } },
          { serviceRequests: { some: {} } },
        ],
      },
    });

    const result = {
      success: true,
      data: {
        totalCustomers,
        activeCustomers: customersWithOrders,
        repeatRatePercentage: totalCustomers > 0 ? Number(((customersWithOrders / totalCustomers) * 100).toFixed(1)) : 0,
      },
    };

    await this.redis.set(cacheKey, result, 60);
    return result;
  }


  // CSV DATA EXPORT METHODS


  private formatCsvRow(values: (string | number | boolean | null | undefined)[]): string {
    return values
      .map((val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(',');
  }

  async exportOrdersCsv(query: ReportsQueryDto): Promise<string> {
    const { from, to } = this.getDateRange(query);

    const orders = await this.prisma.productOrder.findMany({
      where: {
        placedAt: { gte: from, lte: to },
      },
      include: {
        customer: true,
      },
      orderBy: { placedAt: 'desc' },
    });

    const headers = [
      'Order ID',
      'Business ID',
      'Customer Name',
      'Customer Email',
      'Status',
      'Subtotal (USD)',
      'Shipping (USD)',
      'Tax (USD)',
      'Total (USD)',
      'Carrier',
      'Tracking Number',
      'Placed At',
    ];

    const rows = orders.map((o) =>
      this.formatCsvRow([
        o.id,
        o.businessId,
        o.customer?.displayName || `${o.customer?.firstName} ${o.customer?.lastName}`,
        o.customer?.email,
        o.status,
        Number(o.subtotalUsd).toFixed(2),
        Number(o.shippingFeeUsd).toFixed(2),
        Number(o.taxUsd).toFixed(2),
        Number(o.totalUsd).toFixed(2),
        o.shippingProvider || 'N/A',
        o.trackingNumber || 'N/A',
        o.placedAt.toISOString(),
      ]),
    );

    return [this.formatCsvRow(headers), ...rows].join('\n');
  }

  async exportServiceRequestsCsv(query: ReportsQueryDto): Promise<string> {
    const { from, to } = this.getDateRange(query);

    const requests = await this.prisma.serviceRequest.findMany({
      where: {
        submittedAt: { gte: from, lte: to },
      },
      include: {
        customer: true,
        service: true,
      },
      orderBy: { submittedAt: 'desc' },
    });

    const headers = [
      'Request ID',
      'Business ID',
      'Customer Name',
      'Customer Email',
      'Service Name',
      'Status',
      'Urgency',
      'Preferred Date',
      'Preferred Time',
      'City / State',
      'Submitted At',
    ];

    const rows = requests.map((r) =>
      this.formatCsvRow([
        r.id,
        r.businessId,
        r.customer?.displayName || `${r.customer?.firstName} ${r.customer?.lastName}`,
        r.customer?.email,
        r.service?.name || 'General Service',
        r.status,
        r.urgency,
        r.preferredDate || 'N/A',
        r.preferredTime || 'N/A',
        r.propertyLabel || 'N/A',
        r.submittedAt.toISOString(),
      ]),
    );

    return [this.formatCsvRow(headers), ...rows].join('\n');
  }

  async exportCustomersCsv(): Promise<string> {
    const customers = await this.prisma.customer.findMany({
      include: {
        productOrders: { select: { totalUsd: true } },
        serviceOrders: { select: { totalUsd: true } },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const headers = [
      'Customer ID',
      'Display Name',
      'Email',
      'Phone',
      'Cellphone',
      'Company',
      'Status',
      'Product Orders Count',
      'Service Orders Count',
      'Total Product Spend (USD)',
      'Total Service Spend (USD)',
      'Joined At',
    ];

    const rows = customers.map((c) => {
      const productSpend = c.productOrders.reduce(
        (sum, o) => sum + Number(o.totalUsd),
        0,
      );
      const serviceSpend = c.serviceOrders.reduce(
        (sum, o) => sum + Number(o.totalUsd),
        0,
      );

      return this.formatCsvRow([
        c.id,
        c.displayName,
        c.email,
        c.phone || '',
        c.cellphone || '',
        c.company || '',
        c.status,
        c.productOrders.length,
        c.serviceOrders.length,
        productSpend.toFixed(2),
        serviceSpend.toFixed(2),
        c.joinedAt.toISOString(),
      ]);
    });

    return [this.formatCsvRow(headers), ...rows].join('\n');
  }

  async exportInvoicesCsv(query: ReportsQueryDto): Promise<string> {
    const { from, to } = this.getDateRange(query);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        createdAt: { gte: from, lte: to },
      },
      include: {
        customer: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'Invoice ID',
      'Business ID',
      'Customer Name',
      'Customer Email',
      'Status',
      'Subtotal (USD)',
      'Tax (USD)',
      'Discount (USD)',
      'Total (USD)',
      'Due Date',
      'Created At',
    ];

    const rows = invoices.map((inv) =>
      this.formatCsvRow([
        inv.id,
        inv.businessId,
        inv.customer?.displayName || inv.customer?.email,
        inv.customer?.email,
        inv.status,
        Number(inv.subtotalUsd).toFixed(2),
        Number(inv.taxUsd).toFixed(2),
        Number(inv.discountUsd).toFixed(2),
        Number(inv.totalUsd).toFixed(2),
        inv.dueDate ? inv.dueDate.toISOString() : 'N/A',
        inv.createdAt.toISOString(),
      ]),
    );

    return [this.formatCsvRow(headers), ...rows].join('\n');
  }
}

