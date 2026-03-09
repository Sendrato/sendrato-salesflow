/**
 * Document RAG Indexing Pipeline
 * Parses PDF, HTML, Excel, Word documents into text chunks,
 * generates embeddings via OpenAI, and stores them with pgvector for semantic search.
 */
import { embed, embedMany } from "ai";
import { getRawPool } from "./db";
import { getEmbeddingModel } from "./llmProvider";

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
      return { text: result?.text ?? "", pages: result?.total ?? 0 };
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
  const pool = await getRawPool();
  if (!pool) {
    console.warn("[DocumentRAG] No DB, skipping indexing");
    return { chunksIndexed: 0, textLength: 0 };
  }

  // Delete existing chunks for this document
  await pool.query('DELETE FROM document_chunks WHERE "documentId" = $1', [documentId]);

  const { text } = await extractTextFromBuffer(buffer, mimeType, fileName);
  if (!text || text.trim().length === 0) {
    console.warn(`[DocumentRAG] No text extracted from document ${documentId}`);
    return { chunksIndexed: 0, textLength: 0 };
  }

  const chunks = chunkText(text);

  // Generate embeddings for all chunks in batch
  let embeddings: number[][] = [];
  try {
    const embeddingModel = await getEmbeddingModel();
    const result = await embedMany({
      model: embeddingModel,
      values: chunks,
    });
    embeddings = result.embeddings;
  } catch (err) {
    console.error("[DocumentRAG] Embedding generation failed, storing chunks without embeddings:", err);
  }

  for (let i = 0; i < chunks.length; i++) {
    const embeddingValue = embeddings[i] ? JSON.stringify(embeddings[i]) : null;
    await pool.query(
      `INSERT INTO document_chunks ("documentId", "leadId", "chunkIndex", "textContent", embedding, "createdAt")
       VALUES ($1, $2, $3, $4, $5::vector, NOW())`,
      [documentId, leadId, i, chunks[i], embeddingValue]
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
  const pool = await getRawPool();
  if (!pool) return [];

  try {
    const embeddingModel = await getEmbeddingModel();
    const { embedding: queryEmbedding } = await embed({
      model: embeddingModel,
      value: query,
    });

    const { rows } = await pool.query(
      `SELECT dc."documentId", dc."leadId", dc."chunkIndex", dc."textContent",
              ld."fileName", l."companyName" as "leadName",
              1 - (dc.embedding <=> $1::vector) as score
       FROM document_chunks dc
       JOIN lead_documents ld ON ld.id = dc."documentId"
       JOIN leads l ON l.id = dc."leadId"
       WHERE dc.embedding IS NOT NULL
       ORDER BY dc.embedding <=> $1::vector
       LIMIT $2`,
      [JSON.stringify(queryEmbedding), limit]
    );

    return rows as DocumentChunkResult[];
  } catch (err) {
    console.error("[searchDocumentChunks] Error:", err);
    return [];
  }
}

// ─── Priority Score Computation ───────────────────────────────────────────────

export async function computePriorityScore(leadId: number): Promise<number> {
  const pool = await getRawPool();
  if (!pool) return 0;

  const { rows: leadRows } = await pool.query(
    'SELECT status, priority, "estimatedValue", "lastContactedAt", "nextFollowUpAt" FROM leads WHERE id = $1',
    [leadId]
  );
  const lead = leadRows[0];
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

  const { rows: cmRows } = await pool.query(
    'SELECT COUNT(*) as cnt FROM contact_moments WHERE "leadId" = $1',
    [leadId]
  );
  const cmCount = cmRows[0]?.cnt ?? 0;
  score += Math.min(Number(cmCount) * 3, 15);

  const { rows: docRows } = await pool.query(
    'SELECT COUNT(*) as cnt FROM lead_documents WHERE "leadId" = $1',
    [leadId]
  );
  const docCount = docRows[0]?.cnt ?? 0;
  score += Math.min(Number(docCount) * 5, 10);

  if (lead.estimatedValue && lead.estimatedValue > 0) score += 5;

  if (lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date()) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

export async function updateAllPriorityScores(): Promise<void> {
  const pool = await getRawPool();
  if (!pool) return;
  const { rows } = await pool.query("SELECT id FROM leads");
  for (const row of rows) {
    const score = await computePriorityScore(row.id);
    await pool.query('UPDATE leads SET "priorityScore" = $1 WHERE id = $2', [score, row.id]);
  }
  console.log(`[PriorityScore] Updated ${rows.length} leads`);
}
