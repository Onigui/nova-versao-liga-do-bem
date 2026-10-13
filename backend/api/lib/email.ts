/** Envio de e-mail transacional: SMTP (preferência, se configurado) e/ou Resend. Nunca loga o conteúdo. */

export function isEmailDeliveryConfigured(): boolean {
  if (process.env.RESEND_API_KEY) return true;
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

type Mail = { to: string; subject: string; text: string; html: string };

async function sendViaResend(msg: Mail): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Sem domínio próprio verificado, o Resend só entrega para o e-mail dono da conta
        from: process.env.RESEND_FROM || process.env.EMAIL_FROM || 'Liga do Bem <onboarding@resend.dev>',
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

async function sendViaSmtp(msg: Mail, from: string): Promise<{ ok: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  try {
    const nodemailer = require('nodemailer');
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transporter.sendMail({ from: from || `Liga do Bem <${user}>`, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: `SMTP: ${e?.message || 'falha'}` };
  }
}

/**
 * SMTP (ex.: Gmail com senha de app) tem preferência quando configurado, porque entrega para
 * qualquer destinatário sem domínio próprio. Resend fica como reserva (ou principal, se for o único).
 */
export async function sendEmail(msg: Mail): Promise<{ ok: boolean; error?: string }> {
  const from = process.env.SMTP_FROM || '';
  const smtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const resend = !!process.env.RESEND_API_KEY;
  const errors: string[] = [];
  if (smtp) {
    const r = await sendViaSmtp(msg, from);
    if (r.ok) return r;
    errors.push(r.error || 'SMTP');
  }
  if (resend) {
    const r = await sendViaResend(msg);
    if (r.ok) return r;
    errors.push(r.error || 'Resend');
  }
  if (!smtp && !resend) return { ok: false, error: 'SMTP/Resend não configurado' };
  return { ok: false, error: errors.join(' | ') };
}

export function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
