import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

export async function sendVerificationEmail(
  configService: ConfigService,
  to: string,
  subject: string,
  html: string, // এখন parameter HTML
) {
  const smtpUser = configService.get<string>('AWS_SES_SMTP_USER');
  const smtpPass = configService.get<string>('AWS_SES_SMTP_PASS');
  const smtpHost =
    configService.get<string>('AWS_SES_SMTP_HOST') ??
    'email-smtp.ap-south-1.amazonaws.com';
  const smtpPort = Number(configService.get<string>('AWS_SES_SMTP_PORT') ?? 587);
  const smtpFrom = configService.get<string>('AWS_SES_FROM_EMAIL') ?? smtpUser;

  if (!smtpUser || !smtpPass || !smtpFrom || Number.isNaN(smtpPort)) {
    return {
      success: false,
      skipped: true,
      error: 'AWS SES SMTP configuration missing',
    };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const mailOptions = {
    from: smtpFrom,
    to,
    subject,
    html, // এখানে text নয়, html ব্যবহার হবে
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, info };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Email error';
    return { success: false, error: message };
  }
}
