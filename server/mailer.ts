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
  return [
    cfg.host,
    cfg.port,
    cfg.secure,
    cfg.user,
    cfg.password,
    cfg.allowInvalidCert,
  ].join("|");
}

/**
 * Transport options for one SMTP config.
 *
 * `allowInvalidCert` exists because some mail hosts (e.g. mail.dexels.com)
 * serve a self-signed certificate with CN=localhost, which can never validate.
 * Turning it on keeps the connection encrypted but stops authenticating the
 * server, so it must stay opt-in — the same concession imapPoller makes.
 */
export function transportOptions(cfg: SmtpSettings) {
  return {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    ...(cfg.user ? { auth: { user: cfg.user, pass: cfg.password } } : {}),
    tls: {
      servername: cfg.host,
      rejectUnauthorized: !cfg.allowInvalidCert,
      ...(cfg.allowInvalidCert
        ? { minVersion: "TLSv1" as const, ciphers: "DEFAULT:@SECLEVEL=0" }
        : {}),
    },
  };
}

const CERT_ERROR_CODES = [
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
];

/** True when a send/verify failed because the server certificate is untrusted. */
export function isCertificateError(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? "";
  if (CERT_ERROR_CODES.includes(code)) return true;
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    message.includes("self-signed certificate") ||
    message.includes("self signed certificate") ||
    message.includes("unable to verify the first certificate") ||
    message.includes("certificate altname")
  );
}

/** Error text that tells the operator what to do about an untrusted cert. */
export function describeMailError(err: unknown, cfg: SmtpSettings): string {
  const message = err instanceof Error ? err.message : String(err);
  if (isCertificateError(err) && !cfg.allowInvalidCert) {
    return `${message} — ${cfg.host} does not present a certificate this server can verify. Enable "Allow self-signed certificate" to accept it anyway (the connection stays encrypted but the server is no longer authenticated).`;
  }
  return message;
}

/** True when enough SMTP settings are present to attempt a send. */
export function isSmtpConfigured(cfg: SmtpSettings): boolean {
  return cfg.host.length > 0 && cfg.from.length > 0;
}

export function buildTransport(cfg: SmtpSettings): Transporter {
  const sig = signature(cfg);
  if (cachedTransport && cachedSignature === sig) return cachedTransport;
  cachedTransport = nodemailer.createTransport(transportOptions(cfg));
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
  try {
    const info = await transport.sendMail({
      from: cfg.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      ...(msg.html ? { html: msg.html } : {}),
      ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
    });
    return { messageId: String(info.messageId ?? "") };
  } catch (err) {
    throw new Error(describeMailError(err, cfg));
  }
}

/** Verify the SMTP connection/credentials without sending a message. */
export async function verifySmtp(
  override?: Partial<SmtpSettings>
): Promise<void> {
  const cfg = { ...(await getAllSmtpSettings()), ...override };
  if (!cfg.host) throw new Error("No SMTP server configured");
  const transport = nodemailer.createTransport(transportOptions(cfg));
  try {
    await transport.verify();
  } catch (err) {
    throw new Error(describeMailError(err, cfg));
  } finally {
    transport.close();
  }
}
