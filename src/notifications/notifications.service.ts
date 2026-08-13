import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
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
    referenceType?: string;
    referenceId?: string;
    emailSubject?: string;
  }) {
    await this.prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        body: params.body,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        referenceType: params.referenceType,
        referenceId: params.referenceId,
      },
    });

    if (params.email) {
      const result = await this.emailService.sendAccountEmail({
        to: params.email,
        subject: params.emailSubject ?? params.title,
        message: params.body,
      });

      await this.prisma.notification.create({
        data: {
          userId: params.userId,
          title: params.title,
          body: params.body,
          channel: NotificationChannel.EMAIL,
          status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
          sentAt: result.success ? new Date() : undefined,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
        },
      });
    }
  }
}
