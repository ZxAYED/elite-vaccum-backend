import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestDto } from './dto/update-service-request.dto';
import { ServiceRequestListQueryDto } from './dto/service-request-list-query.dto';
import { Role, ServiceRequestStatus } from '@prisma/client';
import { getPagination } from '../common/utils/pagination';
import { S3UploadService } from 'src/storage/s3-upload.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { AuditLogService } from 'src/notifications/audit-log.service';

type Actor = { id: string; role: string };

@Injectable()
export class ServiceRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3UploadService: S3UploadService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private isAdmin(actor?: Actor) {
    return actor?.role === Role.ADMIN || actor?.role === Role.STAFF;
  }

  private canTransition(from: ServiceRequestStatus, to: ServiceRequestStatus) {
    const map: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
      SUBMITTED: ['UNDER_REVIEW', 'QUOTED', 'CANCELLED'],
      UNDER_REVIEW: ['QUOTED', 'CANCELLED', 'SUBMITTED'],
      QUOTED: [
        'QUOTATION_ACCEPTED',
        'QUOTATION_REJECTED',
        'UNDER_REVIEW',
        'CANCELLED',
      ],
      QUOTATION_ACCEPTED: ['SCHEDULED', 'UNDER_REVIEW', 'CANCELLED'],
      QUOTATION_REJECTED: ['UNDER_REVIEW', 'QUOTED', 'CANCELLED'],
      SCHEDULED: ['IN_PROGRESS', 'CANCELLED', 'UNDER_REVIEW'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: ['UNDER_REVIEW'],
      CANCELLED: ['UNDER_REVIEW'],
    };
    return map[from]?.includes(to) ?? false;
  }

  private createRequestNumber() {
    return `SR-${Date.now()}`;
  }

  private resolveMediaType(mimeType: string) {
    if (mimeType.startsWith('image/')) return 'IMAGE' as const;
    if (mimeType.startsWith('video/')) return 'VIDEO' as const;
    if (mimeType.includes('pdf')) return 'PDF' as const;
    return 'DOCUMENT' as const;
  }

  async create(
    dto: CreateServiceRequestDto,
    actor?: Actor,
    files?: Express.Multer.File[],
  ) {
    if (!actor || actor.role !== Role.CUSTOMER) {
      throw new ForbiddenException('Only customer can submit service requests');
    }

    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id: dto.serviceId },
      select: {
        id: true,
        serviceCategoryId: true,
        isActive: true,
        serviceCategory: { select: { isActive: true } },
      },
    });

    if (
      !serviceType ||
      !serviceType.isActive ||
      !serviceType.serviceCategory.isActive
    ) {
      throw new BadRequestException('Invalid service type');
    }

    const created = await this.prisma.serviceRequest.create({
      data: {
        requestNumber: this.createRequestNumber(),
        customerId: actor.id,
        serviceCategoryId: serviceType.serviceCategoryId,
        serviceTypeId: serviceType.id,
        addressId: dto.addressId,
        customerMachineId: dto.customerMachineId,
        serviceLocationText: dto.serviceLocationText,
        preferredDate: dto.preferredDate
          ? new Date(dto.preferredDate)
          : undefined,
        preferredTime: dto.preferredTime,
        problemDescription: dto.description ?? 'No description provided',
        additionalNotes: dto.additionalNotes,
        previousMachineInfo: dto.previousMachineInfo,
        status: ServiceRequestStatus.SUBMITTED,
      },
      select: {
        id: true,
        requestNumber: true,
        status: true,
        customer: { select: { id: true, email: true, fullName: true } },
      },
    });

    const uploadedFiles: {
      id: string;
      url: string;
      type: string;
      fileName: string | null;
    }[] = [];

    if (files && files.length > 0) {
      for (const file of files) {
        if (
          !file.mimetype.startsWith('image/') &&
          !file.mimetype.startsWith('video/') &&
          !file.mimetype.startsWith('application/')
        ) {
          throw new BadRequestException(
            `Unsupported file type: ${file.mimetype}`,
          );
        }

        const uploaded = await this.s3UploadService.uploadFile({
          fileBuffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
          folder: 'service-requests',
        });

        const media = await this.prisma.serviceRequestMedia.create({
          data: {
            serviceRequestId: created.id,
            type: this.resolveMediaType(file.mimetype),
            url: uploaded.url,
            objectKey: uploaded.key,
            fileName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
          },
          select: {
            id: true,
            url: true,
            type: true,
            fileName: true,
          },
        });

        uploadedFiles.push(media);
      }
    }

    await this.auditLogService.log({
      actionType: 'CREATE_SERVICE_REQUEST',
      entityType: 'SERVICE_REQUEST',
      entityId: created.id,
      userId: actor.id,
      metadata: {
        requestNumber: created.requestNumber,
        filesUploaded: uploadedFiles.length,
      },
    });

    await this.notificationsService.notify({
      userId: created.customer.id,
      email: created.customer.email,
      title: 'Service request submitted',
      body: `Your service request ${created.requestNumber} has been submitted.`,
      referenceType: 'SERVICE_REQUEST',
      referenceId: created.id,
      emailSubject: 'Service request submitted',
    });

    return {
      message: 'Service request submitted successfully',
      requestId: created.id,
      requestNumber: created.requestNumber,
      status: created.status,
      files: uploadedFiles,
    };
  }

  async findAll(query: ServiceRequestListQueryDto, actor?: Actor) {
    if (!actor) {
      throw new ForbiddenException('Unauthorized');
    }

    const admin = this.isAdmin(actor);

    const where = {
      ...(admin ? {} : { customerId: actor.id }),
      ...(admin && query.status ? { status: query.status } : {}),
      ...(admin && query.customerId ? { customerId: query.customerId } : {}),
      ...(admin && query.serviceCategoryId
        ? { serviceCategoryId: query.serviceCategoryId }
        : {}),
      ...(admin && query.serviceTypeId
        ? { serviceTypeId: query.serviceTypeId }
        : {}),
    };

    const totalItems = await this.prisma.serviceRequest.count({ where });
    const pagination = getPagination(query.page, query.limit, totalItems);

    const data = await this.prisma.serviceRequest.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: 'desc' },
      include: {
        serviceCategory: { select: { id: true, name: true } },
        serviceType: { select: { id: true, name: true } },
        ...(admin
          ? { customer: { select: { id: true, fullName: true, email: true } } }
          : {}),
      },
    });

    return {
      data,
      meta: pagination.meta,
    };
  }

  async findOne(id: string, actor?: Actor) {
    if (!actor) {
      throw new ForbiddenException('Unauthorized');
    }

    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        serviceCategory: true,
        serviceType: true,
        serviceAddress: true,
        customerMachine: true,
        media: true,
        quotations: {
          orderBy: { createdAt: 'desc' },
        },
        ...(this.isAdmin(actor)
          ? {
              customer: {
                select: { id: true, fullName: true, email: true, phone: true },
              },
            }
          : {}),
      },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (!this.isAdmin(actor) && request.customerId !== actor.id) {
      throw new ForbiddenException('You can only view your own requests');
    }

    if (!this.isAdmin(actor)) {
      const { adminInternalNote, ...safe } = request;
      return safe;
    }

    return request;
  }

  async update(id: string, dto: UpdateServiceRequestDto, actor?: Actor) {
    if (!actor) {
      throw new ForbiddenException('Unauthorized');
    }

    const existing = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, email: true, fullName: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('Service request not found');
    }

    const admin = this.isAdmin(actor);

    if (!admin && existing.customerId !== actor.id) {
      throw new ForbiddenException('You can only update your own request');
    }

    if (!admin && (dto.status || dto.adminInternalNote !== undefined)) {
      throw new ForbiddenException(
        'Customer cannot update status/internal notes',
      );
    }

    let nextStatus = existing.status;
    if (admin && dto.status) {
      if (!this.canTransition(existing.status, dto.status)) {
        throw new BadRequestException(
          `Invalid status transition: ${existing.status} -> ${dto.status}`,
        );
      }
      nextStatus = dto.status;
    }

    if (!admin) {
      const customerEditedCoreDetails =
        dto.problemDescription !== undefined ||
        dto.additionalNotes !== undefined ||
        dto.previousMachineInfo !== undefined;

      // Reopen/rescope flow when customer adds details after quotation stage.
      const reopenableStatuses: ServiceRequestStatus[] = [
        ServiceRequestStatus.QUOTED,
        ServiceRequestStatus.QUOTATION_ACCEPTED,
        ServiceRequestStatus.QUOTATION_REJECTED,
        ServiceRequestStatus.SCHEDULED,
      ];

      if (
        customerEditedCoreDetails &&
        reopenableStatuses.includes(existing.status)
      ) {
        nextStatus = ServiceRequestStatus.UNDER_REVIEW;
      }
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        ...(nextStatus !== existing.status ? { status: nextStatus } : {}),
        ...(admin && dto.adminInternalNote !== undefined
          ? { adminInternalNote: dto.adminInternalNote }
          : {}),
        ...(dto.problemDescription !== undefined
          ? { problemDescription: dto.problemDescription }
          : {}),
        ...(dto.additionalNotes !== undefined
          ? { additionalNotes: dto.additionalNotes }
          : {}),
        ...(dto.previousMachineInfo !== undefined
          ? { previousMachineInfo: dto.previousMachineInfo }
          : {}),
        ...(dto.preferredDate
          ? { preferredDate: new Date(dto.preferredDate) }
          : {}),
        ...(dto.preferredTime !== undefined
          ? { preferredTime: dto.preferredTime }
          : {}),
      },
    });

    if (admin && dto.status) {
      await this.notificationsService.notify({
        userId: existing.customer.id,
        email: existing.customer.email,
        title: `Service request status updated`,
        body: `Your service request ${existing.requestNumber} status is now ${nextStatus}.`,
        referenceType: 'SERVICE_REQUEST',
        referenceId: existing.id,
      });
    }

    if (!admin && nextStatus === ServiceRequestStatus.UNDER_REVIEW) {
      const admins = await this.prisma.user.findMany({
        where: {
          role: { in: [Role.ADMIN, Role.STAFF] },
          isDeleted: false,
        },
        select: { id: true, email: true },
      });
      for (const adminUser of admins) {
        await this.notificationsService.notify({
          userId: adminUser.id,
          email: adminUser.email,
          title: 'Service request reopened',
          body: `Customer updated request ${existing.requestNumber}. Review/rescope may be required.`,
          referenceType: 'SERVICE_REQUEST',
          referenceId: existing.id,
        });
      }
    }

    await this.auditLogService.log({
      actionType: 'UPDATE_SERVICE_REQUEST',
      entityType: 'SERVICE_REQUEST',
      entityId: existing.id,
      userId: actor.id,
      metadata: { fromStatus: existing.status, toStatus: nextStatus },
    });

    return updated;
  }

  async cancel(id: string, actor?: Actor) {
    if (!actor || actor.role !== Role.CUSTOMER) {
      throw new ForbiddenException('Only customer can cancel own requests');
    }

    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: { customer: { select: { id: true, email: true } } },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.customerId !== actor.id) {
      throw new ForbiddenException('You can only cancel your own requests');
    }

    const cancellableStatuses: ServiceRequestStatus[] = [
      ServiceRequestStatus.SUBMITTED,
      ServiceRequestStatus.UNDER_REVIEW,
      ServiceRequestStatus.QUOTED,
      ServiceRequestStatus.QUOTATION_REJECTED,
    ];

    if (!cancellableStatuses.includes(request.status)) {
      throw new BadRequestException(
        'Request cannot be cancelled at this stage',
      );
    }

    await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: ServiceRequestStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    await this.auditLogService.log({
      actionType: 'CANCEL_SERVICE_REQUEST',
      entityType: 'SERVICE_REQUEST',
      entityId: request.id,
      userId: actor.id,
    });

    await this.notificationsService.notify({
      userId: request.customer.id,
      email: request.customer.email,
      title: 'Service request cancelled',
      body: `Your service request ${request.requestNumber} has been cancelled.`,
      referenceType: 'SERVICE_REQUEST',
      referenceId: request.id,
    });

    return { message: 'Service request cancelled successfully' };
  }
}
