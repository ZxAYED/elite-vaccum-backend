import { Injectable, Logger } from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentStatus,
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

  // ==========================================
  // OVERVIEW DASHBOARD METRICS
  // ==========================================

  async getOverview(query: ReportsQueryDto) {
    const cacheKey = this.getCacheKey('overview', query);
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const { from, to } = this.getDateRange(query);

    const [
      allPayments,
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
    ] = await Promise.all([
      // Completed Payments
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.SUCCEEDED },
        select: {
          amountUsd: true,
          processedAt: true,
          invoice: { select: { productOrderId: true, serviceOrderId: true } },
        },
      }),
      // Refunds
      this.prisma.refund.findMany({
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
    ]);

    const totalPaymentsUsd = allPayments.reduce((sum, p) => sum + Number(p.amountUsd), 0);
    const refundAmountUsd = allRefunds.reduce((sum, r) => sum + Number(r.amountUsd), 0);

    const productRevenueUsd = allPayments
      .filter((p) => p.invoice.productOrderId)
      .reduce((sum, p) => sum + Number(p.amountUsd), 0);

    const serviceRevenueUsd = allPayments
      .filter((p) => p.invoice.serviceOrderId)
      .reduce((sum, p) => sum + Number(p.amountUsd), 0);

    // Timeseries: Group revenue by day for last 14 days
    const revenueOverTimeMap: Record<string, { product: number; service: number; total: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      revenueOverTimeMap[key] = { product: 0, service: 0, total: 0 };
    }

    allPayments.forEach((p) => {
      const key = new Date(p.processedAt).toISOString().split('T')[0];
      if (revenueOverTimeMap[key]) {
        const amt = Number(p.amountUsd);
        if (p.invoice.productOrderId) revenueOverTimeMap[key].product += amt;
        if (p.invoice.serviceOrderId) revenueOverTimeMap[key].service += amt;
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
      },
    };

    await this.redis.set(cacheKey, result, 60);
    return result;
  }

  // ==========================================
  // SALES REPORTS
  // ==========================================

  async getSales(query: ReportsQueryDto) {
    const cacheKey = this.getCacheKey('sales', query);
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const orders = await this.prisma.productOrder.findMany({
      where: { status: { not: ProductOrderStatus.CANCELLED } },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, priceUsd: true } },
          },
        },
      },
    });

    const totalSalesUsd = orders.reduce((sum, o) => sum + Number(o.totalUsd), 0);
    const averageOrderValueUsd = orders.length > 0 ? totalSalesUsd / orders.length : 0;

    // Top selling products
    const productMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    orders.forEach((o) => {
      o.items.forEach((item) => {
        const pId = item.productId || item.productName;
        if (!productMap[pId]) {
          productMap[pId] = {
            name: item.product?.name || item.productName,
            quantity: 0,
            revenue: 0,
          };
        }
        productMap[pId].quantity += item.quantity;
        productMap[pId].revenue += Number(item.totalUsd);
      });
    });

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const result = {
      success: true,
      data: {
        totalSalesUsd: Number(totalSalesUsd.toFixed(2)),
        averageOrderValueUsd: Number(averageOrderValueUsd.toFixed(2)),
        totalProductOrders: orders.length,
        topProducts,
      },
    };

    await this.redis.set(cacheKey, result, 60);
    return result;
  }

  // ==========================================
  // SERVICE OPERATIONS REPORTS
  // ==========================================

  async getServiceOperations(query: ReportsQueryDto) {
    const cacheKey = this.getCacheKey('services', query);
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const requests = await this.prisma.serviceRequest.findMany({
      include: { service: { select: { name: true, category: true } } },
    });

    const serviceCounts: Record<string, number> = {};
    requests.forEach((r) => {
      const name = r.service?.name || 'General Vacuum Service';
      serviceCounts[name] = (serviceCounts[name] || 0) + 1;
    });

    const topServices = Object.entries(serviceCounts)
      .map(([serviceName, count]) => ({ serviceName, count }))
      .sort((a, b) => b.count - a.count);

    const result = {
      success: true,
      data: {
        totalRequests: requests.length,
        topServices,
      },
    };

    await this.redis.set(cacheKey, result, 60);
    return result;
  }

  // ==========================================
  // TECHNICIAN LEADERBOARD
  // ==========================================

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

  // ==========================================
  // CUSTOMER GROWTH REPORTS
  // ==========================================

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
}
