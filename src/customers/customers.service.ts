import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { getPagination } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';

type Actor = {
  id: string;
  role: Role | string;
};

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdminRole(role: string) {
    return role === Role.ADMIN || role === Role.STAFF;
  }

  private async findCustomerOrThrow(id: string, actor?: Actor) {
    const customer = await this.prisma.user.findFirst({
      where: {
        id,
        role: Role.CUSTOMER,
      },
      include: {
        addresses: {
          orderBy: { createdAt: 'desc' },
        },
        storeOrders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            placedAt: true,
          },
          orderBy: { placedAt: 'desc' },
        },
        serviceRequests: {
          select: {
            id: true,
            requestNumber: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (
      actor &&
      !this.isAdminRole(actor.role) &&
      actor.role === Role.CUSTOMER &&
      actor.id !== customer.id
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
    status?: UserStatus;
    isDeleted?: boolean;
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
      isDeleted,
    } = params;

    const where: Prisma.UserWhereInput = {
      role: Role.CUSTOMER,
      ...(email ? { email: { contains: email, mode: 'insensitive' } } : {}),
      ...(phone ? { phone: { contains: phone, mode: 'insensitive' } } : {}),
      ...(cellphone
        ? { cellphone: { contains: cellphone, mode: 'insensitive' } }
        : {}),
      ...(fullName
        ? { fullName: { contains: fullName, mode: 'insensitive' } }
        : {}),
      ...(status ? { status } : {}),
      ...(isDeleted !== undefined ? { isDeleted } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { cellphone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const totalItems = await this.prisma.user.count({ where });
    const pagination = getPagination(page, limit, totalItems);

    const data = await this.prisma.user.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        cellphone: true,
        companyName: true,
        status: true,
        isDeleted: true,
        createdAt: true,
        _count: {
          select: {
            storeOrders: true,
            serviceRequests: true,
          },
        },
        storeOrders: {
          select: { totalAmount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enrichedData = data.map((customer) => {
      const totalSpent = customer.storeOrders.reduce(
        (sum, order) => sum + Number(order.totalAmount),
        0,
      );
      const { storeOrders, ...rest } = customer;
      return { ...rest, totalSpent };
    });

    return {
      data: enrichedData,
      meta: pagination.meta,
    };
  }

  async findOne(id: string, actor?: Actor) {
    const customer = await this.findCustomerOrThrow(id, actor);

    const totalSpent = customer.storeOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount),
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

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(updateCustomerDto.name
          ? { fullName: updateCustomerDto.name.trim() }
          : {}),
        ...(updateCustomerDto.email
          ? { email: updateCustomerDto.email.trim().toLowerCase() }
          : {}),
        ...(updateCustomerDto.phone !== undefined
          ? { phone: updateCustomerDto.phone?.trim() || null }
          : {}),
        ...(updateCustomerDto.cellphone !== undefined
          ? { cellphone: updateCustomerDto.cellphone?.trim() || null }
          : {}),
        ...(updateCustomerDto.companyName !== undefined
          ? { companyName: updateCustomerDto.companyName?.trim() || null }
          : {}),
        ...(this.isAdminRole(actor?.role ?? '') && updateCustomerDto.status
          ? { status: updateCustomerDto.status }
          : {}),
        ...(this.isAdminRole(actor?.role ?? '') &&
        updateCustomerDto.isDeleted !== undefined
          ? { isDeleted: updateCustomerDto.isDeleted }
          : {}),
      },
      include: {
        addresses: true,
      },
    });
  }
}
