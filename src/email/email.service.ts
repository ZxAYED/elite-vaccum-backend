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
    const smtpUser = this.configService.get<string>('AWS_SES_SMTP_USER');
    const smtpPass = this.configService.get<string>('AWS_SES_SMTP_PASS');
    const smtpHost =
      this.configService.get<string>('AWS_SES_SMTP_HOST') ??
      'email-smtp.us-east-1.amazonaws.com';
    const smtpPort = Number(
      this.configService.get<string>('AWS_SES_SMTP_PORT') ?? 587,
    );

    if (!smtpUser || !smtpPass || Number.isNaN(smtpPort)) {
      return null;
    }

    return {
      transporter: nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: false,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      }),
      defaultFrom:
        this.configService.get<string>('AWS_SES_FROM_EMAIL') ?? smtpUser,
    };
  }

  async sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
    const mailer = this.createTransporter();
    if (!mailer) {
      return {
        success: false,
        skipped: true,
        error: 'AWS SES SMTP configuration missing',
      };
    }

    try {
      const info = await mailer.transporter.sendMail({
        from: input.from ?? mailer.defaultFrom,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
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
