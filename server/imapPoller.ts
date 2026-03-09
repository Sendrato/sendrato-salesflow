/**
 * IMAP Email Poller
 *
 * Polls an IMAP mailbox on a configurable interval, fetches messages,
 * matches sender (or forwarded sender) against leads/persons, and creates
 * contact moments for matches.
 *
 * Uses messageId-based dedup (via emailIngestLog) instead of relying on
 * the IMAP \Seen flag, so messages already in Maildir cur/ are still processed.
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
 * Process messages in a single IMAP folder.
 * Fetches ALL messages (not just unseen) and uses messageId dedup.
 */
async function processFolder(
  client: ImapFlow,
  folder: string,
  crmAddress: string
): Promise<number> {
  let processed = 0;
  let skipped = 0;
  let total = 0;

  console.log(`[IMAP] Opening folder: ${folder}`);
  const lock = await client.getMailboxLock(folder);

  try {
    // Check how many messages are in the folder
    const status = client.mailbox as any;
    const msgCount = status?.exists ?? 0;
    const unseenCount = status?.unseen ?? "?";
    console.log(`[IMAP] Folder ${folder}: ${msgCount} messages total, ${unseenCount} unseen`);

    if (!msgCount) {
      console.log(`[IMAP] Folder ${folder} is empty, skipping`);
      return 0;
    }

    // Fetch ALL messages (not just unseen) — we dedup via messageId in our DB
    // Use sequence range "1:*" to get everything
    const messages = client.fetch("1:*", {
      envelope: true,
      source: true,
      uid: true,
    });

    for await (const msg of messages) {
      total++;
      try {
        const messageId = msg.envelope?.messageId;
        if (!messageId) {
          console.log(`[IMAP] Skipping message uid=${msg.uid} — no messageId`);
          continue;
        }

        // Dedup: skip if already processed
        if (await isMessageProcessed(messageId)) {
          skipped++;
          continue;
        }

        const from = msg.envelope?.from?.[0]
          ? `${msg.envelope.from[0].name ?? ""} <${msg.envelope.from[0].address ?? ""}>`
          : "";
        const to = msg.envelope?.to?.map((a) => a.address).join(", ") ?? "";
        const cc = msg.envelope?.cc?.map((a: any) => a.address).join(", ") ?? "";
        const subject = msg.envelope?.subject ?? "";

        console.log(`[IMAP] Processing: "${subject}" from ${from} (uid=${msg.uid}, id=${messageId.slice(0, 40)})`);

        // Parse the full message
        let parsed: ParsedMail | undefined;
        if (msg.source) {
          parsed = await simpleParser(msg.source);
        }

        const textBody = parsed?.text ?? "";
        const htmlBody = parsed?.html || "";

        // Extract all email addresses (handles forwarded, CC, and BCC scenarios)
        const emailAddresses = extractEmailAddresses(
          from,
          textBody || htmlBody,
          crmAddress,
          subject,
          to,
          cc
        );

        console.log(`[IMAP]   Extracted emails: [${emailAddresses.join(", ")}]`);

        // Try to match
        const match = await matchEmailAddresses(emailAddresses);

        if (match.lead) {
          console.log(`[IMAP]   -> Matched LEAD: ${match.lead.companyName} (id=${match.lead.id}) via ${match.matchedEmail}`);
          const emailDate = msg.envelope?.date ?? new Date();
          const followUpDate = new Date(emailDate);
          followUpDate.setDate(followUpDate.getDate() + 1);
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
            occurredAt: emailDate,
            followUpAt: followUpDate,
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
          const { person, linkedLeads } = match.person;
          console.log(`[IMAP]   -> Matched PERSON: ${person.name} (id=${person.id}) via ${match.matchedEmail}, ${linkedLeads?.length ?? 0} linked leads`);

          if (linkedLeads && linkedLeads.length > 0) {
            const pEmailDate = msg.envelope?.date ?? new Date();
            const pFollowUpDate = new Date(pEmailDate);
            pFollowUpDate.setDate(pFollowUpDate.getDate() + 1);
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
                occurredAt: pEmailDate,
                followUpAt: pFollowUpDate,
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
          console.log(`[IMAP]   -> No match found for emails: [${emailAddresses.join(", ")}]`);
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

        processed++;
      } catch (msgErr) {
        console.error(`[IMAP] Error processing message uid=${msg.uid}:`, msgErr);
      }
    }
  } finally {
    lock.release();
  }

  console.log(`[IMAP] Folder ${folder} done: ${total} total, ${processed} new, ${skipped} already processed`);
  return processed;
}

/**
 * Run a single poll cycle: connect, fetch from all configured folders, disconnect.
 * Returns the number of messages processed.
 */
export async function pollOnce(): Promise<number> {
  const settings = await getAllImapSettings();

  if (!settings.host || !settings.user || !settings.password) {
    console.log("[IMAP] Poll skipped — missing host, user, or password");
    return 0;
  }

  console.log(`[IMAP] Connecting to ${settings.host}:${settings.port} (secure=${settings.secure}) as ${settings.user}`);

  const client = new ImapFlow({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: { user: settings.user, pass: settings.password },
    logger: false,
    tls: {
      rejectUnauthorized: false,
      servername: settings.host,
      minVersion: "TLSv1" as const,
      ciphers: "DEFAULT:@SECLEVEL=0",
    },
  });

  // Parse folder setting: comma-separated list, e.g. "INBOX, Sent, Archive"
  const folders = settings.folder
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
  if (folders.length === 0) folders.push("INBOX");

  console.log(`[IMAP] Will check folders: [${folders.join(", ")}]`);

  let totalProcessed = 0;

  try {
    await client.connect();
    console.log("[IMAP] Connected successfully");

    // List available folders for debugging
    try {
      const mailboxes = await client.list();
      console.log(`[IMAP] Available folders: [${mailboxes.map((m) => m.path).join(", ")}]`);
    } catch {
      // non-critical
    }

    for (const folder of folders) {
      try {
        const count = await processFolder(client, folder, settings.user);
        totalProcessed += count;
      } catch (folderErr) {
        console.error(`[IMAP] Error processing folder ${folder}:`, folderErr);
      }
    }

    await client.logout();
    console.log(`[IMAP] Poll complete: ${totalProcessed} new messages processed`);
  } catch (err) {
    console.error("[IMAP] Poll error:", err);
    try { await client.logout(); } catch { /* ignore */ }
  }

  return totalProcessed;
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
