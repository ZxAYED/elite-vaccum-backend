import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    actionType: string;
    entityType: string;
    entityId: string;
    userId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    await this.prisma.auditLog.create({
      data: {
        actionType: params.actionType,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.userId,
        metadata: params.metadata,
      },
    });
  }
}
