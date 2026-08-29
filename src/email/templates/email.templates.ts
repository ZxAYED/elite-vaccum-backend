import {
  EmailTemplateKey,
  type EmailTemplatePayload,
  type EmailTemplateRenderResult,
} from '../types/email.types';

function getAppBaseUrl(): string {
  return (
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

interface ShellOptions {
  title: string;
  badge?: string;
  body: string;
}

function renderShell(options: ShellOptions): string {
  const { title, badge, body } = options;
  const baseUrl = getAppBaseUrl();
  const logoUrl = `${baseUrl}/image/logo.png`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    /* CSS Variables & Tokens:
       --background: #fcfcfb;
       --foreground: #122428;
       --surface: #ffffff;
       --surface-muted: #f4f7f6;
       --brand: #1c4f50;
       --brand-hover: #153d3e;
    */
    body {
      margin: 0;
      padding: 0;
      background-color: #fcfcfb;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #122428;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-collapse: collapse;
    }
  </style>
</head>
<body style="margin:0; padding:32px 16px; background-color:#fcfcfb; font-family:'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#122428;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <!-- Main Card Container (max-width: 600px) -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5eceb; box-shadow:0 4px 20px rgba(18, 36, 40, 0.04);">
          
          <!-- Header Banner (Brand Gradient) -->
          <tr>
            <td style="padding:32px 32px 28px; background:linear-gradient(135deg, #1c4f50 0%, #153d3e 100%); text-align:center;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center">
                    <!-- Brand Logo with Fallback Styling -->
                    <div style="margin-bottom:12px;">
                      <img src="${logoUrl}" alt="Elite Central Vacuum" style="height:48px; max-width:200px; object-fit:contain; display:inline-block;" onerror="this.style.display='none'; document.getElementById('text-brand-logo').style.display='block';" />
                      <div id="text-brand-logo" style="display:none; color:#ffffff; font-size:22px; font-weight:800; letter-spacing:1px; text-transform:uppercase;">
                        ELITE CENTRAL VACUUM
                      </div>
                    </div>
                    
                    ${
                      badge
                        ? `<div style="display:inline-block; padding:4px 12px; background-color:rgba(255, 255, 255, 0.15); border:1px solid rgba(255, 255, 255, 0.25); border-radius:20px; color:#ffffff; font-size:11px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:10px;">${badge}</div>`
                        : ''
                    }
                    
                    <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700; line-height:1.3; letter-spacing:-0.2px;">
                      ${title}
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Email Content Body -->
          <tr>
            <td style="padding:36px 32px; font-size:15px; line-height:1.7; color:#122428;">
              ${body}
            </td>
          </tr>

          <!-- Security / Assurance Footer -->
          <tr>
            <td style="padding:24px 32px; background-color:#f4f7f6; border-top:1px solid #e5eceb; font-size:12px; line-height:1.6; color:#5a6e72; text-align:center;">
              <p style="margin:0 0 8px; font-weight:600; color:#1c4f50;">
                Elite Central Vacuum Systems
              </p>
              <p style="margin:0 0 12px;">
                Premium Built-in Vacuum Solutions • Sales, Installation & Certified Maintenance
              </p>
              <p style="margin:0; font-size:11px; color:#859a9e;">
                This is an automated transactional notification. If you have questions, please contact our support team at <a href="mailto:support@elitecentralvac.com" style="color:#1c4f50; text-decoration:underline;">support@elitecentralvac.com</a>.
              </p>
              <p style="margin:8px 0 0; font-size:11px; color:#859a9e;">
                © ${new Date().getFullYear()} Elite Central Vacuum. All rights reserved.
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
        <p style="margin:0 0 16px; font-size:16px; font-weight:500;">
          Hello,
        </p>
        <p style="margin:0 0 24px; color:#3a4e52;">
          Thank you for choosing Elite Central Vacuum. Use the verification code below to verify your email address and continue:
        </p>

        <!-- Verification OTP Card -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0;">
          <tr>
            <td align="center">
              <div style="display:inline-block; padding:20px 36px; background-color:#f4f7f6; border:2px dashed #1c4f50; border-radius:14px; text-align:center;">
                <div style="font-size:12px; font-weight:600; color:#5a6e72; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
                  Your One-Time Code
                </div>
                <div style="font-size:38px; font-weight:800; letter-spacing:10px; color:#1c4f50; font-family:monospace, 'Poppins', sans-serif; padding-left:10px;">
                  ${otp}
                </div>
                <div style="display:inline-block; margin-top:10px; padding:4px 12px; background-color:#e6efef; border-radius:12px; font-size:12px; font-weight:600; color:#1c4f50;">
                  ⏱️ Expires in ${minutes} minutes
                </div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Security Warning Box -->
        <div style="padding:16px; background-color:#fcfcfb; border-left:4px solid #1c4f50; border-radius:4px 8px 8px 4px; margin:24px 0 16px; font-size:13px; color:#4a5f63;">
          <strong>Security Notice:</strong> Never share this one-time password with anyone. Elite Central Vacuum staff will never ask for your code over the phone or via email. If you did not request this verification, you can safely ignore this email.
        </div>
      `;

      return {
        subject,
        html: renderShell({
          title: subject,
          badge: 'Security Verification',
          body,
        }),
      };
    }

    case EmailTemplateKey.ACCOUNT_EVENT: {
      const subject = String(payload.subject ?? 'Account Notification');
      const message = String(payload.message ?? 'An account update occurred.');

      const body = `
        <p style="margin:0 0 16px; font-size:16px; font-weight:500;">
          Hello,
        </p>
        <p style="margin:0 0 20px; color:#3a4e52;">
          ${message}
        </p>
        <div style="margin:24px 0; padding:18px; background-color:#f4f7f6; border-radius:10px; font-size:14px; border:1px solid #e5eceb;">
          If this activity was not initiated by you, please secure your account immediately or contact support.
        </div>
      `;

      return {
        subject,
        html: renderShell({
          title: subject,
          badge: 'Account Activity',
          body,
        }),
      };
    }

    case EmailTemplateKey.SERVICE_REQUEST: {
      const subject = String(payload.subject ?? 'Service Request Update');
      const message = String(payload.message ?? 'Your service request has an update.');

      const body = `
        <p style="margin:0 0 16px; font-size:16px; font-weight:500;">
          Dear Customer,
        </p>
        <p style="margin:0 0 20px; color:#3a4e52;">
          ${message}
        </p>
        <div style="margin:28px 0; text-align:center;">
          <a href="${getAppBaseUrl()}/service" style="display:inline-block; padding:14px 28px; background-color:#1c4f50; color:#ffffff; text-decoration:none; font-weight:600; font-size:14px; border-radius:8px; box-shadow:0 2px 8px rgba(28, 79, 80, 0.25);">
            View Service Status
          </a>
        </div>
      `;

      return {
        subject,
        html: renderShell({
          title: subject,
          badge: 'Service Operations',
          body,
        }),
      };
    }

    case EmailTemplateKey.ORDER_EVENT: {
      const subject = String(payload.subject ?? 'Order Update');
      const message = String(payload.message ?? 'Your order status has changed.');

      const body = `
        <p style="margin:0 0 16px; font-size:16px; font-weight:500;">
          Dear Customer,
        </p>
        <p style="margin:0 0 20px; color:#3a4e52;">
          ${message}
        </p>
        <div style="margin:28px 0; text-align:center;">
          <a href="${getAppBaseUrl()}/store" style="display:inline-block; padding:14px 28px; background-color:#1c4f50; color:#ffffff; text-decoration:none; font-weight:600; font-size:14px; border-radius:8px; box-shadow:0 2px 8px rgba(28, 79, 80, 0.25);">
            Track Your Order
          </a>
        </div>
      `;

      return {
        subject,
        html: renderShell({
          title: subject,
          badge: 'Store & Orders',
          body,
        }),
      };
    }

    case EmailTemplateKey.PAYMENT_EVENT: {
      const subject = String(payload.subject ?? 'Payment Receipt');
      const message = String(payload.message ?? 'Your payment has been recorded.');

      const body = `
        <p style="margin:0 0 16px; font-size:16px; font-weight:500;">
          Dear Customer,
        </p>
        <p style="margin:0 0 20px; color:#3a4e52;">
          ${message}
        </p>
        <div style="margin:28px 0; text-align:center;">
          <a href="${getAppBaseUrl()}/account/invoices" style="display:inline-block; padding:14px 28px; background-color:#1c4f50; color:#ffffff; text-decoration:none; font-weight:600; font-size:14px; border-radius:8px; box-shadow:0 2px 8px rgba(28, 79, 80, 0.25);">
            View Formal Invoice
          </a>
        </div>
      `;

      return {
        subject,
        html: renderShell({
          title: subject,
          badge: 'Billing & Payments',
          body,
        }),
      };
    }

    case EmailTemplateKey.QUOTATION_EVENT: {
      const subject = String(payload.subject ?? 'Quotation Available');
      const message = String(payload.message ?? 'A new quotation has been prepared for your central vacuum service.');

      const body = `
        <p style="margin:0 0 16px; font-size:16px; font-weight:500;">
          Dear Customer,
        </p>
        <p style="margin:0 0 20px; color:#3a4e52;">
          ${message}
        </p>
        <div style="margin:28px 0; text-align:center;">
          <a href="${getAppBaseUrl()}/quotations" style="display:inline-block; padding:14px 28px; background-color:#1c4f50; color:#ffffff; text-decoration:none; font-weight:600; font-size:14px; border-radius:8px; box-shadow:0 2px 8px rgba(28, 79, 80, 0.25);">
            Review & Accept Quotation
          </a>
        </div>
      `;

      return {
        subject,
        html: renderShell({
          title: subject,
          badge: 'Service Quotation',
          body,
        }),
      };
    }

    case EmailTemplateKey.SCHEDULE_EVENT: {
      const subject = String(payload.subject ?? 'Appointment Scheduled');
      const message = String(payload.message ?? 'Your technician dispatch appointment has been scheduled.');

      const body = `
        <p style="margin:0 0 16px; font-size:16px; font-weight:500;">
          Dear Customer,
        </p>
        <p style="margin:0 0 20px; color:#3a4e52;">
          ${message}
        </p>
        <div style="margin:28px 0; text-align:center;">
          <a href="${getAppBaseUrl()}/schedule" style="display:inline-block; padding:14px 28px; background-color:#1c4f50; color:#ffffff; text-decoration:none; font-weight:600; font-size:14px; border-radius:8px; box-shadow:0 2px 8px rgba(28, 79, 80, 0.25);">
            View Dispatch Appointment
          </a>
        </div>
      `;

      return {
        subject,
        html: renderShell({
          title: subject,
          badge: 'Technician Dispatch',
          body,
        }),
      };
    }

    default: {
      return {
        subject: 'Elite Central Vacuum Notification',
        html: renderShell({
          title: 'Notification',
          badge: 'System Notice',
          body: `<p style="margin:0 0 16px;">${String(payload.message ?? 'You have a new update.')}</p>`,
        }),
      };
    }
  }
}
