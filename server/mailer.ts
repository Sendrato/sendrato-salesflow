/**
 * Outgoing mail
 *
 * Thin wrapper around nodemailer. SMTP credentials come from app_settings
 * (configurable in the UI) with SMTP_* env vars as fallback. The transport is
 * cached per configuration so settings changes take effect without a restart.
 */

import nodemailer, { type Transporter } from "nodemailer";
import { getAllSmtpSettings, type SmtpSettings } from "./settingsDb";

let cachedTransport: Transporter | null = null;
let cachedSignature = "";

function signature(cfg: SmtpSettings): string {
  return [cfg.host, cfg.port, cfg.secure, cfg.user, cfg.password].join("|");
}

/** True when enough SMTP settings are present to attempt a send. */
export function isSmtpConfigured(cfg: SmtpSettings): boolean {
  return cfg.host.length > 0 && cfg.from.length > 0;
}

export function buildTransport(cfg: SmtpSettings): Transporter {
  const sig = signature(cfg);
  if (cachedTransport && cachedSignature === sig) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    ...(cfg.user ? { auth: { user: cfg.user, pass: cfg.password } } : {}),
  });
  cachedSignature = sig;
  return cachedTransport;
}

/** Drop the cached transport — call after SMTP settings change. */
export function resetTransport(): void {
  cachedTransport = null;
  cachedSignature = "";
}

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

/**
 * Send a mail through the configured SMTP server.
 * Throws when SMTP is not configured or the send fails — callers that must not
 * fail because of mail problems should catch.
 */
export async function sendMail(
  msg: MailMessage
): Promise<{ messageId: string }> {
  const cfg = await getAllSmtpSettings();
  if (!isSmtpConfigured(cfg)) {
    throw new Error(
      "SMTP is not configured — set the mail server under Settings → Outgoing Email"
    );
  }
  const transport = buildTransport(cfg);
  const info = await transport.sendMail({
    from: cfg.from,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    ...(msg.html ? { html: msg.html } : {}),
    ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
  });
  return { messageId: String(info.messageId ?? "") };
}

/** Verify the SMTP connection/credentials without sending a message. */
export async function verifySmtp(
  override?: Partial<SmtpSettings>
): Promise<void> {
  const cfg = { ...(await getAllSmtpSettings()), ...override };
  if (!cfg.host) throw new Error("No SMTP server configured");
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    ...(cfg.user ? { auth: { user: cfg.user, pass: cfg.password } } : {}),
  });
  await transport.verify();
  transport.close();
}
