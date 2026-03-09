/**
 * Email Matcher
 *
 * Extracts email addresses from messages (including forwarded emails)
 * and matches them against leads and persons in the CRM.
 */

import { findLeadByEmail, findPersonByEmail } from "./db";

const EMAIL_REGEX = /[\w.+-]+@[\w.-]+\.\w{2,}/g;

/**
 * Detect if a message is forwarded and extract the original sender.
 * Looks for common forwarding patterns in subject and body.
 */
const FORWARD_PATTERNS = [
  // "From:" line in forwarded content
  /(?:^|\n)\s*(?:From|Van|De|Von|Da):\s*.*?([^\s<]+@[^\s>,]+)/im,
  // "---------- Forwarded message ----------"
  /forwarded message/i,
  // "Begin forwarded message:"
  /begin forwarded message/i,
  // Subject starts with Fwd: or Fw:
  /^(?:Fwd?|Fw):/i,
];

function isForwardedMessage(subject: string, body: string): boolean {
  if (/^(?:Fwd?|Fw):\s*/i.test(subject)) return true;
  if (/forwarded message/i.test(body)) return true;
  if (/begin forwarded message/i.test(body)) return true;
  return false;
}

/**
 * Extract the original sender from a forwarded email body.
 * Looks for "From: Name <email>" patterns that typically appear
 * in forwarded message headers.
 */
function extractForwardedSender(body: string): string | null {
  // Look for "From:" lines that appear after forwarding markers
  const forwardSection = body.match(
    /(?:(?:[-]+\s*Forwarded message\s*[-]+)|(?:Begin forwarded message:?))[^]*?(?:From|Van|De|Von|Da)\s*:\s*[^<]*?<?\s*([^\s<>,"]+@[^\s<>,"]+)/i
  );
  if (forwardSection?.[1]) return forwardSection[1].toLowerCase();

  // Generic "From:" line in the body (not the first line)
  const fromLineRegex =
    /(?:^|\n)\s*(?:From|Van|De|Von|Da)\s*:\s*[^<]*?<?\s*([^\s<>,"]+@[^\s<>,"]+)/gim;
  let fromMatch: RegExpExecArray | null;
  while ((fromMatch = fromLineRegex.exec(body)) !== null) {
    if (fromMatch[1]) return fromMatch[1].toLowerCase();
  }

  return null;
}

/**
 * Extract all email addresses from a message.
 * For forwarded emails, prioritizes the original sender over the forwarder.
 * Returns deduplicated list with most relevant addresses first.
 */
export function extractEmailAddresses(
  fromHeader: string,
  body: string,
  excludeAddress?: string,
  subject?: string,
  toHeader?: string,
  ccHeader?: string
): string[] {
  const found = new Set<string>();
  const ordered: string[] = [];
  const excluded = new Set<string>();

  // Always exclude the CRM mailbox address
  if (excludeAddress) {
    excluded.add(excludeAddress.toLowerCase());
  }

  // Get the envelope "from" address
  const fromMatch = fromHeader.match(EMAIL_REGEX);
  const envelopeFrom = fromMatch?.[0]?.toLowerCase();

  // Detect forwarded message
  const isForwarded = isForwardedMessage(subject ?? "", body);

  if (isForwarded && envelopeFrom) {
    // For forwarded emails, also exclude the forwarder's address
    // so we match on the original sender instead
    excluded.add(envelopeFrom);

    // Try to extract the original sender first
    const originalSender = extractForwardedSender(body);
    if (originalSender && !excluded.has(originalSender)) {
      found.add(originalSender);
      ordered.push(originalSender);
    }
  }

  // Add the envelope from (unless excluded)
  if (envelopeFrom && !excluded.has(envelopeFrom) && !found.has(envelopeFrom)) {
    found.add(envelopeFrom);
    ordered.push(envelopeFrom);
  }

  // Add To recipients — crucial for BCC/CC scenarios where the
  // sender is the CRM user and the recipient is the lead
  if (toHeader) {
    const toMatches = toHeader.match(EMAIL_REGEX);
    if (toMatches) {
      for (const email of toMatches) {
        const lower = email.toLowerCase();
        if (!found.has(lower) && !excluded.has(lower)) {
          found.add(lower);
          ordered.push(lower);
        }
      }
    }
  }

  // Add CC recipients
  if (ccHeader) {
    const ccMatches = ccHeader.match(EMAIL_REGEX);
    if (ccMatches) {
      for (const email of ccMatches) {
        const lower = email.toLowerCase();
        if (!found.has(lower) && !excluded.has(lower)) {
          found.add(lower);
          ordered.push(lower);
        }
      }
    }
  }

  // Extract from body (catches additional addresses)
  const bodyMatches = body.match(EMAIL_REGEX);
  if (bodyMatches) {
    for (const email of bodyMatches) {
      const lower = email.toLowerCase();
      if (!found.has(lower) && !excluded.has(lower)) {
        found.add(lower);
        ordered.push(lower);
      }
    }
  }

  return ordered;
}

export interface EmailMatch {
  lead?: Awaited<ReturnType<typeof findLeadByEmail>>;
  person?: Awaited<ReturnType<typeof findPersonByEmail>>;
  matchedEmail?: string;
}

/**
 * Try to match a list of email addresses against leads and persons.
 * Stops at the first match found.
 * Priority: leads first, then persons.
 */
export async function matchEmailAddresses(
  emails: string[]
): Promise<EmailMatch> {
  for (const email of emails) {
    // Try lead match
    const lead = await findLeadByEmail(email);
    if (lead) {
      return { lead, matchedEmail: email };
    }

    // Try person match
    const personResult = await findPersonByEmail(email);
    if (personResult) {
      return { person: personResult, matchedEmail: email };
    }
  }

  return {};
}
