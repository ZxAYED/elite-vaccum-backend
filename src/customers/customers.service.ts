import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerStatus, Prisma, UserRole } from '@prisma/client';
import { getPagination } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';

type Actor = {
  id: string;
  role: UserRole | string;
};

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdminRole(role?: string) {
    return role === UserRole.ADMIN || role === 'ADMIN';
  }

  private async findCustomerOrThrow(id: string, actor?: Actor) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        OR: [{ id }, { userId: id }],
      },
      include: {
        addresses: {
          orderBy: { createdAt: 'desc' },
        },
        productOrders: {
          select: {
            id: true,
            businessId: true,
            status: true,
            totalUsd: true,
            placedAt: true,
          },
          orderBy: { placedAt: 'desc' },
        },
        serviceRequests: {
          select: {
            id: true,
            businessId: true,
            status: true,
            title: true,
            submittedAt: true,
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (
      actor &&
      !this.isAdminRole(actor.role) &&
      actor.id !== customer.id &&
      actor.id !== customer.userId
    ) {
      throw new ForbiddenException(
        'You can only access your own customer profile',
      );
    }

    return customer;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    email?: string;
    phone?: string;
    cellphone?: string;
    fullName?: string;
    status?: CustomerStatus;
  }) {
    const {
      page,
      limit,
      search,
      email,
      phone,
      cellphone,
      fullName,
      status,
    } = params;

    const where: Prisma.CustomerWhereInput = {
      ...(email ? { email: { contains: email, mode: 'insensitive' } } : {}),
      ...(phone ? { phone: { contains: phone, mode: 'insensitive' } } : {}),
      ...(cellphone
        ? { cellphone: { contains: cellphone, mode: 'insensitive' } }
        : {}),
      ...(fullName
        ? { displayName: { contains: fullName, mode: 'insensitive' } }
        : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { cellphone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const totalItems = await this.prisma.customer.count({ where });
    const pagination = getPagination(page, limit, totalItems);

    const data = await this.prisma.customer.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      include: {
        _count: {
          select: {
            productOrders: true,
            serviceRequests: true,
          },
        },
        productOrders: {
          select: { totalUsd: true },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const enrichedData = data.map((customer) => {
      const totalSpent = customer.productOrders.reduce(
        (sum, order) => sum + Number(order.totalUsd),
        0,
      );
      const { productOrders, ...rest } = customer;
      return { ...rest, totalSpent };
    });

    return {
      data: enrichedData,
      meta: pagination.meta,
    };
  }

  async findOne(id: string, actor?: Actor) {
    const customer = await this.findCustomerOrThrow(id, actor);

    const totalSpent = customer.productOrders.reduce(
      (sum, order) => sum + Number(order.totalUsd),
      0,
    );

    return {
      ...customer,
      totalSpent,
    };
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
    actor?: Actor,
  ) {
    const existing = await this.findCustomerOrThrow(id, actor);

    const parts = updateCustomerDto.name?.trim().split(' ') || [];
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    return this.prisma.customer.update({
      where: { id: existing.id },
      data: {
        ...(updateCustomerDto.name
          ? {
              displayName: updateCustomerDto.name.trim(),
              ...(firstName ? { firstName } : {}),
              ...(lastName !== undefined ? { lastName } : {}),
            }
          : {}),
        ...(updateCustomerDto.email
          ? { email: updateCustomerDto.email.trim().toLowerCase() }
          : {}),
        ...(updateCustomerDto.phone !== undefined
          ? { phone: updateCustomerDto.phone?.trim() || '' }
          : {}),
        ...(updateCustomerDto.cellphone !== undefined
          ? { cellphone: updateCustomerDto.cellphone?.trim() || null }
          : {}),
        ...(updateCustomerDto.companyName !== undefined
          ? { company: updateCustomerDto.companyName?.trim() || null }
          : {}),
        ...(this.isAdminRole(actor?.role) && updateCustomerDto.status
          ? { status: updateCustomerDto.status }
          : {}),
      },
      include: {
        addresses: true,
      },
    });
  }
}
