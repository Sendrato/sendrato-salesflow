/**
 * Email Matcher
 *
 * Extracts email addresses from messages (including forwarded emails)
 * and matches them against leads and persons in the CRM.
 */

import { findLeadByEmail, findPersonByEmail } from "./db";

const EMAIL_REGEX = /[\w.+-]+@[\w.-]+\.\w{2,}/g;

/**
 * Extract all email addresses from a message.
 * Handles direct emails and forwarded emails (scans body for original sender).
 * Returns deduplicated list with the "from" address first.
 */
export function extractEmailAddresses(
  fromHeader: string,
  body: string,
  excludeAddress?: string
): string[] {
  const found = new Set<string>();
  const ordered: string[] = [];

  // 1. Extract from the "from" header
  const fromMatch = fromHeader.match(EMAIL_REGEX);
  if (fromMatch) {
    for (const email of fromMatch) {
      const lower = email.toLowerCase();
      if (!found.has(lower)) {
        found.add(lower);
        ordered.push(lower);
      }
    }
  }

  // 2. Extract from body (catches forwarded email original senders)
  const bodyMatches = body.match(EMAIL_REGEX);
  if (bodyMatches) {
    for (const email of bodyMatches) {
      const lower = email.toLowerCase();
      if (!found.has(lower)) {
        found.add(lower);
        ordered.push(lower);
      }
    }
  }

  // 3. Filter out the CRM mailbox address itself
  if (excludeAddress) {
    const excluded = excludeAddress.toLowerCase();
    return ordered.filter((e) => e !== excluded);
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
