import { EmailTemplateKey, type EmailTemplatePayload, type EmailTemplateRenderResult } from '../types/email.types';

function renderShell(title: string, body: string) {
  const logoUrl = 'https://i.imgur.com/GjvY4Z9.png';
  return `
  <html>
    <body style="font-family: Arial, sans-serif; background:#eef3f3; margin:0; padding:24px; color:#1f2937;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;">
              <tr>
                <td style="padding:18px 24px; background:#1C4F50; color:#ffffff; font-size:18px; font-weight:700;">
                  <img src="${logoUrl}" alt="Elite Central Vacuums" style="height:42px; display:block; margin-bottom:8px;" />
                  <div>${title}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:24px; font-size:14px; line-height:1.6;">
                  ${body}
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
      return {
        subject: String(payload.subject ?? 'Your OTP Code'),
        html: renderShell(
          'Verification Code',
          `<p>Your one-time password is:</p>
           <p style="font-size:28px; font-weight:700; letter-spacing:4px; margin:12px 0;">${otp}</p>
           <p>This code expires in ${minutes} minutes.</p>`,
        ),
      };
    }

    case EmailTemplateKey.ACCOUNT_EVENT: {
      return {
        subject: String(payload.subject ?? 'Account Notification'),
        html: renderShell(
          'Account Notification',
          `<p>${String(payload.message ?? 'An account event occurred.')}</p>`,
        ),
      };
    }

    case EmailTemplateKey.SERVICE_REQUEST: {
      return {
        subject: String(payload.subject ?? 'Service Request Update'),
        html: renderShell(
          'Service Request Update',
          `<p>${String(payload.message ?? 'Your service request has an update.')}</p>`,
        ),
      };
    }

    case EmailTemplateKey.ORDER_EVENT: {
      return {
        subject: String(payload.subject ?? 'Order Update'),
        html: renderShell(
          'Order Update',
          `<p>${String(payload.message ?? 'Your order status has changed.')}</p>`,
        ),
      };
    }

    case EmailTemplateKey.PAYMENT_EVENT: {
      return {
        subject: String(payload.subject ?? 'Payment Update'),
        html: renderShell(
          'Payment Update',
          `<p>${String(payload.message ?? 'Your payment status has changed.')}</p>`,
        ),
      };
    }

    case EmailTemplateKey.QUOTATION_EVENT: {
      return {
        subject: String(payload.subject ?? 'Quotation Update'),
        html: renderShell(
          'Quotation Update',
          `<p>${String(payload.message ?? 'A quotation update is available.')}</p>`,
        ),
      };
    }

    case EmailTemplateKey.SCHEDULE_EVENT: {
      return {
        subject: String(payload.subject ?? 'Schedule Update'),
        html: renderShell(
          'Schedule Update',
          `<p>${String(payload.message ?? 'Your schedule has been updated.')}</p>`,
        ),
      };
    }

    default: {
      return {
        subject: 'Notification',
        html: renderShell('Notification', '<p>You have a new notification.</p>'),
      };
    }
  }
}
