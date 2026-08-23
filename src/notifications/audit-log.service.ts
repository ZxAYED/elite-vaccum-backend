import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    actionType: string;
    entityType: string;
    entityId: string;
    actorId?: string;
    actorRole?: UserRole;
    changes?: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
  }) {
    await this.prisma.auditLog.create({
      data: {
        action: params.actionType,
        entityType: params.entityType,
        entityId: params.entityId,
        actorId: params.actorId || null,
        actorRole: params.actorRole || UserRole.ADMIN,
        changes: params.changes,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  }
}
