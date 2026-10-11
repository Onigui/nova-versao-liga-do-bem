/** Envio de e-mail transacional: Resend (preferência) ou SMTP. Nunca loga o conteúdo. */

export function isEmailDeliveryConfigured(): boolean {
  if (process.env.RESEND_API_KEY) return true;
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendEmail(msg: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER || '';

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: from || 'Liga do Bem <onboarding@resend.dev>',
          to: [msg.to],
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
        }),
      });
      if (!resp.ok) {
        const detail = await resp.text().catch(() => '');
        return { ok: false, error: `Resend: ${resp.status} ${detail}` };
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Falha Resend' };
    }
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return { ok: false, error: 'SMTP/Resend não configurado' };

  try {
    const nodemailer = require('nodemailer');
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transporter.sendMail({ from: from || user, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha SMTP' };
  }
}

export function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
