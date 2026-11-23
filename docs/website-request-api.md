# Website Request API

Endpoint the sendrato.com website posts contact/demo form submissions to. Each
accepted submission lands in the CRM's **People** section and is emailed to the
notification address (`info@sendrato.com` by default).

```
POST /api/website-request
Authorization: Bearer <token>
Content-Type: application/json
```

## Setup

1. **Generate the token** — Settings → _Website Request API_ → **Generate
   Token** (admin only). The token is shown once; copy it into the website's
   configuration. Rotating it invalidates the previous token immediately.
   A `WEBSITE_API_TOKEN` env var is used as a fallback when no token is stored
   in the database.
2. **Configure SMTP** — Settings → _Outgoing Email (SMTP)_. Without it the
   submission is still stored and linked in the CRM, but the notification email
   fails (recorded in `website_requests.notifyError`; a failed CRM write lands
   in `processError`). Env fallbacks:
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`,
   `SMTP_FROM`, `SMTP_ALLOW_INVALID_CERT`.

   Sendrato's mail host (`mail.dexels.com`) serves a self-signed certificate
   with `CN=localhost` on every port, so **Allow self-signed certificate** has
   to be on or the connection is refused with `self-signed certificate`. That
   keeps the session encrypted but stops authenticating the server, which is
   the same concession `imapPoller` already makes for this host — only enable
   it for a mail server you control.

3. **Set the notification address** — defaults to `info@sendrato.com`, override
   in the same card or with `WEBSITE_NOTIFY_EMAIL`.

Until a token exists the endpoint answers `503 Endpoint not configured` — it
never silently accepts unauthenticated traffic.

## Payload

Field names may be `snake_case` (as exported by the website) or `camelCase`.
Unknown fields are ignored; scalars are coerced to strings and trimmed, and
empty strings are treated as absent.

| Field          | Required | Notes                                                                                                                                                          |
| -------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | no       | The website's submission id. Makes delivery **idempotent** — re-posting the same id returns the first result instead of creating a second person.              |
| `name`         | no\*     | Falls back to a name derived from the email local part.                                                                                                        |
| `email`        | **yes**  | Must be a valid address; used to match an existing person.                                                                                                     |
| `company`      | no       | Only fills a person's empty company — never overwrites.                                                                                                        |
| `event_type`   | no       | Stored, and added as the tag `event:<value>`.                                                                                                                  |
| `request_type` | no       | Stored, tagged as `request:<value>`, and mapped onto the contact moment type when it matches one (`demo`, `meeting`, `phone`, …) — otherwise `other`.          |
| `message`      | no\*     | The visitor's message.                                                                                                                                         |
| `honeypot`     | no       | **Must be empty.** Anything else marks the submission as spam.                                                                                                 |
| `created_at`   | no       | Submission time. `2026-11-14 09:21:54.049883+00` and ISO 8601 both parse; a value without a UTC offset is read as server-local time. Defaults to receipt time. |

\* At least one of `name` or `message` is required.

Post a single object, a bare array, or `{ "requests": [...] }` — at most 50 per
call.

### Example

```bash
curl -X POST https://crm.sendrato.com/api/website-request \
  -H "Authorization: Bearer srq_…" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "9e99b456-d44e-4c66-8b38-e30d3e763990",
    "name": "Anita Anand",
    "email": "anita@example.com",
    "company": "",
    "event_type": "festival",
    "message": "Looking for a white label app provider for a 3 day festival…",
    "request_type": "demo",
    "honeypot": "",
    "created_at": "2026-11-14 09:21:54.049883+00"
  }'
```

## Response

```json
{
  "success": true,
  "accepted": 1,
  "rejected": 0,
  "results": [
    {
      "id": "9e99b456-d44e-4c66-8b38-e30d3e763990",
      "status": "created",
      "requestId": 12,
      "personId": 345,
      "personCreated": true,
      "notified": true
    }
  ]
}
```

`status` is `created`, `duplicate` (the `id` was seen before) or `spam` (the
honeypot was filled — recorded, but no person and no email). Per-item failures
come back in an `errors` array alongside the accepted results; the call is a
`200` as long as at least one submission was accepted, so the website can stop
retrying the good ones.

| Status | Meaning                                                    |
| ------ | ---------------------------------------------------------- |
| 200    | At least one submission accepted.                          |
| 400    | Nothing usable in the body, or the batch exceeds 50 items. |
| 401    | Missing or wrong bearer token.                             |
| 429    | More than 60 requests per minute from one IP.              |
| 503    | No bearer token configured on the server.                  |

## What happens to a submission

1. The raw payload is stored in `website_requests` (audit trail + idempotency).
2. A **person** is created in the People section (`personType: prospect`,
   `source: website`, tagged `website`), or an existing person with the same
   email — matched case-insensitively — is updated. Updates only fill blanks
   and append the message to the notes; curated CRM data is never overwritten.
3. An **inbound contact moment** is logged on that person (`source: website`)
   with a follow-up one day after submission, so the request surfaces in the
   follow-up lists.
4. The request is **emailed** to the notification address, with the submitter's
   address as `Reply-To`. A mail failure never fails the request — it is
   recorded on the row and the latest requests are listed in Settings with an
   `emailed` / `not emailed` badge.

Honeypot hits return `200` so bots cannot distinguish them from real
submissions.
