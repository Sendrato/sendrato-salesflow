/**
 * IMAP Email Poller
 *
 * Polls an IMAP mailbox on a configurable interval, fetches unseen messages,
 * matches sender (or forwarded sender) against leads/persons, and creates
 * contact moments for matches.
 */

import { ImapFlow } from "imapflow";
import { getAllImapSettings } from "./settingsDb";
import {
  createContactMoment,
  logEmailIngest,
  isMessageProcessed,
} from "./db";
import { extractEmailAddresses, matchEmailAddresses } from "./emailMatcher";
import { simpleParser, type ParsedMail } from "mailparser";

let pollingTimer: ReturnType<typeof setTimeout> | null = null;
let isPolling = false;

/**
 * Run a single poll cycle: connect, fetch unseen, process, disconnect.
 */
async function pollOnce(): Promise<void> {
  const settings = await getAllImapSettings();

  if (!settings.enabled || !settings.host || !settings.user || !settings.password) {
    return;
  }

  const client = new ImapFlow({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: { user: settings.user, pass: settings.password },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(settings.folder);

    try {
      // Fetch all unseen messages
      const messages = client.fetch({ seen: false }, {
        envelope: true,
        source: true,
        uid: true,
      });

      for await (const msg of messages) {
        try {
          const messageId = msg.envelope?.messageId;
          if (!messageId) continue;

          // Dedup: skip if already processed
          if (await isMessageProcessed(messageId)) {
            continue;
          }

          // Parse the full message
          let parsed: ParsedMail | undefined;
          if (msg.source) {
            parsed = await simpleParser(msg.source);
          }

          const from = msg.envelope?.from?.[0]
            ? `${msg.envelope.from[0].name ?? ""} <${msg.envelope.from[0].address ?? ""}>`
            : "";
          const to = msg.envelope?.to?.map((a) => a.address).join(", ") ?? "";
          const subject = msg.envelope?.subject ?? "";
          const textBody = parsed?.text ?? "";
          const htmlBody = parsed?.html || "";

          // Extract all email addresses (handles forwarded emails)
          const emailAddresses = extractEmailAddresses(
            from,
            textBody || htmlBody,
            settings.user // exclude the CRM mailbox address
          );

          // Try to match
          const match = await matchEmailAddresses(emailAddresses);

          if (match.lead) {
            // Matched a lead directly
            await createContactMoment({
              leadId: match.lead.id,
              type: "email",
              direction: "inbound",
              subject: subject.slice(0, 512),
              notes: textBody.slice(0, 5000),
              emailFrom: match.matchedEmail ?? from,
              emailTo: to,
              emailRaw: (htmlBody || textBody).slice(0, 10000),
              source: "imap",
              occurredAt: msg.envelope?.date ?? new Date(),
            });

            await logEmailIngest({
              rawPayload: `[IMAP] ${subject}`.slice(0, 10000),
              parsedFrom: match.matchedEmail ?? from,
              parsedTo: to,
              parsedSubject: subject,
              matchedLeadId: match.lead.id,
              messageId,
              source: "imap",
              status: "matched",
            });
          } else if (match.person) {
            // Matched a person — create contact moments on all linked leads
            const { person, linkedLeads } = match.person;

            if (linkedLeads && linkedLeads.length > 0) {
              for (const link of linkedLeads) {
                await createContactMoment({
                  leadId: link.leadId,
                  personId: person.id,
                  type: "email",
                  direction: "inbound",
                  subject: subject.slice(0, 512),
                  notes: textBody.slice(0, 5000),
                  emailFrom: match.matchedEmail ?? from,
                  emailTo: to,
                  emailRaw: (htmlBody || textBody).slice(0, 10000),
                  source: "imap",
                  occurredAt: msg.envelope?.date ?? new Date(),
                });
              }
            }

            await logEmailIngest({
              rawPayload: `[IMAP] ${subject}`.slice(0, 10000),
              parsedFrom: match.matchedEmail ?? from,
              parsedTo: to,
              parsedSubject: subject,
              matchedPersonId: person.id,
              matchedLeadId: linkedLeads?.[0]?.leadId,
              messageId,
              source: "imap",
              status: "matched",
            });
          } else {
            // No match found
            await logEmailIngest({
              rawPayload: `[IMAP] ${subject}`.slice(0, 10000),
              parsedFrom: emailAddresses[0] ?? from,
              parsedTo: to,
              parsedSubject: subject,
              messageId,
              source: "imap",
              status: "unmatched",
            });
          }

          // Mark as seen on the IMAP server
          await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
        } catch (msgErr) {
          console.error("[IMAP] Error processing message:", msgErr);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.error("[IMAP] Poll error:", err);
    try { await client.logout(); } catch { /* ignore */ }
  }
}

/**
 * Start the IMAP polling loop.
 */
export async function startImapPolling(): Promise<void> {
  if (isPolling) return;

  const settings = await getAllImapSettings();
  if (!settings.enabled || !settings.host || !settings.user || !settings.password) {
    console.log("[IMAP] Polling not configured or disabled");
    return;
  }

  isPolling = true;
  const intervalMs = Math.max(1, settings.pollInterval) * 60 * 1000;
  console.log(`[IMAP] Starting polling every ${settings.pollInterval}m for ${settings.user}`);

  // Run first poll immediately
  pollOnce().catch((err) => console.error("[IMAP] Initial poll failed:", err));

  // Schedule recurring polls
  pollingTimer = setInterval(() => {
    pollOnce().catch((err) => console.error("[IMAP] Poll failed:", err));
  }, intervalMs);
}

/**
 * Stop the IMAP polling loop.
 */
export function stopImapPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  isPolling = false;
  console.log("[IMAP] Polling stopped");
}

/**
 * Restart the IMAP polling loop (called after settings change).
 */
export async function restartImapPolling(): Promise<void> {
  stopImapPolling();
  await startImapPolling();
}
