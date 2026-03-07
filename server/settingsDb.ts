import { eq } from "drizzle-orm";
import { appSettings } from "../drizzle/schema";
import { getDb } from "./db";

// Keys stored in app_settings
export const SETTING_KEYS = {
  LLM_PROVIDER: "llm.provider",         // openai | anthropic | google | custom
  LLM_CHAT_MODEL: "llm.chatModel",       // e.g. gpt-4o, claude-sonnet-4-5, gemini-2.5-flash
  LLM_ENRICH_MODEL: "llm.enrichModel",   // model for enrichment (can differ from chat)
  LLM_API_KEY: "llm.apiKey",             // stored encrypted (base64 obfuscated)
  LLM_BASE_URL: "llm.baseUrl",           // for custom/self-hosted endpoints
} as const;

// Simple obfuscation — not true encryption, but avoids plain-text keys in DB
function obfuscate(value: string): string {
  return Buffer.from(value).toString("base64");
}
function deobfuscate(value: string): string {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return value;
  }
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  if (!rows.length || rows[0].value == null) return null;
  // Deobfuscate API key
  if (key === SETTING_KEYS.LLM_API_KEY) return deobfuscate(rows[0].value);
  return rows[0].value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const stored = key === SETTING_KEYS.LLM_API_KEY ? obfuscate(value) : value;
  await db
    .insert(appSettings)
    .values({ key, value: stored })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: stored, updatedAt: new Date() } });
}

export async function getAllLLMSettings(): Promise<{
  provider: string;
  chatModel: string;
  enrichModel: string;
  apiKey: string;
  baseUrl: string;
}> {
  const [provider, chatModel, enrichModel, apiKey, baseUrl] = await Promise.all([
    getSetting(SETTING_KEYS.LLM_PROVIDER),
    getSetting(SETTING_KEYS.LLM_CHAT_MODEL),
    getSetting(SETTING_KEYS.LLM_ENRICH_MODEL),
    getSetting(SETTING_KEYS.LLM_API_KEY),
    getSetting(SETTING_KEYS.LLM_BASE_URL),
  ]);
  return {
    provider: provider ?? "forge",
    chatModel: chatModel ?? "gemini-2.5-flash",
    enrichModel: enrichModel ?? "claude-sonnet-4-5",
    apiKey: apiKey ?? "",
    baseUrl: baseUrl ?? "",
  };
}
