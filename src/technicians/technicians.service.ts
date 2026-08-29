import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TechnicianStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { getPagination } from 'src/common/utils/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { TechnicianListQueryDto, UpdateTechnicianDto } from './dto/update-technician.dto';

@Injectable()
export class TechniciansService {
  constructor(private readonly prisma: PrismaService) {}

  private includeRelations() {
    return {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
        },
      },
      _count: {
        select: {
          assignedRequests: true,
          assignedJobs: true,
          appointments: true,
          serviceReports: true,
        },
      },
    } satisfies Prisma.TechnicianInclude;
  }

  async findAll(query: TechnicianListQueryDto) {
    const where: Prisma.TechnicianWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.specialization
        ? { specializations: { has: query.specialization } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { displayName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const totalItems = await this.prisma.technician.count({ where });
    const { skip, take, meta } = getPagination(
      query.page,
      query.limit,
      totalItems,
    );

    const items = await this.prisma.technician.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: this.includeRelations(),
    });

    const activeCount = await this.prisma.technician.count({
      where: { status: TechnicianStatus.ACTIVE },
    });
    const onLeaveCount = await this.prisma.technician.count({
      where: { status: TechnicianStatus.ON_LEAVE },
    });

    return {
      items,
      meta: {
        ...meta,
        stats: {
          active: activeCount,
          onLeave: onLeaveCount,
          total: totalItems,
        },
      },
    };
  }

  async findOne(id: string) {
    const technician = await this.prisma.technician.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
          },
        },
        assignedRequests: {
          take: 5,
          orderBy: { submittedAt: 'desc' },
          select: {
            id: true,
            businessId: true,
            title: true,
            status: true,
            preferredDate: true,
          },
        },
        assignedJobs: {
          take: 5,
          orderBy: { scheduledAt: 'desc' },
          select: {
            id: true,
            businessId: true,
            status: true,
            scheduledAt: true,
            totalUsd: true,
          },
        },
        appointments: {
          take: 5,
          orderBy: { startAt: 'desc' },
          select: {
            id: true,
            status: true,
            startAt: true,
            endAt: true,
            notes: true,
          },
        },
        serviceReports: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            assignedRequests: true,
            assignedJobs: true,
            appointments: true,
            serviceReports: true,
          },
        },
      },
    });

    if (!technician) {
      throw new NotFoundException('Technician not found');
    }

    return technician;
  }

  async create(dto: CreateTechnicianDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const parts = dto.displayName.trim().split(' ');
    const firstName = parts[0] || 'Technician';
    const lastName = parts.slice(1).join(' ') || '';
    const passwordHash = await bcrypt.hash(dto.password || 'Password123!', 10);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          firstName,
          lastName,
          phone: dto.phone.trim(),
          passwordHash,
          role: UserRole.TECHNICIAN,
          isActive: true,
          emailVerifiedAt: new Date(),
        },
      });

      const technician = await tx.technician.create({
        data: {
          userId: user.id,
          displayName: dto.displayName.trim(),
          email,
          phone: dto.phone.trim(),
          status: dto.status || TechnicianStatus.ACTIVE,
          specializations: dto.specializations || [],
          defaultAvailability: dto.defaultAvailability
            ? (dto.defaultAvailability as Prisma.InputJsonValue)
            : Prisma.DbNull,
          adminNotes: dto.adminNotes?.trim() || null,
        },
        include: this.includeRelations(),
      });

      return {
        success: true,
        message: 'Technician account created successfully',
        technician,
      };
    });
  }

  async update(id: string, dto: UpdateTechnicianDto) {
    const existing = await this.prisma.technician.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Technician not found');
    }

    const updated = await this.prisma.technician.update({
      where: { id },
      data: {
        ...(dto.displayName ? { displayName: dto.displayName.trim() } : {}),
        ...(dto.phone ? { phone: dto.phone.trim() } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.rating !== undefined ? { rating: new Prisma.Decimal(dto.rating) } : {}),
        ...(dto.completedJobs !== undefined ? { completedJobs: dto.completedJobs } : {}),
        ...(dto.specializations ? { specializations: dto.specializations } : {}),
        ...(dto.defaultAvailability !== undefined
          ? {
              defaultAvailability: dto.defaultAvailability
                ? (dto.defaultAvailability as Prisma.InputJsonValue)
                : Prisma.DbNull,
            }
          : {}),
        ...(dto.adminNotes !== undefined ? { adminNotes: dto.adminNotes?.trim() || null } : {}),
      },
      include: this.includeRelations(),
    });

    return {
      success: true,
      message: 'Technician updated successfully',
      technician: updated,
    };
  }

  async remove(id: string) {
    const existing = await this.prisma.technician.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Technician not found');
    }

    await this.prisma.$transaction([
      this.prisma.technician.delete({ where: { id } }),
      this.prisma.user.delete({ where: { id: existing.userId } }),
    ]);

    return {
      success: true,
      message: 'Technician deleted successfully',
    };
  }
}
