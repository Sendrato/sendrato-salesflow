# Share Link View Tracking — Diagnosis & Fix Plan

## Problem

The "Recent Link Views" widget on the dashboard shows views that look suspicious — multiple views of the same document from the same region (e.g. Sydney/Melbourne AU) on the same day, including views of internal documents and views with no associated lead.

## Diagnosis

Looking at `server/integrations.ts:801-882` and `server/routers/analytics.ts:305-346`, every HTTP GET to `/share/:token` becomes a recorded view. There is **no filtering of any kind**:

- No User-Agent check (the UA is logged but never inspected)
- No IP deduplication / debouncing
- No JS beacon — a HEAD or curl-style GET counts the same as a human opening the page
- The view is recorded *before* the file is served, so failed/partial fetches still count

### Most likely cause: email security URL scanners

The pattern is the textbook signature of inbound-mail link scanners — Microsoft Defender Safe Links, Mimecast, Proofpoint, Barracuda, etc. They rewrite every link in inbound mail and pre-fetch the destination from cloud egress IPs *before* delivering it to the recipient's inbox.

Tells in the observed data:

- `sendrato_live_112358132134.html` viewed 3 times from AU (Sydney + 2× Melbourne) on the same day — Defender/Mimecast typically re-scan from multiple PoPs
- `Sendrato_Pay_AU_Pricing_Memo_INTERNAL.docx` "viewed" from Melbourne AU — that document is marked INTERNAL and was almost certainly sent to a single AU recipient whose mail provider scanned the link
- Mix of unrelated documents all from Melbourne AU on the same day → one recipient's mail provider scanning multiple links sent to them
- Melbourne and Sydney are exactly where Microsoft 365 and AWS host their AU egress

**Conclusion:** these are very likely *not* unauthorized accesses — they are recipients' own mail providers pre-fetching the links. Under the current code, real opens and scanner pre-fetches are indistinguishable.

## Affected code

| File | Lines | What it does |
| --- | --- | --- |
| `server/integrations.ts` | 801–882 | `GET /share/:token` — increments `viewCount` and inserts into `presentation_views` on every request |
| `drizzle/schema.ts` | 262–293 | `shareable_presentations` and `presentation_views` tables — no unique constraints / dedupe indices |
| `server/routers/analytics.ts` | 305–346 | `recentShareViews` tRPC query — surfaces raw rows to the dashboard |
| `server/geoip.ts` | — | GeoIP resolution via `ip-api.com`; private IPs already filtered |

## Fix options

Three levers, in increasing order of trustworthiness:

### 1. Bot User-Agent filter (~30 min)

Reject views whose `User-Agent` matches known scanners before the INSERT into `presentation_views`. Patterns to match (case-insensitive):

- `bot`, `crawler`, `spider`
- `Slackbot`, `Twitterbot`, `facebookexternalhit`, `LinkedInBot`, `WhatsApp`, `TelegramBot`, `Discordbot`
- `Mimecast`, `Proofpoint`, `Barracuda`, `Microsoft Office`, `Outlook`, `MicrosoftPreview`
- `Google-Safety`, `GoogleImageProxy`, `Google-Read-Aloud`
- `curl`, `wget`, `HeadlessChrome`, `python-requests`, `Go-http-client`

Cheap, but sophisticated scanners spoof UA — not a complete defense.

### 2. IP + presentation debounce (~30 min)

Only record one view per `(presentationId, ipAddress)` per N minutes (suggested: 30 min). Implementation: check for an existing row in `presentation_views` within the window before inserting. Cleans up duplicates regardless of UA.

Also: skip the `viewCount` increment when the view is debounced, so the count matches reality.

### 3. JS beacon (~2h)

Only count a view when the rendered HTML executes JS and POSTs to a new `/api/share-view/:token` endpoint after load. Bots that don't execute JS (almost all email scanners) stop counting entirely.

Implementation:

- Inject a small `<script>` into served HTML (already templated via `fetch + res.send` at line 894–898) that POSTs the token after `DOMContentLoaded`
- Move the INSERT into `presentation_views` to the new endpoint
- Keep the legacy GET path for backwards compatibility but stop counting from it

Most reliable. Combine with (2) for de-duping repeat opens.

## Recommendation

**Phase 1 (today):** Implement (1) + (2) as a quick cleanup. Include a one-off SQL pass that deletes existing `presentation_views` rows matching bot UA patterns, then recomputes `shareable_presentations.viewCount` and `lastViewedAt` from the remaining rows.

**Phase 2 (later):** Add (3) as the real fix once we want hard guarantees about what counts as a view.

## Historical cleanup SQL (sketch)

```sql
-- Delete bot views
DELETE FROM presentation_views
WHERE "userAgent" ~* '(bot|crawler|spider|slackbot|mimecast|proofpoint|barracuda|microsoft office|outlook|microsoftpreview|google-safety|curl|wget|headlesschrome|python-requests|go-http-client|facebookexternalhit|linkedinbot|whatsapp|telegrambot|discordbot)';

-- Recompute view counts from surviving rows
UPDATE shareable_presentations sp SET
  "viewCount" = COALESCE(v.cnt, 0),
  "lastViewedAt" = v.last
FROM (
  SELECT "presentationId", COUNT(*) AS cnt, MAX("viewedAt") AS last
  FROM presentation_views
  GROUP BY "presentationId"
) v
WHERE sp.id = v."presentationId";

UPDATE shareable_presentations
SET "viewCount" = 0, "lastViewedAt" = NULL
WHERE id NOT IN (SELECT DISTINCT "presentationId" FROM presentation_views);
```

Run this *after* deploying the bot filter so new bot views don't immediately repopulate the table.

## Open questions

- What debounce window do we want — 30 min, 1h, 24h?
- Should we keep a separate `is_bot` boolean on `presentation_views` instead of dropping bot rows entirely (useful for forensics)?
- Do we want to display a "X views (Y filtered as bots)" hint on the dashboard?
