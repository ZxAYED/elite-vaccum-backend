import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAddressDto } from '../dto/create-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';

@Injectable()
export class StoreAddressesService {
  constructor(private readonly prisma: PrismaService) {}



  private async resolveCustomerId(userId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (customer) return customer.id;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    const created = await this.prisma.customer.create({
      data: {
        userId: user.id,
        displayName: `${user.firstName} ${user.lastName}`.trim() || user.email,
        firstName: user.firstName || 'Customer',
        lastName: user.lastName || '',
        email: user.email,
        phone: user.phone || 'N/A',
      },
      select: { id: true },
    });

    return created.id;
  }


  async getAddresses(user: RequestUser) {
    const customerId = await this.resolveCustomerId(user.id);
    const items = await this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      items,
      totalCount: items.length,
    };
  }

  async createAddress(dto: CreateAddressDto, user: RequestUser) {
    const customerId = await this.resolveCustomerId(user.id);

    const existingCount = await this.prisma.customerAddress.count({
      where: { customerId },
    });

    // If it's the customer's first address, make it default automatically
    const isDefault = dto.isDefault || existingCount === 0;

    return this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }

      const address = await tx.customerAddress.create({
        data: {
          customerId,
          label: dto.label?.trim() || 'Home',
          line1: dto.line1.trim(),
          line2: dto.line2?.trim() || null,
          city: dto.city.trim(),
          state: dto.state.trim(),
          postalCode: dto.postalCode.trim(),
          country: dto.country?.trim() || 'USA',
          isDefault,
        },
      });

      if (isDefault) {
        await tx.customer.update({
          where: { id: customerId },
          data: { primaryAddressId: address.id },
        });
      }

      return address;
    });
  }

  async updateAddress(id: string, dto: UpdateAddressDto, user: RequestUser) {
    const customerId = await this.resolveCustomerId(user.id);

    const address = await this.prisma.customerAddress.findUnique({
      where: { id },
    });

    if (!address || address.customerId !== customerId) {
      throw new NotFoundException('Delivery address not found');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, id: { not: id } },
          data: { isDefault: false },
        });

        await tx.customer.update({
          where: { id: customerId },
          data: { primaryAddressId: id },
        });
      }

      return tx.customerAddress.update({
        where: { id },
        data: {
          ...(dto.label ? { label: dto.label.trim() } : {}),
          ...(dto.line1 ? { line1: dto.line1.trim() } : {}),
          ...(dto.line2 !== undefined ? { line2: dto.line2?.trim() || null } : {}),
          ...(dto.city ? { city: dto.city.trim() } : {}),
          ...(dto.state ? { state: dto.state.trim() } : {}),
          ...(dto.postalCode ? { postalCode: dto.postalCode.trim() } : {}),
          ...(dto.country ? { country: dto.country.trim() } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        },
      });
    });
  }

  async setDefaultAddress(id: string, user: RequestUser) {
    const customerId = await this.resolveCustomerId(user.id);

    const address = await this.prisma.customerAddress.findUnique({
      where: { id },
    });

    if (!address || address.customerId !== customerId) {
      throw new NotFoundException('Delivery address not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });

      await tx.customerAddress.update({
        where: { id },
        data: { isDefault: true },
      });

      await tx.customer.update({
        where: { id: customerId },
        data: { primaryAddressId: id },
      });
    });

    return {
      success: true,
      message: `Address '${address.label}' is now set as your active default delivery address`,
      activeAddressId: id,
    };
  }

  async deleteAddress(id: string, user: RequestUser) {
    const customerId = await this.resolveCustomerId(user.id);

    const address = await this.prisma.customerAddress.findUnique({
      where: { id },
    });

    if (!address || address.customerId !== customerId) {
      throw new NotFoundException('Delivery address not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.delete({ where: { id } });

      if (address.isDefault) {
        const nextAddress = await tx.customerAddress.findFirst({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
        });

        if (nextAddress) {
          await tx.customerAddress.update({
            where: { id: nextAddress.id },
            data: { isDefault: true },
          });
          await tx.customer.update({
            where: { id: customerId },
            data: { primaryAddressId: nextAddress.id },
          });
        } else {
          await tx.customer.update({
            where: { id: customerId },
            data: { primaryAddressId: null },
          });
        }
      }
    });

    return {
      success: true,
      message: 'Delivery address deleted successfully',
    };
  }
}
