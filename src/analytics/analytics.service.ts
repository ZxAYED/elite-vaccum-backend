// import { Injectable } from '@nestjs/common';
// import { PrismaService } from '../prisma/prisma.service';

// @Injectable()
// export class AnalyticsService {
//   constructor(private readonly prisma: PrismaService) {}

//   async getDashboardMetrics() {
//     const [totalRevenue, totalOrders, activeTechnicians, totalCustomers] =
//       await Promise.all([
//         this.prisma.transaction.aggregate({
//           _sum: { amount: true },
//           where: { status: 'COMPLETED' },
//         }),
//         this.prisma.order.count(),
//         this.prisma.technician.count({ where: { status: { not: 'OFFLINE' } } }),
//         this.prisma.customer.count(),
//       ]);

//     // Mock trend percentages for now (would need historical data comparison)
//     return {
//       totalRevenue: { value: totalRevenue._sum.amount ?? 0, trend: 12.5 },
//       totalOrders: { value: totalOrders, trend: -8.2 },
//       activeTechnicians: { value: activeTechnicians, trend: 3 },
//       totalCustomers: { value: totalCustomers, trend: -2.4 },
//     };
//   }

//   async getServiceDistribution() {
//     const distribution = await this.prisma.order.groupBy({
//       by: ['serviceId'],
//       _count: { id: true },
//     });

//     const services = await this.prisma.service.findMany({
//       where: { id: { in: distribution.map((d) => d.serviceId) } },
//       select: { id: true, name: true },
//     });

//     const total = distribution.reduce((sum, d) => sum + d._count.id, 0);

//     return distribution.map((d) => {
//       const service = services.find((s) => s.id === d.serviceId);
//       return {
//         name: service?.name ?? 'Unknown',
//         value: d._count.id,
//         percentage: total > 0 ? (d._count.id / total) * 100 : 0,
//       };
//     });
//   }

//   async getRevenueTrend() {
//     // Last 6 months
//     const sixMonthsAgo = new Date();
//     sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

//     const transactions = await this.prisma.transaction.findMany({
//       where: {
//         date: { gte: sixMonthsAgo },
//         status: 'COMPLETED',
//       },
//       select: { date: true, amount: true },
//     });

//     const trend: Record<string, number> = {};
//     transactions.forEach((t) => {
//       const month = t.date.toLocaleString('default', { month: 'short' });
//       trend[month] = (trend[month] || 0) + Number(t.amount);
//     });

//     return Object.entries(trend).map(([month, amount]) => ({ month, amount }));
//   }
// }
