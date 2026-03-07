/**
 * Document RAG Indexing Pipeline
 * Parses PDF, HTML, Excel, Word documents into text chunks
 * and stores them in document_chunks for keyword-based RAG search.
 */
import mysql from "mysql2/promise";

let _conn: mysql.Connection | null = null;

async function getRawDb(): Promise<mysql.Connection | null> {
  if (_conn) {
    try {
      await _conn.ping();
      return _conn;
    } catch {
      _conn = null;
    }
  }
  if (!process.env.DATABASE_URL) return null;
  try {
    _conn = await mysql.createConnection(process.env.DATABASE_URL);
    return _conn;
  } catch (e) {
    console.warn("[DocumentRAG] DB connect error:", e);
    return null;
  }
}

// ─── Text Extraction ──────────────────────────────────────────────────────────

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ text: string; pages?: number }> {
  const mime = mimeType.toLowerCase();
  const name = fileName.toLowerCase();

  // PDF
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer } as any);
      const result = await (parser as any).getText();
      const text = (result?.pages ?? []).map((p: any) => p.content ?? "").join("\n");
      return { text: text || "", pages: result?.total ?? 0 };
    } catch (e) {
      console.error("[DocumentRAG] PDF parse error:", e);
      return { text: "" };
    }
  }

  // Word (.docx)
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value };
    } catch (e) {
      console.error("[DocumentRAG] Word parse error:", e);
      return { text: "" };
    }
  }

  // HTML
  if (mime === "text/html" || name.endsWith(".html") || name.endsWith(".htm")) {
    try {
      const { parse } = await import("node-html-parser");
      const root = parse(buffer.toString("utf-8"));
      root.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
      const text = root.textContent.replace(/\s+/g, " ").trim();
      return { text };
    } catch (e) {
      console.error("[DocumentRAG] HTML parse error:", e);
      return { text: buffer.toString("utf-8").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() };
    }
  }

  // Excel (.xlsx / .xls)
  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  ) {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buffer, { type: "buffer" });
      const texts: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(ws);
        texts.push(`Sheet: ${sheetName}\n${csv}`);
      }
      return { text: texts.join("\n\n") };
    } catch (e) {
      console.error("[DocumentRAG] Excel parse error:", e);
      return { text: "" };
    }
  }

  // Plain text fallback
  if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) {
    return { text: buffer.toString("utf-8") };
  }

  return { text: "" };
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

export function chunkText(text: string): string[] {
  if (!text || text.trim().length === 0) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

// ─── Index Document ───────────────────────────────────────────────────────────

export async function indexDocument(
  documentId: number,
  leadId: number,
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ chunksIndexed: number; textLength: number }> {
  const db = await getRawDb();
  if (!db) {
    console.warn("[DocumentRAG] No DB, skipping indexing");
    return { chunksIndexed: 0, textLength: 0 };
  }

  // Delete existing chunks for this document
  await db.execute("DELETE FROM document_chunks WHERE documentId = ?", [documentId]);

  const { text } = await extractTextFromBuffer(buffer, mimeType, fileName);
  if (!text || text.trim().length === 0) {
    console.warn(`[DocumentRAG] No text extracted from document ${documentId}`);
    return { chunksIndexed: 0, textLength: 0 };
  }

  const chunks = chunkText(text);
  for (let i = 0; i < chunks.length; i++) {
    await db.execute(
      `INSERT INTO document_chunks (documentId, leadId, chunkIndex, textContent, createdAt)
       VALUES (?, ?, ?, ?, NOW())`,
      [documentId, leadId, i, chunks[i]]
    );
  }

  console.log(`[DocumentRAG] Indexed doc ${documentId}: ${chunks.length} chunks, ${text.length} chars`);
  return { chunksIndexed: chunks.length, textLength: text.length };
}

// ─── Search Document Chunks ───────────────────────────────────────────────────

export interface DocumentChunkResult {
  documentId: number;
  leadId: number;
  chunkIndex: number;
  textContent: string;
  fileName: string;
  leadName: string;
  score: number;
}

export async function searchDocumentChunks(
  query: string,
  limit = 5
): Promise<DocumentChunkResult[]> {
  const db = await getRawDb();
  if (!db) return [];

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  if (terms.length === 0) return [];

  const [rows] = await db.execute(
    `SELECT dc.documentId, dc.leadId, dc.chunkIndex, dc.textContent,
            ld.fileName, l.companyName as leadName
     FROM document_chunks dc
     JOIN lead_documents ld ON ld.id = dc.documentId
     JOIN leads l ON l.id = dc.leadId
     ORDER BY dc.createdAt DESC
     LIMIT 500`
  );

  const scored = (rows as any[]).map((row: any) => {
    const content = (row.textContent || "").toLowerCase();
    let score = 0;
    for (const term of terms) {
      const count = (content.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      score += count;
    }
    return { ...row, score };
  });

  return scored
    .filter((r: any) => r.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit);
}

// ─── Priority Score Computation ───────────────────────────────────────────────

export async function computePriorityScore(leadId: number): Promise<number> {
  const db = await getRawDb();
  if (!db) return 0;

  const [leadRows] = await db.execute(
    "SELECT status, priority, estimatedValue, lastContactedAt, nextFollowUpAt FROM leads WHERE id = ?",
    [leadId]
  );
  const lead = (leadRows as any[])[0];
  if (!lead) return 0;

  let score = 0;

  const statusScores: Record<string, number> = {
    new: 10, contacted: 15, qualified: 20, proposal: 25, negotiation: 30, won: 5, lost: 0, on_hold: 5,
  };
  score += statusScores[lead.status] ?? 10;

  const priorityScores: Record<string, number> = { low: 5, medium: 10, high: 20 };
  score += priorityScores[lead.priority] ?? 10;

  if (lead.lastContactedAt) {
    const daysSince = (Date.now() - new Date(lead.lastContactedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) score += 20;
    else if (daysSince < 30) score += 15;
    else if (daysSince < 90) score += 8;
    else score += 2;
  } else {
    score += 5;
  }

  const [cmRows] = await db.execute(
    "SELECT COUNT(*) as cnt FROM contact_moments WHERE leadId = ?",
    [leadId]
  );
  const cmCount = (cmRows as any[])[0]?.cnt ?? 0;
  score += Math.min(Number(cmCount) * 3, 15);

  const [docRows] = await db.execute(
    "SELECT COUNT(*) as cnt FROM lead_documents WHERE leadId = ?",
    [leadId]
  );
  const docCount = (docRows as any[])[0]?.cnt ?? 0;
  score += Math.min(Number(docCount) * 5, 10);

  if (lead.estimatedValue && lead.estimatedValue > 0) score += 5;

  if (lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date()) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

export async function updateAllPriorityScores(): Promise<void> {
  const db = await getRawDb();
  if (!db) return;
  const [rows] = await db.execute("SELECT id FROM leads");
  for (const row of rows as any[]) {
    const score = await computePriorityScore(row.id);
    await db.execute("UPDATE leads SET priorityScore = ? WHERE id = ?", [score, row.id]);
  }
  console.log(`[PriorityScore] Updated ${(rows as any[]).length} leads`);
}
