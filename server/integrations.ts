/**
 * Integration endpoints:
 * - POST /api/email-ingest  — CC email ingestion
 * - POST /api/slack-webhook — Slack slash command / event webhook
 * - POST /api/import        — Excel/CSV bulk import
 */

import type { Express, Request, Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import {
  findLeadByEmail,
  createContactMoment,
  createLead,
  logEmailIngest,
  bulkInsertLeads,
  getLeadById,
  updateLead,
  getRawPool,
} from "./db";
import { enrichLeadFromWeb } from "./enrichmentEngine";
import { storagePut } from "./storage";
import { indexLead } from "./crmChat";
import { indexDocument, computePriorityScore, updateAllPriorityScores } from "./documentRag";
import { nanoid } from "nanoid";
import { generateText } from "ai";
import { getLLMProvider } from "./llmProvider";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Email Ingestion ──────────────────────────────────────────────────────────
export function registerIntegrationRoutes(app: Express) {
  /**
   * POST /api/email-ingest
   * Accepts a JSON payload from an email forwarding service (e.g. SendGrid Inbound Parse,
   * Postmark, Mailgun). Parses the email and creates a contact moment for the matching lead.
   */
  app.post("/api/email-ingest", async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const from: string = body.from ?? body.sender ?? "";
      const to: string = body.to ?? body.recipient ?? "";
      const subject: string = body.subject ?? "";
      const text: string = body.text ?? body.plain ?? "";
      const html: string = body.html ?? "";

      const rawPayload = JSON.stringify(body).slice(0, 10000);

      // Extract sender email address
      const fromEmailMatch = from.match(/[\w.+-]+@[\w.-]+\.\w+/);
      const fromEmail = fromEmailMatch ? fromEmailMatch[0] : from;

      // Try to match lead by sender email
      let matchedLead = await findLeadByEmail(fromEmail);

      // If not matched by sender, try to find from subject or body
      let status: "matched" | "unmatched" | "error" = matchedLead ? "matched" : "unmatched";

      if (matchedLead) {
        // Create a contact moment
        await createContactMoment({
          leadId: matchedLead.id,
          type: "email",
          direction: "inbound",
          subject: subject.slice(0, 512),
          notes: text.slice(0, 5000),
          emailFrom: fromEmail,
          emailTo: to,
          emailRaw: (html || text).slice(0, 10000),
          source: "email_ingest",
          occurredAt: new Date(),
        });
      }

      await logEmailIngest({
        rawPayload,
        parsedFrom: fromEmail,
        parsedTo: to,
        parsedSubject: subject,
        matchedLeadId: matchedLead?.id,
        status,
      });

      res.json({
        success: true,
        status,
        matchedLead: matchedLead ? { id: matchedLead.id, companyName: matchedLead.companyName } : null,
      });
    } catch (error) {
      console.error("[/api/email-ingest] Error:", error);
      await logEmailIngest({
        rawPayload: JSON.stringify(req.body).slice(0, 1000),
        parsedFrom: "",
        parsedTo: "",
        parsedSubject: "",
        status: "error",
      });
      res.status(500).json({ error: "Failed to process email" });
    }
  });

  /**
   * POST /api/slack-webhook
   */
  app.post("/api/slack-webhook", async (req: Request, res: Response) => {
    try {
      const body = req.body;

      // Handle Slack URL verification challenge
      if (body.type === "url_verification") {
        res.json({ challenge: body.challenge });
        return;
      }

      const command: string = body.command ?? "";
      const text: string = body.text ?? "";
      const userName: string = body.user_name ?? "slack-user";

      let responseText = "";

      if (command === "/crm-lead" || text.startsWith("lead ")) {
        const parts = text.replace(/^lead\s+/, "").split("|").map((s: string) => s.trim());
        const [companyName, contactPerson, email] = parts;

        if (!companyName) {
          responseText = "Usage: /crm-lead Company Name | Contact Person | email@example.com";
        } else {
          const lead = await createLead({
            companyName,
            contactPerson: contactPerson || undefined,
            email: email || undefined,
            source: "slack",
            status: "new",
            priority: "medium",
            notes: `Created via Slack by ${userName}`,
          });
          if (lead) await indexLead(lead as unknown as Record<string, unknown>);
          responseText = `✅ Lead created: *${companyName}*${contactPerson ? ` (${contactPerson})` : ""} — ID: ${lead?.id}`;
        }
      } else if (command === "/crm-note" || text.startsWith("note ")) {
        const parts = text.replace(/^note\s+/, "").split("|").map((s: string) => s.trim());
        const [companyQuery, noteText] = parts;

        if (!companyQuery || !noteText) {
          responseText = "Usage: /crm-note Company Name | Your note about the interaction";
        } else {
          const { items } = await (await import("./db")).getLeads({ search: companyQuery, limit: 1 });
          const lead = items[0];
          if (!lead) {
            responseText = `❌ No lead found matching "${companyQuery}"`;
          } else {
            await createContactMoment({
              leadId: lead.id,
              type: "slack",
              direction: "outbound",
              notes: noteText,
              subject: `Slack note by ${userName}`,
              source: "slack",
              occurredAt: new Date(),
            });
            responseText = `✅ Note logged for *${lead.companyName}*`;
          }
        }
      } else if (command === "/crm-search" || text.startsWith("search ")) {
        const query = text.replace(/^search\s+/, "").trim();
        const { items } = await (await import("./db")).getLeads({ search: query, limit: 5 });
        if (items.length === 0) {
          responseText = `No leads found for "${query}"`;
        } else {
          responseText = `Found ${items.length} lead(s):\n${items.map((l) => `• *${l.companyName}* — ${l.status} — ${l.contactPerson ?? "No contact"}`).join("\n")}`;
        }
      } else {
        responseText = `Available commands:\n• \`/crm-lead Company | Contact | Email\` — Create lead\n• \`/crm-note Company | Note\` — Log interaction\n• \`/crm-search Query\` — Search leads`;
      }

      res.json({
        response_type: "in_channel",
        text: responseText,
      });
    } catch (error) {
      console.error("[/api/slack-webhook] Error:", error);
      res.json({ text: "❌ An error occurred processing your request." });
    }
  });

  /**
   * POST /api/import
   */
  app.post("/api/import", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const mappingRaw = req.body.mapping;
      const mapping: Record<string, string> = mappingRaw ? JSON.parse(mappingRaw) : {};

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (rows.length === 0) {
        res.status(400).json({ error: "No data found in file" });
        return;
      }

      const defaultMapping: Record<string, string> = {
        "company name": "companyName",
        company: "companyName",
        "company_name": "companyName",
        website: "website",
        url: "website",
        contact: "contactPerson",
        "contact person": "contactPerson",
        "contact_person": "contactPerson",
        name: "contactPerson",
        email: "email",
        "e-mail": "email",
        phone: "phone",
        telephone: "phone",
        status: "status",
        priority: "priority",
        notes: "notes",
        industry: "industry",
        location: "location",
        "pain points": "painPoints",
        "pain_points": "painPoints",
        opportunities: "futureOpportunities",
        "future opportunities": "futureOpportunities",
        "revenue model": "revenueModel",
        risks: "risks",
        "social media": "socialMedia",
        "ticketing system": "ticketingSystem",
        "payment methods": "paymentMethods",
        "mobile app": "mobileApp",
        "brand tone": "brandTone",
        "survey status": "surveyStatus",
        "decision maker": "contactPerson",
      };

      const effectiveMapping = { ...defaultMapping, ...mapping };

      const leadsToInsert = rows
        .filter((row) => {
          const hasCompany = Object.entries(row).some(([k, v]) => {
            const normalized = k.toLowerCase().trim();
            return (effectiveMapping[normalized] === "companyName" || normalized.includes("company")) && v;
          });
          return hasCompany;
        })
        .map((row) => {
          const lead: Record<string, unknown> = { source: "excel_import" };
          for (const [rawKey, value] of Object.entries(row)) {
            const normalized = rawKey.toLowerCase().trim();
            const mappedField = effectiveMapping[normalized];
            if (mappedField && value !== "" && value !== null && value !== undefined) {
              lead[mappedField] = String(value);
            }
          }
          if (!lead.companyName) {
            const firstVal = Object.values(row).find((v) => v && typeof v === "string");
            if (firstVal) lead.companyName = String(firstVal);
          }
          return lead;
        })
        .filter((l) => l.companyName);

      const ids = await bulkInsertLeads(leadsToInsert as Parameters<typeof bulkInsertLeads>[0]);

      // Index all imported leads asynchronously
      setTimeout(async () => {
        for (const id of ids) {
          const { getLeadById } = await import("./db");
          const lead = await getLeadById(id);
          if (lead) await indexLead(lead as unknown as Record<string, unknown>);
        }
      }, 100);

      res.json({
        success: true,
        imported: ids.length,
        total: rows.length,
        skipped: rows.length - leadsToInsert.length,
      });
    } catch (error) {
      console.error("[/api/import] Error:", error);
      res.status(500).json({ error: "Failed to import file" });
    }
  });

  /**
   * POST /api/upload-document
   */
  app.post("/api/upload-document", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }
      const leadId = parseInt(req.body.leadId ?? "0");
      const category = req.body.category ?? "other";
      const userId = req.body.userId ? parseInt(req.body.userId) : undefined;

      const ext = req.file.originalname.split(".").pop() ?? "bin";
      const fileKey = `leads/${leadId}/docs/${nanoid()}.${ext}`;
      const { url } = await storagePut(fileKey, req.file.buffer, req.file.mimetype);

      // Save document record to DB
      const pool = await getRawPool();
      if (!pool) throw new Error("No DB connection");

      const { rows } = await pool.query(
        `INSERT INTO lead_documents ("leadId", "fileName", "fileKey", "fileUrl", "mimeType", "fileSize", category, "uploadedBy", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id`,
        [leadId, req.file.originalname, fileKey, url, req.file.mimetype, req.file.size, category, userId ?? null]
      );
      const documentId = rows[0].id;

      // Trigger RAG indexing asynchronously
      const buffer = req.file.buffer;
      const mimeType = req.file.mimetype;
      const fileName = req.file.originalname;
      setTimeout(async () => {
        try {
          await indexDocument(documentId, leadId, buffer, mimeType, fileName);
          const score = await computePriorityScore(leadId);
          const scorePool = await getRawPool();
          if (scorePool) await scorePool.query('UPDATE leads SET "priorityScore" = $1 WHERE id = $2', [score, leadId]);
        } catch (e) {
          console.error("[DocumentRAG] Background indexing error:", e);
        }
      }, 100);

      res.json({
        success: true,
        documentId,
        fileKey,
        fileUrl: url,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        category,
        ragIndexing: true,
      });
    } catch (error) {
      console.error("[/api/upload-document] Error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  /**
   * POST /api/share-presentation
   */
  app.post("/api/share-presentation", async (req: Request, res: Response) => {
    try {
      const { documentId, leadId, title, recordContactMoment, userId, notes } = req.body;
      if (!documentId || !leadId) {
        res.status(400).json({ error: "documentId and leadId are required" });
        return;
      }

      const pool = await getRawPool();
      if (!pool) throw new Error("No DB connection");

      // Check document exists and is HTML
      const { rows: docRows } = await pool.query(
        'SELECT * FROM lead_documents WHERE id = $1 AND "leadId" = $2',
        [documentId, leadId]
      );
      const doc = docRows[0];
      if (!doc) {
        res.status(404).json({ error: "Document not found" });
        return;
      }

      // Generate unique token
      const token = nanoid(32);
      await pool.query(
        `INSERT INTO shareable_presentations ("documentId", "leadId", token, title, "createdBy", "createdAt", "isActive")
         VALUES ($1, $2, $3, $4, $5, NOW(), TRUE)`,
        [documentId, leadId, token, title ?? doc.fileName, userId ?? null]
      );

      const shareUrl = `${req.protocol}://${req.get("host")}/share/${token}`;

      // Optionally record as contact moment
      if (recordContactMoment) {
        await createContactMoment({
          leadId: parseInt(leadId),
          type: "email",
          direction: "outbound",
          subject: `Shared presentation: ${title ?? doc.fileName}`,
          notes: notes ?? `Shared document "${doc.fileName}" via link: ${shareUrl}`,
          source: "manual",
          userId: userId ? parseInt(userId) : undefined,
          outcome: "neutral",
        });
      }

      res.json({ success: true, token, shareUrl });
    } catch (error) {
      console.error("[/api/share-presentation] Error:", error);
      res.status(500).json({ error: "Failed to create share link" });
    }
  });

  /**
   * GET /share/:token
   */
  app.get("/share/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const pool = await getRawPool();
      if (!pool) { res.status(503).send("Service unavailable"); return; }

      const { rows } = await pool.query(
        `SELECT sp.*, ld."fileUrl", ld."fileName", ld."mimeType", l."companyName"
         FROM shareable_presentations sp
         JOIN lead_documents ld ON ld.id = sp."documentId"
         JOIN leads l ON l.id = sp."leadId"
         WHERE sp.token = $1 AND sp."isActive" = TRUE`,
        [token]
      );
      const share = rows[0];

      if (!share) {
        res.status(404).send("<h1>Presentation not found or link has expired.</h1>");
        return;
      }

      // Check expiry
      if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
        res.status(410).send("<h1>This presentation link has expired.</h1>");
        return;
      }

      // Update view count
      await pool.query(
        `UPDATE shareable_presentations SET "viewCount" = "viewCount" + 1, "lastViewedAt" = NOW() WHERE token = $1`,
        [token]
      );

      const mime = (share.mimeType ?? "").toLowerCase();
      const isHtml = mime === "text/html" || share.fileName.endsWith(".html") || share.fileName.endsWith(".htm");

      if (isHtml) {
        try {
          const htmlRes = await fetch(share.fileUrl);
          const html = await htmlRes.text();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.send(html);
        } catch {
          res.redirect(share.fileUrl);
        }
      } else {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${share.title ?? share.fileName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0f1117; color: #e2e8f0; min-height: 100vh; display: flex; flex-direction: column; }
    header { background: #1a1d27; border-bottom: 1px solid #2d3148; padding: 16px 24px; display: flex; align-items: center; gap: 12px; }
    .logo { width: 32px; height: 32px; background: #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: 14px; }
    h1 { font-size: 1.1rem; font-weight: 600; }
    .sub { font-size: 0.8rem; color: #94a3b8; }
    main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; gap: 24px; }
    .card { background: #1a1d27; border: 1px solid #2d3148; border-radius: 16px; padding: 40px; text-align: center; max-width: 480px; width: 100%; }
    .icon { font-size: 3rem; margin-bottom: 16px; }
    h2 { font-size: 1.4rem; margin-bottom: 8px; }
    p { color: #94a3b8; margin-bottom: 24px; }
    a.btn { display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; transition: opacity 0.2s; }
    a.btn:hover { opacity: 0.9; }
    .meta { font-size: 0.8rem; color: #64748b; margin-top: 16px; }
  </style>
</head>
<body>
  <header>
    <div class="logo">SF</div>
    <div>
      <h1>${share.title ?? share.fileName}</h1>
      <div class="sub">Shared by ${share.companyName ?? "SalesFlow CRM"}</div>
    </div>
  </header>
  <main>
    <div class="card">
      <div class="icon">📄</div>
      <h2>${share.fileName}</h2>
      <p>Click the button below to view or download this document.</p>
      <a class="btn" href="${share.fileUrl}" target="_blank" rel="noopener">Open Document</a>
      <div class="meta">Viewed ${share.viewCount} time${share.viewCount !== 1 ? "s" : ""}</div>
    </div>
  </main>
</body>
</html>`);
      }
    } catch (error) {
      console.error("[/share/:token] Error:", error);
      res.status(500).send("<h1>An error occurred.</h1>");
    }
  });

  /**
   * GET /api/share-info/:token
   */
  app.get("/api/share-info/:token", async (req: Request, res: Response) => {
    try {
      const pool = await getRawPool();
      if (!pool) { res.status(503).json({ error: "DB unavailable" }); return; }
      const { rows } = await pool.query(
        `SELECT sp.*, ld."fileName", ld."mimeType" FROM shareable_presentations sp
         JOIN lead_documents ld ON ld.id = sp."documentId" WHERE sp.token = $1`,
        [req.params.token]
      );
      const share = rows[0];
      if (!share) { res.status(404).json({ error: "Not found" }); return; }
      res.json(share);
    } catch (e) {
      res.status(500).json({ error: "Failed" });
    }
  });

  /**
   * GET /api/shares/:leadId
   */
  app.get("/api/shares/:leadId", async (req: Request, res: Response) => {
    try {
      const pool = await getRawPool();
      if (!pool) { res.status(503).json({ error: "DB unavailable" }); return; }
      const { rows } = await pool.query(
        `SELECT sp.*, ld."fileName", ld."mimeType" FROM shareable_presentations sp
         JOIN lead_documents ld ON ld.id = sp."documentId"
         WHERE sp."leadId" = $1 ORDER BY sp."createdAt" DESC`,
        [req.params.leadId]
      );
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: "Failed" });
    }
  });

  /**
   * POST /api/priority-scores/refresh
   */
  app.post("/api/priority-scores/refresh", async (_req: Request, res: Response) => {
    try {
      await updateAllPriorityScores();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to refresh scores" });
    }
  });

  /**
   * POST /api/priority-scores/:leadId
   */
  app.post("/api/priority-scores/:leadId", async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.leadId);
      const score = await computePriorityScore(leadId);
      const pool = await getRawPool();
      if (pool) await pool.query('UPDATE leads SET "priorityScore" = $1 WHERE id = $2', [score, leadId]);
      res.json({ success: true, score });
    } catch (e) {
      res.status(500).json({ error: "Failed" });
    }
  });

  /**
   * POST /api/enrich-lead/:id
   */
  app.post("/api/enrich-lead/:id", async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id);
      const lead = await getLeadById(leadId);
      if (!lead) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }

      const enrichmentData = await enrichLeadFromWeb(lead);

      await updateLead(leadId, {
        enrichmentData,
        enrichedAt: new Date(),
      });

      // Re-index the lead so AI chat can find the enriched data
      const updatedLead = await getLeadById(leadId);
      if (updatedLead) await indexLead(updatedLead as unknown as Record<string, unknown>);

      res.json({ success: true, enrichmentData });
    } catch (error) {
      console.error("[/api/enrich-lead] Error:", error);
      res.status(500).json({ error: "Enrichment failed", details: String(error) });
    }
  });

  /**
   * POST /api/import/preview
   */
  app.post("/api/import/preview", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      const preview = rows.slice(0, 5);

      res.json({ columns, preview, totalRows: rows.length });
    } catch (error) {
      console.error("[/api/import/preview] Error:", error);
      res.status(500).json({ error: "Failed to preview file" });
    }
  });

  /**
   * POST /api/import-json
   */
  app.post("/api/import-json", async (req: Request, res: Response) => {
    try {
      const { leads: rawLeads } = req.body as { leads: Record<string, unknown>[] };
      if (!Array.isArray(rawLeads) || rawLeads.length === 0) {
        res.status(400).json({ error: "No leads provided" });
        return;
      }

      const leadsToInsert = rawLeads
        .filter((r) => r.companyName)
        .map((r) => ({
          companyName: String(r.companyName ?? ""),
          website: r.website ? String(r.website) : undefined,
          industry: r.industry ? String(r.industry) : undefined,
          location: r.location ? String(r.location) : undefined,
          contactPerson: r.contactPerson ? String(r.contactPerson) : undefined,
          contactTitle: r.contactTitle ? String(r.contactTitle) : undefined,
          email: r.email ? String(r.email) : undefined,
          phone: r.phone ? String(r.phone) : undefined,
          notes: r.notes ? String(r.notes) : undefined,
          painPoints: r.painPoints ? String(r.painPoints) : undefined,
          futureOpportunities: r.futureOpportunities ? String(r.futureOpportunities) : undefined,
          revenueModel: r.revenueModel ? String(r.revenueModel) : undefined,
          risks: r.risks ? String(r.risks) : undefined,
          status: (r.status as "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost" | "on_hold") ?? "new",
          priority: (r.priority as "low" | "medium" | "high") ?? "medium",
          source: r.source ? String(r.source) : "api_import",
        }));

      const ids = await bulkInsertLeads(leadsToInsert as Parameters<typeof bulkInsertLeads>[0]);

      // Background: index all imported leads for vector search
      setTimeout(async () => {
        for (const id of ids) {
          const lead = await getLeadById(id);
          if (lead) await indexLead(lead as unknown as Record<string, unknown>);
        }
      }, 500);

      res.json({
        success: true,
        imported: ids.length,
        total: rawLeads.length,
        skipped: rawLeads.length - leadsToInsert.length,
      });
    } catch (error) {
      console.error("[/api/import-json] Error:", error);
      res.status(500).json({ error: "Failed to import leads" });
    }
  });

  // ─── LinkedIn Profile Import ───────────────────────────────────────────────
  app.post("/api/linkedin-import", async (req: Request, res: Response) => {
    try {
      const { url } = req.body as { url?: string };
      if (!url || !url.includes("linkedin.com")) {
        return res.status(400).json({ error: "A valid LinkedIn profile URL is required" });
      }

      const profileUrl = url.trim().split("?")[0].replace(/\/$/, "");

      let pageText = "";
      try {
        const response = await fetch(profileUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
          },
        });
        const html = await response.text();
        pageText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim()
          .slice(0, 8000);
      } catch (fetchErr) {
        console.warn("[linkedin-import] Could not fetch page:", fetchErr);
      }

      const { provider, chatModel } = await getLLMProvider();

      const systemPrompt = `You are a data extraction assistant. Extract person details from LinkedIn profile information.
Always return ONLY a valid JSON object with these exact fields (use null for unknown fields):
{
  "name": "Full name or null",
  "title": "Current job title or null",
  "company": "Current employer or null",
  "email": null,
  "phone": null,
  "summary": "2-3 sentence professional summary",
  "personType": "one of: prospect, contact, partner, reseller, influencer, investor, other",
  "location": "City, Country or null",
  "industry": "Industry sector or null"
}
Return ONLY the JSON object, no markdown, no explanation.`;

      const urlSlug = profileUrl.split("/in/").pop()?.replace(/\/$/, "") ?? "";
      const slugParts = urlSlug.replace(/-\d+$/, "").split("-").filter(Boolean);
      const slugNameHint = slugParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");

      const userPrompt = pageText && pageText.length > 200
        ? `Extract person details from this LinkedIn profile page.\n\nLinkedIn URL: ${profileUrl}\n\nPage content:\n${pageText}`
        : `The LinkedIn profile at ${profileUrl} could not be fetched (LinkedIn blocks automated access).\n\nURL slug: "${urlSlug}"\nName hint from slug: "${slugNameHint}"\n\nUse the slug to infer the person's full name (e.g. "john-doe" -> "John Doe", "zijlma" -> "Zijlma"). Set summary to "LinkedIn profile — please complete details manually" and personType to "prospect". Leave all other fields as null.`;

      const { text: llmText } = await generateText({
        model: provider.chat(chatModel),
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 600,
      });

      let extracted: Record<string, string | null> = {};
      try {
        const jsonMatch = llmText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extracted = JSON.parse(jsonMatch[0]);
        }
      } catch {
        console.warn("[linkedin-import] Could not parse LLM JSON response:", llmText);
      }

      res.json({
        success: true,
        data: {
          name: extracted.name ?? null,
          title: extracted.title ?? null,
          company: extracted.company ?? null,
          email: extracted.email ?? null,
          phone: extracted.phone ?? null,
          summary: extracted.summary ?? null,
          personType: extracted.personType ?? "prospect",
          location: extracted.location ?? null,
          industry: extracted.industry ?? null,
          linkedInUrl: profileUrl,
          pageTextLength: pageText.length,
          fetchedProfile: pageText.length > 100,
        },
      });
    } catch (error) {
      console.error("[/api/linkedin-import] Error:", error);
      res.status(500).json({ error: "Failed to import LinkedIn profile" });
    }
  });
}
