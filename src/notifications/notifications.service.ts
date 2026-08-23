import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { EmailService } from 'src/email/email.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async notify(params: {
    userId: string;
    email?: string;
    title: string;
    body: string;
    type?: NotificationType;
    referenceType?: string;
    referenceId?: string;
    emailSubject?: string;
  }) {
    await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type || NotificationType.SYSTEM_ALERT,
        title: params.title,
        message: params.body,
        isRead: false,
        metadata: {
          referenceType: params.referenceType,
          referenceId: params.referenceId,
        },
      },
    });

    if (params.email) {
      await this.emailService.sendAccountEmail({
        to: params.email,
        subject: params.emailSubject ?? params.title,
        message: params.body,
      });
    }
  }
}
