import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, TechnicianStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { getPagination } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';

@Injectable()
export class TechniciansService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUniqueTechnicianEmail(
    email: string,
    excludeUserId?: string,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, role: true },
    });

    if (!existing) {
      return;
    }

    if (excludeUserId && existing.id === excludeUserId) {
      return;
    }

    if (existing.role === Role.TECHNICIAN) {
      throw new ConflictException('Technician with this email already exists');
    }

    throw new ConflictException('Email already used by another account');
  }

  private async findTechnicianOrThrow(id: string) {
    const technician = await this.prisma.technicianProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            cellphone: true,
            status: true,
            isDeleted: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        specializations: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!technician) {
      throw new NotFoundException('Technician not found');
    }

    return technician;
  }

  async create(createTechnicianDto: CreateTechnicianDto) {
    const { specializations = [], email, name, phone } = createTechnicianDto;
    const normalizedEmail = email.trim().toLowerCase();

    await this.ensureUniqueTechnicianEmail(normalizedEmail);

    const temporaryPassword = `Temp#${Math.random().toString(36).slice(-10)}A1`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    return this.prisma.technicianProfile.create({
      data: {
        user: {
          create: {
            email: normalizedEmail,
            fullName: name.trim(),
            phone: phone?.trim() || null,
            passwordHash,
            role: Role.TECHNICIAN,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
          },
        },
        specializations: {
          connectOrCreate: specializations.map((spec) => ({
            where: { name: spec.trim() },
            create: { name: spec.trim() },
          })),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            cellphone: true,
            status: true,
            isDeleted: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        specializations: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: TechnicianStatus;
    verified?: boolean;
  }) {
    const { page, limit, search, status, verified } = params;
    const where: Prisma.TechnicianProfileWhereInput = {
      ...(status ? { status } : {}),
      ...(verified !== undefined ? { isVerified: verified } : {}),
      ...(search
        ? {
            OR: [
              {
                user: {
                  fullName: { contains: search, mode: 'insensitive' },
                },
              },
              {
                user: {
                  email: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const totalItems = await this.prisma.technicianProfile.count({ where });
    const pagination = getPagination(page, limit, totalItems);

    const data = await this.prisma.technicianProfile.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            cellphone: true,
            status: true,
            isDeleted: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        specializations: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      data,
      meta: pagination.meta,
    };
  }

  async findOne(id: string) {
    return this.findTechnicianOrThrow(id);
  }

  async update(id: string, updateTechnicianDto: UpdateTechnicianDto) {
    const existing = await this.findTechnicianOrThrow(id);
    const {
      specializations,
      status,
      isVerified,
      name,
      email,
      phone,
      cellphone,
      isAccountDeleted,
      userStatus,
      ...profileFields
    } = updateTechnicianDto;

    if (email) {
      await this.ensureUniqueTechnicianEmail(
        email.trim().toLowerCase(),
        existing.user.id,
      );
    }

    return this.prisma.technicianProfile.update({
      where: { id },
      data: {
        ...profileFields,
        ...(status ? { status } : {}),
        ...(isVerified !== undefined ? { isVerified } : {}),
        ...(specializations
          ? {
              specializations: {
                set: [],
                connectOrCreate: specializations.map((spec) => ({
                  where: { name: spec.trim() },
                  create: { name: spec.trim() },
                })),
              },
            }
          : {}),
        user: {
          update: {
            ...(name ? { fullName: name.trim() } : {}),
            ...(email ? { email: email.trim().toLowerCase() } : {}),
            ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
            ...(cellphone !== undefined
              ? { cellphone: cellphone?.trim() || null }
              : {}),
            ...(isAccountDeleted !== undefined
              ? { isDeleted: isAccountDeleted }
              : {}),
            ...(userStatus ? { status: userStatus } : {}),
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            cellphone: true,
            status: true,
            isDeleted: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        specializations: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async verify(id: string) {
    await this.findTechnicianOrThrow(id);

    return this.prisma.technicianProfile.update({
      where: { id },
      data: {
        isVerified: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            cellphone: true,
            status: true,
            isDeleted: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        specializations: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}
