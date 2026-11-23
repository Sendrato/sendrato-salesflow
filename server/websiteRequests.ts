/**
 * Website request endpoint
 *
 * POST /api/website-request — called by sendrato.com when a visitor submits a
 * contact/demo form. Authenticated with a static bearer token.
 *
 * Each accepted submission:
 *   1. is stored verbatim in website_requests (audit trail + idempotency),
 *   2. creates or updates a Person in the CRM's People section,
 *   3. logs an inbound contact moment on that person (with a follow-up),
 *   4. is emailed to the notification address (info@sendrato.com by default).
 *
 * Submissions with a filled honeypot field are recorded as spam and otherwise
 * ignored — the website still gets a 200 so bots learn nothing.
 */

import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { createContactMoment } from "./db";
import { sendMail } from "./mailer";
import { createPerson, updatePerson } from "./personsDb";
import {
  DEFAULT_WEBSITE_NOTIFY_EMAIL,
  getWebsiteApiSettings,
} from "./settingsDb";
import {
  findPersonByEmailInsensitive,
  findWebsiteRequestByExternalId,
  insertWebsiteRequest,
  updateWebsiteRequest,
} from "./websiteRequestsDb";
import type { Person } from "../drizzle/schema";

const MAX_BATCH_SIZE = 50;
const MAX_RAW_PAYLOAD = 20000;
const FOLLOW_UP_DAYS = 1;

// ─── Payload parsing ─────────────────────────────────────────────────────────

/**
 * The website posts snake_case columns (event_type, request_type, created_at).
 * Accept camelCase too so either shape works.
 */
function camelize(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function normalizePayloadKeys(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as object)) {
    out[camelize(key)] = value;
  }
  return out;
}

/** Coerce anything scalar the form may send into a trimmed string. */
const scalarToString = (max: number) =>
  z
    .union([z.string(), z.number(), z.boolean(), z.null()])
    .optional()
    .transform(v => {
      if (v === null || v === undefined) return undefined;
      const s = String(v).trim();
      return s.length > 0 ? s.slice(0, max) : undefined;
    });

export const websiteRequestSchema = z.object({
  id: scalarToString(128),
  name: scalarToString(255),
  email: scalarToString(320),
  company: scalarToString(255),
  eventType: scalarToString(128),
  requestType: scalarToString(128),
  message: scalarToString(20000),
  honeypot: scalarToString(1024),
  createdAt: scalarToString(64),
});

export type WebsiteRequestPayload = z.infer<typeof websiteRequestSchema>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

/** Parse the website's created_at; falls back to now when absent/unparseable. */
export function parseSubmittedAt(value: string | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  // "2026-11-14 09:21:54.049883+00" style with an unusual separator
  const normalized = new Date(
    value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")
  );
  return Number.isNaN(normalized.getTime()) ? new Date() : normalized;
}

/** Fallback display name derived from the email local part. */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local
    .split(/[._+-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join(" ") || email;
}

const CONTACT_MOMENT_TYPES = [
  "email",
  "phone",
  "meeting",
  "linkedin",
  "slack",
  "demo",
  "proposal",
  "other",
] as const;

type ContactMomentType = (typeof CONTACT_MOMENT_TYPES)[number];

/** Map the form's request_type onto a contact moment type. */
export function contactMomentTypeFor(
  requestType: string | undefined
): ContactMomentType {
  const normalized = (requestType ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  return (CONTACT_MOMENT_TYPES as readonly string[]).includes(normalized)
    ? (normalized as ContactMomentType)
    : "other";
}

// ─── Bearer token auth ───────────────────────────────────────────────────────

/** Constant-time comparison of the presented bearer token. */
export function bearerTokenMatches(
  authorizationHeader: string | undefined,
  expectedToken: string
): boolean {
  if (!expectedToken) return false;
  const match = /^Bearer\s+(.+)$/i.exec((authorizationHeader ?? "").trim());
  if (!match) return false;
  const presented = Buffer.from(match[1].trim(), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  // Hash both sides so lengths always match and no length is leaked.
  return crypto.timingSafeEqual(
    crypto.createHash("sha256").update(presented).digest(),
    crypto.createHash("sha256").update(expected).digest()
  );
}

// ─── Rate limiting ───────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

/** Fixed-window per-IP limiter — mainly to blunt bearer-token guessing. */
export function rateLimitExceeded(key: string, now = Date.now()): boolean {
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    // Opportunistic cleanup so the map cannot grow without bound.
    if (rateBuckets.size > 1000) {
      rateBuckets.forEach((v, k) => {
        if (v.resetAt <= now) rateBuckets.delete(k);
      });
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

// ─── Notification email ──────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildNotificationEmail(opts: {
  payload: WebsiteRequestPayload;
  submittedAt: Date;
  personId: number | null;
  personCreated: boolean;
  appUrl?: string;
}): { subject: string; text: string; html: string } {
  const { payload, submittedAt, personId, personCreated, appUrl } = opts;
  const who = payload.name || payload.email || "Unknown";
  const kind = payload.requestType || "contact";
  const subject = `Website ${kind} request — ${who}${
    payload.company ? ` (${payload.company})` : ""
  }`;

  const fields: [string, string][] = [
    ["Name", payload.name ?? "—"],
    ["Email", payload.email ?? "—"],
    ["Company", payload.company ?? "—"],
    ["Request type", payload.requestType ?? "—"],
    ["Event type", payload.eventType ?? "—"],
    ["Submitted", submittedAt.toISOString()],
  ];
  const personLink =
    personId && appUrl
      ? `${appUrl.replace(/\/$/, "")}/persons/${personId}`
      : null;
  if (personId) {
    fields.push([
      "CRM person",
      `${personCreated ? "created" : "updated"} #${personId}${
        personLink ? ` — ${personLink}` : ""
      }`,
    ]);
  }

  const text = [
    ...fields.map(([label, value]) => `${label}: ${value}`),
    "",
    "Message:",
    payload.message || "(no message)",
  ].join("\n");

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#111;">
  <h2 style="margin:0 0 12px;font-size:18px;">New website ${escapeHtml(kind)} request</h2>
  <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
    ${fields
      .map(
        ([label, value]) =>
          `<tr><td style="color:#666;">${escapeHtml(label)}</td><td><strong>${escapeHtml(
            value
          )}</strong></td></tr>`
      )
      .join("\n    ")}
  </table>
  <h3 style="margin:20px 0 6px;font-size:15px;">Message</h3>
  <div style="white-space:pre-wrap;font-size:14px;border-left:3px solid #ddd;padding-left:12px;">${escapeHtml(
    payload.message || "(no message)"
  )}</div>
</body></html>`;

  return { subject, text, html };
}

// ─── Processing ──────────────────────────────────────────────────────────────

export type ProcessResult = {
  status: "created" | "duplicate" | "spam";
  requestId: number;
  personId: number | null;
  personCreated: boolean;
  notified: boolean;
};

function mergeTags(existing: unknown, additions: string[]): string[] {
  const tags = new Set<string>(
    Array.isArray(existing) ? existing.filter(t => typeof t === "string") : []
  );
  for (const tag of additions) if (tag) tags.add(tag);
  return Array.from(tags);
}

function noteBlock(payload: WebsiteRequestPayload, submittedAt: Date): string {
  const header = `Website ${payload.requestType || "contact"} request — ${submittedAt
    .toISOString()
    .slice(0, 10)}`;
  const details = [
    payload.eventType ? `Event type: ${payload.eventType}` : null,
    payload.company ? `Company: ${payload.company}` : null,
  ].filter(Boolean);
  return [header, ...details, "", payload.message || "(no message)"].join("\n");
}

/** Create or update the CRM person behind a submission. */
async function upsertPersonFromRequest(
  payload: WebsiteRequestPayload,
  submittedAt: Date
): Promise<{ personId: number; created: boolean }> {
  const email = (payload.email ?? "").trim();
  const name = payload.name || nameFromEmail(email);
  const tagAdditions = [
    "website",
    payload.requestType ? `request:${payload.requestType}` : "",
    payload.eventType ? `event:${payload.eventType}` : "",
  ].filter(Boolean);

  const existing: Person | null = email
    ? await findPersonByEmailInsensitive(email)
    : null;

  if (existing) {
    const appended = [existing.notes?.trim(), noteBlock(payload, submittedAt)]
      .filter(Boolean)
      .join("\n\n");
    await updatePerson(existing.id, {
      // Never overwrite data a salesperson curated — only fill the blanks.
      name: existing.name || name,
      company: existing.company || payload.company || null,
      notes: appended,
      tags: mergeTags(existing.tags, tagAdditions),
      source: existing.source || "website",
    });
    return { personId: existing.id, created: false };
  }

  const personId = await createPerson({
    name,
    email: email || null,
    company: payload.company ?? null,
    personType: "prospect",
    source: "website",
    notes: noteBlock(payload, submittedAt),
    tags: mergeTags(null, tagAdditions),
  });
  return { personId, created: true };
}

/**
 * Store one submission and fan it out to the CRM + notification email.
 * Never throws for mail problems — those are recorded on the request row.
 */
export async function processWebsiteRequest(
  payload: WebsiteRequestPayload,
  opts: { rawPayload: string; appUrl?: string }
): Promise<ProcessResult> {
  const submittedAt = parseSubmittedAt(payload.createdAt);

  // Idempotent re-delivery: the website's own id wins.
  if (payload.id) {
    const seen = await findWebsiteRequestByExternalId(payload.id);
    if (seen) {
      return {
        status: "duplicate",
        requestId: seen.id,
        personId: seen.personId ?? null,
        personCreated: false,
        notified: seen.notifiedAt != null,
      };
    }
  }

  const isSpam = (payload.honeypot ?? "").length > 0;

  let requestId: number;
  try {
    requestId = await insertWebsiteRequest({
      externalId: payload.id ?? null,
      name: payload.name ?? null,
      email: payload.email ?? null,
      company: payload.company ?? null,
      eventType: payload.eventType ?? null,
      requestType: payload.requestType ?? null,
      message: payload.message ?? null,
      status: isSpam ? "spam" : "new",
      rawPayload: opts.rawPayload.slice(0, MAX_RAW_PAYLOAD),
      submittedAt,
    });
  } catch (err) {
    // A concurrent redelivery of the same submission won the unique index.
    const existing = payload.id
      ? await findWebsiteRequestByExternalId(payload.id)
      : null;
    if (!existing) throw err;
    return {
      status: "duplicate",
      requestId: existing.id,
      personId: existing.personId ?? null,
      personCreated: false,
      notified: existing.notifiedAt != null,
    };
  }

  if (isSpam) {
    console.log(
      `[website-request] #${requestId} rejected by honeypot (${payload.email ?? "no email"})`
    );
    return {
      status: "spam",
      requestId,
      personId: null,
      personCreated: false,
      notified: false,
    };
  }

  let personId: number | null = null;
  let personCreated = false;
  try {
    const person = await upsertPersonFromRequest(payload, submittedAt);
    personId = person.personId;
    personCreated = person.created;

    const followUpAt = new Date(submittedAt);
    followUpAt.setDate(followUpAt.getDate() + FOLLOW_UP_DAYS);
    const moment = await createContactMoment({
      // leadId 0 marks a person-only moment (no company linked yet)
      leadId: 0,
      personId,
      type: contactMomentTypeFor(payload.requestType),
      direction: "inbound",
      subject: `Website ${payload.requestType || "contact"} request`.slice(
        0,
        512
      ),
      notes: payload.message ?? null,
      emailFrom: payload.email ?? null,
      source: "website",
      occurredAt: submittedAt,
      followUpAt,
    });
    await updateWebsiteRequest(requestId, {
      personId,
      contactMomentId: moment?.id ?? null,
    });
  } catch (err) {
    console.error(`[website-request] #${requestId} CRM write failed:`, err);
    await updateWebsiteRequest(requestId, {
      status: "error",
      processError: err instanceof Error ? err.message : String(err),
    }).catch(() => {});
  }

  const notified = await notifyWebsiteRequest(requestId, {
    payload,
    submittedAt,
    personId,
    personCreated,
    appUrl: opts.appUrl,
  });

  return { status: "created", requestId, personId, personCreated, notified };
}

/** Email the submission to the notification address; records the outcome. */
export async function notifyWebsiteRequest(
  requestId: number,
  opts: {
    payload: WebsiteRequestPayload;
    submittedAt: Date;
    personId: number | null;
    personCreated: boolean;
    appUrl?: string;
  }
): Promise<boolean> {
  try {
    const { notifyEmail } = await getWebsiteApiSettings();
    const mail = buildNotificationEmail(opts);
    await sendMail({
      to: notifyEmail || DEFAULT_WEBSITE_NOTIFY_EMAIL,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      ...(opts.payload.email ? { replyTo: opts.payload.email } : {}),
    });
    await updateWebsiteRequest(requestId, {
      notifiedAt: new Date(),
      notifyError: null,
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[website-request] #${requestId} notification failed: ${message}`
    );
    // The request itself is safe in the CRM — surface the mail failure only.
    await updateWebsiteRequest(requestId, { notifyError: message }).catch(
      () => {}
    );
    return false;
  }
}

// ─── Route ───────────────────────────────────────────────────────────────────

/**
 * Rate-limit key. Prefers the values nginx sets itself: X-Real-IP, else the
 * LAST X-Forwarded-For entry (`$proxy_add_x_forwarded_for` appends the real
 * peer, so earlier entries are client-supplied and spoofable).
 */
function clientIp(req: Request): string {
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();
  const forwarded = req.headers["x-forwarded-for"];
  const chain = Array.isArray(forwarded) ? forwarded.join(",") : forwarded;
  const hops = (chain ?? "").split(",").filter(h => h.trim());
  if (hops.length > 0) return hops[hops.length - 1].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

function appUrlFrom(req: Request): string | undefined {
  if (process.env.APP_URL) return process.env.APP_URL;
  const host = req.headers.host;
  return host ? `${req.protocol}://${host}` : undefined;
}

export function registerWebsiteRequestRoutes(app: Express) {
  app.post("/api/website-request", async (req: Request, res: Response) => {
    if (rateLimitExceeded(clientIp(req))) {
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    const { apiToken } = await getWebsiteApiSettings();
    if (!apiToken) {
      console.warn(
        "[website-request] Rejected: no API token configured (Settings → Website Request API)"
      );
      res.status(503).json({ error: "Endpoint not configured" });
      return;
    }
    if (!bearerTokenMatches(req.headers.authorization, apiToken)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Accept a single submission, {requests:[...]} or a bare array.
    const body = req.body as unknown;
    const rawItems = Array.isArray(body)
      ? body
      : Array.isArray((body as { requests?: unknown[] })?.requests)
        ? (body as { requests: unknown[] }).requests
        : [body];

    if (rawItems.length === 0) {
      res.status(400).json({ error: "No submissions in request body" });
      return;
    }
    if (rawItems.length > MAX_BATCH_SIZE) {
      res
        .status(400)
        .json({ error: `At most ${MAX_BATCH_SIZE} submissions per request` });
      return;
    }

    const results: unknown[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let index = 0; index < rawItems.length; index++) {
      const item = rawItems[index];
      const parsed = websiteRequestSchema.safeParse(normalizePayloadKeys(item));
      if (!parsed.success) {
        errors.push({
          index,
          error: parsed.error.issues[0]?.message ?? "Invalid payload",
        });
        continue;
      }
      const payload = parsed.data;
      if (!payload.email || !EMAIL_RE.test(payload.email)) {
        errors.push({ index, error: "A valid email address is required" });
        continue;
      }
      if (!payload.name && !payload.message) {
        errors.push({ index, error: "Either name or message is required" });
        continue;
      }

      try {
        const result = await processWebsiteRequest(payload, {
          rawPayload: JSON.stringify(item),
          appUrl: appUrlFrom(req),
        });
        results.push({
          id: payload.id ?? null,
          status: result.status,
          requestId: result.requestId,
          personId: result.personId,
          personCreated: result.personCreated,
          notified: result.notified,
        });
      } catch (err) {
        console.error("[/api/website-request] Error:", err);
        errors.push({
          index,
          error: err instanceof Error ? err.message : "Processing failed",
        });
      }
    }

    // Any success → 200 (so the website can stop retrying the good ones).
    const anyAccepted = results.length > 0;
    res.status(anyAccepted ? 200 : 400).json({
      success: anyAccepted,
      accepted: results.length,
      rejected: errors.length,
      results,
      ...(errors.length > 0 ? { errors } : {}),
    });
  });
}
