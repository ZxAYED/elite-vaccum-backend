export type EmailChannel = 'aws_ses_smtp';

export type EmailSendResult = {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
};

export type EmailTemplatePayload = Record<
  string,
  string | number | boolean | null | undefined
>;

export type EmailTemplateRenderResult = {
  subject: string;
  html: string;
  text?: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  attachments?: any[];
};

export enum EmailTemplateKey {
  OTP = 'OTP',
  ACCOUNT_EVENT = 'ACCOUNT_EVENT',
  SERVICE_REQUEST = 'SERVICE_REQUEST',
  ORDER_EVENT = 'ORDER_EVENT',
  PAYMENT_EVENT = 'PAYMENT_EVENT',
  QUOTATION_EVENT = 'QUOTATION_EVENT',
  SCHEDULE_EVENT = 'SCHEDULE_EVENT',
}
