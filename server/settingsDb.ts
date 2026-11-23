import { eq } from "drizzle-orm";
import { appSettings } from "../drizzle/schema";
import { getDb } from "./db";

// Keys stored in app_settings
export const SETTING_KEYS = {
  LLM_PROVIDER: "llm.provider", // openai | anthropic | google | custom
  LLM_CHAT_MODEL: "llm.chatModel", // e.g. gpt-4o, claude-sonnet-4-5, gemini-2.5-flash
  LLM_ENRICH_MODEL: "llm.enrichModel", // model for enrichment (can differ from chat)
  LLM_API_KEY: "llm.apiKey", // stored encrypted (base64 obfuscated)
  LLM_BASE_URL: "llm.baseUrl", // for custom/self-hosted endpoints
  // Embedding (Mistral)
  EMBEDDING_API_KEY: "embedding.apiKey", // Mistral API key for embeddings
  // Web search (Tavily)
  TAVILY_API_KEY: "tavily.apiKey",
  // IMAP email polling
  IMAP_ENABLED: "imap.enabled",
  IMAP_HOST: "imap.host",
  IMAP_PORT: "imap.port",
  IMAP_SECURE: "imap.secure",
  IMAP_USER: "imap.user",
  IMAP_PASSWORD: "imap.password", // obfuscated
  IMAP_POLL_INTERVAL: "imap.pollInterval",
  IMAP_FOLDER: "imap.folder",
  // Outgoing mail (SMTP) — used for website request notifications
  SMTP_HOST: "smtp.host",
  SMTP_PORT: "smtp.port",
  SMTP_SECURE: "smtp.secure",
  SMTP_USER: "smtp.user",
  SMTP_PASSWORD: "smtp.password", // obfuscated
  SMTP_FROM: "smtp.from",
  // Website request endpoint
  WEBSITE_API_TOKEN: "website.apiToken", // obfuscated
  WEBSITE_NOTIFY_EMAIL: "website.notifyEmail",
} as const;

/** Setting keys whose stored value is obfuscated at rest. */
const SECRET_KEYS: string[] = [
  SETTING_KEYS.LLM_API_KEY,
  SETTING_KEYS.IMAP_PASSWORD,
  SETTING_KEYS.EMBEDDING_API_KEY,
  SETTING_KEYS.TAVILY_API_KEY,
  SETTING_KEYS.SMTP_PASSWORD,
  SETTING_KEYS.WEBSITE_API_TOKEN,
];

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
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  if (!rows.length || rows[0].value == null) return null;
  // Deobfuscate secrets
  if (SECRET_KEYS.includes(key)) return deobfuscate(rows[0].value);
  return rows[0].value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const stored = SECRET_KEYS.includes(key) ? obfuscate(value) : value;
  await db
    .insert(appSettings)
    .values({ key, value: stored })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: stored, updatedAt: new Date() },
    });
}

export async function getAllLLMSettings(): Promise<{
  provider: string;
  chatModel: string;
  enrichModel: string;
  apiKey: string;
  baseUrl: string;
}> {
  const [provider, chatModel, enrichModel, apiKey, baseUrl] = await Promise.all(
    [
      getSetting(SETTING_KEYS.LLM_PROVIDER),
      getSetting(SETTING_KEYS.LLM_CHAT_MODEL),
      getSetting(SETTING_KEYS.LLM_ENRICH_MODEL),
      getSetting(SETTING_KEYS.LLM_API_KEY),
      getSetting(SETTING_KEYS.LLM_BASE_URL),
    ]
  );
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
  const [enabled, host, port, secure, user, password, pollInterval, folder] =
    await Promise.all([
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

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

/**
 * Outgoing mail configuration. DB settings win; env vars act as the fallback
 * so a fresh deployment can send mail before anyone opens the settings page.
 */
export async function getAllSmtpSettings(): Promise<SmtpSettings> {
  const [host, port, secure, user, password, from] = await Promise.all([
    getSetting(SETTING_KEYS.SMTP_HOST),
    getSetting(SETTING_KEYS.SMTP_PORT),
    getSetting(SETTING_KEYS.SMTP_SECURE),
    getSetting(SETTING_KEYS.SMTP_USER),
    getSetting(SETTING_KEYS.SMTP_PASSWORD),
    getSetting(SETTING_KEYS.SMTP_FROM),
  ]);
  const resolvedHost = host || process.env.SMTP_HOST || "";
  const resolvedPort = parseInt(port || process.env.SMTP_PORT || "587", 10);
  const resolvedSecure =
    secure != null && secure !== ""
      ? secure === "true"
      : process.env.SMTP_SECURE != null
        ? process.env.SMTP_SECURE === "true"
        : resolvedPort === 465;
  const resolvedUser = user || process.env.SMTP_USER || "";
  return {
    host: resolvedHost,
    port: Number.isFinite(resolvedPort) ? resolvedPort : 587,
    secure: resolvedSecure,
    user: resolvedUser,
    password: password || process.env.SMTP_PASSWORD || "",
    from: from || process.env.SMTP_FROM || resolvedUser,
  };
}

export const DEFAULT_WEBSITE_NOTIFY_EMAIL = "info@sendrato.com";

export type WebsiteApiSettings = {
  apiToken: string;
  notifyEmail: string;
};

/**
 * Website request endpoint configuration. The bearer token may come from the
 * DB (rotatable from the settings page) or from the WEBSITE_API_TOKEN env var.
 */
export async function getWebsiteApiSettings(): Promise<WebsiteApiSettings> {
  const [apiToken, notifyEmail] = await Promise.all([
    getSetting(SETTING_KEYS.WEBSITE_API_TOKEN),
    getSetting(SETTING_KEYS.WEBSITE_NOTIFY_EMAIL),
  ]);
  return {
    apiToken: apiToken || process.env.WEBSITE_API_TOKEN || "",
    notifyEmail:
      notifyEmail ||
      process.env.WEBSITE_NOTIFY_EMAIL ||
      DEFAULT_WEBSITE_NOTIFY_EMAIL,
  };
}
