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
  // IMAP email polling
  IMAP_ENABLED: "imap.enabled",
  IMAP_HOST: "imap.host",
  IMAP_PORT: "imap.port",
  IMAP_SECURE: "imap.secure",
  IMAP_USER: "imap.user",
  IMAP_PASSWORD: "imap.password",        // obfuscated
  IMAP_POLL_INTERVAL: "imap.pollInterval",
  IMAP_FOLDER: "imap.folder",
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
  // Deobfuscate secrets
  if (key === SETTING_KEYS.LLM_API_KEY || key === SETTING_KEYS.IMAP_PASSWORD) return deobfuscate(rows[0].value);
  return rows[0].value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const stored = (key === SETTING_KEYS.LLM_API_KEY || key === SETTING_KEYS.IMAP_PASSWORD) ? obfuscate(value) : value;
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

export async function getAllImapSettings(): Promise<{
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  pollInterval: number;
  folder: string;
}> {
  const [enabled, host, port, secure, user, password, pollInterval, folder] = await Promise.all([
    getSetting(SETTING_KEYS.IMAP_ENABLED),
    getSetting(SETTING_KEYS.IMAP_HOST),
    getSetting(SETTING_KEYS.IMAP_PORT),
    getSetting(SETTING_KEYS.IMAP_SECURE),
    getSetting(SETTING_KEYS.IMAP_USER),
    getSetting(SETTING_KEYS.IMAP_PASSWORD),
    getSetting(SETTING_KEYS.IMAP_POLL_INTERVAL),
    getSetting(SETTING_KEYS.IMAP_FOLDER),
  ]);
  return {
    enabled: enabled === "true",
    host: host ?? "",
    port: parseInt(port ?? "993", 10),
    secure: secure !== "false",
    user: user ?? "",
    password: password ?? "",
    pollInterval: parseInt(pollInterval ?? "5", 10),
    folder: folder ?? "INBOX",
  };
}
