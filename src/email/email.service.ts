import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { renderEmailTemplate } from './templates/email.templates';
import {
  EmailTemplateKey,
  type EmailSendResult,
  type EmailTemplatePayload,
  type SendEmailInput,
} from './types/email.types';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  private createTransporter() {
    const rawUser =
      this.configService.get<string>('SMTP_USER') ||
      this.configService.get<string>('AWS_SES_SMTP_USER');
    const rawPass =
      this.configService.get<string>('SMTP_PASS') ||
      this.configService.get<string>('AWS_SES_SMTP_PASS');
    const smtpUser = rawUser?.trim();
    const smtpPass = rawPass?.replace(/\s+/g, '');
    const smtpHost =
      this.configService.get<string>('SMTP_HOST') ||
      this.configService.get<string>('AWS_SES_SMTP_HOST') ||
      'smtp.gmail.com';
    const smtpPort = Number(
      this.configService.get<string>('SMTP_PORT') ||
      this.configService.get<string>('AWS_SES_SMTP_PORT') ||
      '587',
    );
    const smtpSecure =
      this.configService.get<string>('SMTP_SECURE') === 'true' ||
      smtpPort === 465;

    if (!smtpUser || !smtpPass || Number.isNaN(smtpPort)) {
      return null;
    }

    return {
      transporter: nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      }),
      defaultFrom:
        this.configService.get<string>('SMTP_FROM_EMAIL') ||
        this.configService.get<string>('AWS_SES_FROM_EMAIL') ||
        smtpUser,
    };
  }

  async sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
    const mailer = this.createTransporter();
    if (!mailer) {
      this.logger.warn('SMTP credentials unconfigured. Email dispatch skipped.');
      return {
        success: false,
        skipped: true,
        error: 'SMTP configuration missing in .env (SMTP_USER / SMTP_PASS)',
      };
    }

    const localLogoPath = path.resolve(process.cwd(), 'images', 'logo.png');
    const attachments: Array<{ filename: string; path: string; cid: string }> = [];
    if (fs.existsSync(localLogoPath)) {
      attachments.push({
        filename: 'logo.png',
        path: localLogoPath,
        cid: 'elite-logo',
      });
    }

    try {
      const info = await mailer.transporter.sendMail({
        from: input.from ?? mailer.defaultFrom,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Email send error';
      this.logger.error(`Email send failed: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  }

  async sendTemplateEmail(params: {
    to: string;
    template: EmailTemplateKey;
    payload: EmailTemplatePayload;
  }) {
    const rendered = renderEmailTemplate(params.template, params.payload);
    return this.sendEmail({
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  async sendOtpEmail(params: {
    to: string;
    otp: string;
    validForMinutes: number;
    subject?: string;
  }) {
    return this.sendTemplateEmail({
      to: params.to,
      template: EmailTemplateKey.OTP,
      payload: {
        otp: params.otp,
        validForMinutes: params.validForMinutes,
        subject: params.subject,
      },
    });
  }

  async sendAccountEmail(params: {
    to: string;
    subject: string;
    message: string;
  }) {
    return this.sendTemplateEmail({
      to: params.to,
      template: EmailTemplateKey.ACCOUNT_EVENT,
      payload: {
        subject: params.subject,
        message: params.message,
      },
    });
  }

  async sendServiceRequestEmail(params: {
    to: string;
    subject: string;
    message: string;
  }) {
    return this.sendTemplateEmail({
      to: params.to,
      template: EmailTemplateKey.SERVICE_REQUEST,
      payload: {
        subject: params.subject,
        message: params.message,
      },
    });
  }

  async sendOrderEmail(params: {
    to: string;
    subject: string;
    message: string;
  }) {
    return this.sendTemplateEmail({
      to: params.to,
      template: EmailTemplateKey.ORDER_EVENT,
      payload: {
        subject: params.subject,
        message: params.message,
      },
    });
  }

  async sendPaymentEmail(params: {
    to: string;
    subject: string;
    message: string;
  }) {
    return this.sendTemplateEmail({
      to: params.to,
      template: EmailTemplateKey.PAYMENT_EVENT,
      payload: {
        subject: params.subject,
        message: params.message,
      },
    });
  }

  async sendQuotationEmail(params: {
    to: string;
    subject: string;
    message: string;
  }) {
    return this.sendTemplateEmail({
      to: params.to,
      template: EmailTemplateKey.QUOTATION_EVENT,
      payload: {
        subject: params.subject,
        message: params.message,
      },
    });
  }

  async sendScheduleEmail(params: {
    to: string;
    subject: string;
    message: string;
  }) {
    return this.sendTemplateEmail({
      to: params.to,
      template: EmailTemplateKey.SCHEDULE_EVENT,
      payload: {
        subject: params.subject,
        message: params.message,
      },
    });
  }
}
