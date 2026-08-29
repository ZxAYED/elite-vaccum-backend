import {
  EmailTemplateKey,
  type EmailTemplatePayload,
  type EmailTemplateRenderResult,
} from '../types/email.types';

function getLogoUrl(): string {
  return (
    process.env.EMAIL_LOGO_URL ||
    'https://res.cloudinary.com/dhl04adhz/image/upload/v1787991498/logo_ynl1ku.png'
  );
}

function getFrontendUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

interface ShellOptions {
  title: string;
  body: string;
}

function renderShell(options: ShellOptions): string {
  const { title, body } = options;
  const logoUrl = getLogoUrl();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #fcfcfb;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #122428;
    }
  </style>
</head>
<body style="margin:0; padding:40px 16px; background-color:#fcfcfb; font-family:'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#122428;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <!-- Main Card (Clean, Minimalist Surface) -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px; background-color:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #edf2f1; box-shadow:0 2px 12px rgba(18, 36, 40, 0.03);">
          
          <!-- Logo Header -->
          <tr>
            <td style="padding:32px 32px 20px; text-align:center; border-bottom:1px solid #f4f7f6;">
              <img src="${logoUrl}" alt="Elite Central Vacuum" style="height:44px; max-width:200px; object-fit:contain; display:inline-block; border:0;" />
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:32px; font-size:14px; line-height:1.65; color:#3c4f52;">
              ${body}
            </td>
          </tr>

          <!-- Minimal Footer -->
          <tr>
            <td style="padding:20px 32px; background-color:#fafbfb; border-top:1px solid #edf2f1; font-size:11px; line-height:1.5; color:#859a9e; text-align:center;">
              <p style="margin:0 0 4px; color:#5a6e72;">
                Elite Central Vacuum Systems
              </p>
              <p style="margin:0;">
                Questions? Contact <a href="mailto:support@elitecentralvac.com" style="color:#1c4f50; text-decoration:none;">support@elitecentralvac.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderEmailTemplate(
  template: EmailTemplateKey,
  payload: EmailTemplatePayload,
): EmailTemplateRenderResult {
  switch (template) {
    case EmailTemplateKey.OTP: {
      const otp = String(payload.otp ?? '');
      const minutes = String(payload.validForMinutes ?? '10');
      const subject = String(payload.subject ?? 'Verify Your Email');

      const body = `
        <h2 style="margin:0 0 12px; font-size:18px; font-weight:600; color:#122428;">
          Verify Your Email
        </h2>
        <p style="margin:0 0 24px; color:#4a5f63;">
          Please use the verification code below to complete your authentication:
        </p>

        <!-- Clean Minimal OTP Box -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;">
          <tr>
            <td align="center">
              <div style="display:inline-block; padding:16px 32px; background-color:#f4f7f6; border-radius:10px; text-align:center;">
                <div style="font-size:32px; font-weight:700; letter-spacing:8px; color:#1c4f50; font-family:monospace, 'Poppins', sans-serif; padding-left:8px;">
                  ${otp}
                </div>
              </div>
            </td>
          </tr>
        </table>

        <p style="margin:20px 0 0; font-size:12px; color:#859a9e; text-align:center;">
          This code expires in ${minutes} minutes. If you did not request this, please ignore this email.
        </p>
      `;

      return {
        subject,
        html: renderShell({
          title: subject,
          body,
        }),
      };
    }

    case EmailTemplateKey.ACCOUNT_EVENT: {
      const subject = String(payload.subject ?? 'Account Notification');
      const message = String(payload.message ?? 'An account update occurred.');

      const body = `
        <h2 style="margin:0 0 12px; font-size:18px; font-weight:600; color:#122428;">
          ${subject}
        </h2>
        <p style="margin:0 0 16px; color:#4a5f63;">
          ${message}
        </p>
      `;

      return {
        subject,
        html: renderShell({
          title: subject,
          body,
        }),
      };
    }

    case EmailTemplateKey.SERVICE_REQUEST: {
      const subject = String(payload.subject ?? 'Service Request Update');
      const message = String(payload.message ?? 'Your service request has an update.');

      const body = `
        <h2 style="margin:0 0 12px; font-size:18px; font-weight:600; color:#122428;">
          Service Request Update
        </h2>
        <p style="margin:0 0 24px; color:#4a5f63;">
          ${message}
        </p>
        <div style="margin:20px 0 0;">
          <a href="${getFrontendUrl()}/service" style="display:inline-block; padding:10px 22px; background-color:#1c4f50; color:#ffffff; text-decoration:none; font-weight:600; font-size:13px; border-radius:6px;">
            View Request
          </a>
        </div>
      `;

      return {
        subject,
        html: renderShell({
          title: subject,
          body,
        }),
      };
    }

    case EmailTemplateKey.ORDER_EVENT: {
      const subject = String(payload.subject ?? 'Order Update');
      const message = String(payload.message ?? 'Your order status has changed.');

      const body = `
        <h2 style="margin:0 0 12px; font-size:18px; font-weight:600; color:#122428;">
          Order Update
        </h2>
        <p style="margin:0 0 24px; color:#4a5f63;">
          ${message}
        </p>
        <div style="margin:20px 0 0;">
          <a href="${getFrontendUrl()}/store" style="display:inline-block; padding:10px 22px; background-color:#1c4f50; color:#ffffff; text-decoration:none; font-weight:600; font-size:13px; border-radius:6px;">
            Track Order
          </a>
        </div>
      `;

      return {
        subject,
        html: renderShell({
          title: subject,
          body,
        }),
      };
    }

    case EmailTemplateKey.PAYMENT_EVENT: {
      const subject = String(payload.subject ?? 'Payment Receipt');
      const message = String(payload.message ?? 'Your payment has been recorded.');

      const body = `
        <h2 style="margin:0 0 12px; font-size:18px; font-weight:600; color:#122428;">
          Payment Receipt
        </h2>
        <p style="margin:0 0 24px; color:#4a5f63;">
          ${message}
        </p>
        <div style="margin:20px 0 0;">
          <a href="${getFrontendUrl()}/account/invoices" style="display:inline-block; padding:10px 22px; background-color:#1c4f50; color:#ffffff; text-decoration:none; font-weight:600; font-size:13px; border-radius:6px;">
            View Invoice
          </a>
        </div>
      `;

      return {
        subject,
        html: renderShell({
          title: subject,
          body,
        }),
      };
    }

    case EmailTemplateKey.QUOTATION_EVENT: {
      const subject = String(payload.subject ?? 'Quotation Available');
      const message = String(payload.message ?? 'A new quotation has been prepared for your central vacuum service.');

      const body = `
        <h2 style="margin:0 0 12px; font-size:18px; font-weight:600; color:#122428;">
          Service Quotation
        </h2>
        <p style="margin:0 0 24px; color:#4a5f63;">
          ${message}
        </p>
        <div style="margin:20px 0 0;">
          <a href="${getFrontendUrl()}/quotations" style="display:inline-block; padding:10px 22px; background-color:#1c4f50; color:#ffffff; text-decoration:none; font-weight:600; font-size:13px; border-radius:6px;">
            Review Quotation
          </a>
        </div>
      `;

      return {
        subject,
        html: renderShell({
          title: subject,
          body,
        }),
      };
    }

    case EmailTemplateKey.SCHEDULE_EVENT: {
      const subject = String(payload.subject ?? 'Appointment Scheduled');
      const message = String(payload.message ?? 'Your technician dispatch appointment has been scheduled.');

      const body = `
        <h2 style="margin:0 0 12px; font-size:18px; font-weight:600; color:#122428;">
          Appointment Scheduled
        </h2>
        <p style="margin:0 0 24px; color:#4a5f63;">
          ${message}
        </p>
        <div style="margin:20px 0 0;">
          <a href="${getFrontendUrl()}/schedule" style="display:inline-block; padding:10px 22px; background-color:#1c4f50; color:#ffffff; text-decoration:none; font-weight:600; font-size:13px; border-radius:6px;">
            View Appointment
          </a>
        </div>
      `;

      return {
        subject,
        html: renderShell({
          title: subject,
          body,
        }),
      };
    }

    default: {
      return {
        subject: 'Notification',
        html: renderShell({
          title: 'Notification',
          body: `<p style="margin:0;">${String(payload.message ?? 'You have a new update.')}</p>`,
        }),
      };
    }
  }
}
