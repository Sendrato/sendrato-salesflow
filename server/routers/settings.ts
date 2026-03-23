import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getAllLLMSettings,
  getAllImapSettings,
  getSetting,
  setSetting,
  SETTING_KEYS,
} from "../settingsDb";
import { ImapFlow } from "imapflow";
import { restartImapPolling, pollOnce } from "../imapPoller";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { ENV } from "../_core/env";

export const settingsRouter = router({
  getLLMConfig: protectedProcedure.query(async () => {
    const settings = await getAllLLMSettings();
    const embeddingApiKey = await getSetting(SETTING_KEYS.EMBEDDING_API_KEY);
    const tavilyApiKey = await getSetting(SETTING_KEYS.TAVILY_API_KEY);
    return {
      provider: settings.provider,
      chatModel: settings.chatModel,
      enrichModel: settings.enrichModel,
      hasApiKey: settings.apiKey.length > 0,
      baseUrl: settings.baseUrl,
      hasEmbeddingKey: (embeddingApiKey ?? "").length > 0,
      hasTavilyKey: (tavilyApiKey ?? "").length > 0,
    };
  }),

  updateLLMConfig: protectedProcedure
    .input(
      z.object({
        provider: z.string().optional(),
        chatModel: z.string().optional(),
        enrichModel: z.string().optional(),
        apiKey: z.string().optional(),
        baseUrl: z.string().optional(),
        embeddingApiKey: z.string().optional(),
        tavilyApiKey: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updates: Promise<void>[] = [];
      if (input.provider !== undefined)
        updates.push(setSetting(SETTING_KEYS.LLM_PROVIDER, input.provider));
      if (input.chatModel !== undefined)
        updates.push(setSetting(SETTING_KEYS.LLM_CHAT_MODEL, input.chatModel));
      if (input.enrichModel !== undefined)
        updates.push(
          setSetting(SETTING_KEYS.LLM_ENRICH_MODEL, input.enrichModel)
        );
      if (input.apiKey !== undefined && input.apiKey.length > 0)
        updates.push(setSetting(SETTING_KEYS.LLM_API_KEY, input.apiKey));
      if (input.baseUrl !== undefined)
        updates.push(setSetting(SETTING_KEYS.LLM_BASE_URL, input.baseUrl));
      if (
        input.embeddingApiKey !== undefined &&
        input.embeddingApiKey.length > 0
      )
        updates.push(
          setSetting(SETTING_KEYS.EMBEDDING_API_KEY, input.embeddingApiKey)
        );
      if (input.tavilyApiKey !== undefined && input.tavilyApiKey.length > 0)
        updates.push(
          setSetting(SETTING_KEYS.TAVILY_API_KEY, input.tavilyApiKey)
        );
      await Promise.all(updates);
      return { success: true };
    }),

  clearApiKey: protectedProcedure.mutation(async () => {
    await setSetting(SETTING_KEYS.LLM_API_KEY, "");
    return { success: true };
  }),

  testConnection: protectedProcedure
    .input(
      z.object({
        provider: z.string(),
        model: z.string(),
        apiKey: z.string().optional(),
        baseUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Determine API key
        const apiKey =
          input.apiKey && input.apiKey.length > 0
            ? input.apiKey
            : ((await getSetting(SETTING_KEYS.LLM_API_KEY)) ?? ENV.forgeApiKey);

        if (!apiKey) {
          return { success: false, error: "No API key provided" };
        }

        // Build the correct model based on provider
        let model;
        if (input.provider === "anthropic") {
          const anthropic = createAnthropic({ apiKey });
          model = anthropic.languageModel(input.model);
        } else if (input.provider === "google") {
          const google = createGoogleGenerativeAI({ apiKey });
          model = google(input.model);
        } else if (input.provider === "forge") {
          if (!ENV.forgeApiUrl) {
            return {
              success: false,
              error: "BUILT_IN_FORGE_API_URL not configured on server",
            };
          }
          const forge = createOpenAI({
            apiKey: ENV.forgeApiKey,
            baseURL: `${ENV.forgeApiUrl}/v1`,
          });
          model = forge.chat(input.model);
        } else {
          // OpenAI or custom
          const baseUrl =
            input.baseUrl && input.baseUrl.length > 0
              ? input.baseUrl
              : "https://api.openai.com/v1";
          const openai = createOpenAI({ apiKey, baseURL: baseUrl });
          model = openai.chat(input.model);
        }

        const result = await generateText({
          model,
          messages: [{ role: "user", content: "Reply with exactly: OK" }],
          maxOutputTokens: 10,
        });

        return {
          success: true,
          response: result.text.trim(),
          model: input.model,
          provider: input.provider,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    }),

  // ── IMAP Settings ───────────────────────────────────────────────────────────

  getImapConfig: protectedProcedure.query(async () => {
    const settings = await getAllImapSettings();
    return {
      enabled: settings.enabled,
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      user: settings.user,
      hasPassword: settings.password.length > 0,
      pollInterval: settings.pollInterval,
      folder: settings.folder,
    };
  }),

  updateImapConfig: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        host: z.string().optional(),
        port: z.number().optional(),
        secure: z.boolean().optional(),
        user: z.string().optional(),
        password: z.string().optional(),
        pollInterval: z.number().optional(),
        folder: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updates: Promise<void>[] = [];
      if (input.enabled !== undefined)
        updates.push(
          setSetting(SETTING_KEYS.IMAP_ENABLED, String(input.enabled))
        );
      if (input.host !== undefined)
        updates.push(setSetting(SETTING_KEYS.IMAP_HOST, input.host));
      if (input.port !== undefined)
        updates.push(setSetting(SETTING_KEYS.IMAP_PORT, String(input.port)));
      if (input.secure !== undefined)
        updates.push(
          setSetting(SETTING_KEYS.IMAP_SECURE, String(input.secure))
        );
      if (input.user !== undefined)
        updates.push(setSetting(SETTING_KEYS.IMAP_USER, input.user));
      if (input.password !== undefined && input.password.length > 0)
        updates.push(setSetting(SETTING_KEYS.IMAP_PASSWORD, input.password));
      if (input.pollInterval !== undefined)
        updates.push(
          setSetting(
            SETTING_KEYS.IMAP_POLL_INTERVAL,
            String(input.pollInterval)
          )
        );
      if (input.folder !== undefined)
        updates.push(setSetting(SETTING_KEYS.IMAP_FOLDER, input.folder));
      await Promise.all(updates);
      // Restart polling with new settings
      await restartImapPolling();
      return { success: true };
    }),

  syncImapNow: protectedProcedure.mutation(async () => {
    try {
      const processed = await pollOnce();
      return { success: true, processed };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg, processed: 0 };
    }
  }),

  testImapConnection: protectedProcedure
    .input(
      z.object({
        host: z.string(),
        port: z.number(),
        secure: z.boolean(),
        user: z.string(),
        password: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const password =
          input.password && input.password.length > 0
            ? input.password
            : (await getAllImapSettings()).password;

        if (!password) {
          return { success: false, error: "No password provided" };
        }

        const client = new ImapFlow({
          host: input.host,
          port: input.port,
          secure: input.secure,
          auth: { user: input.user, pass: password },
          logger: false,
          tls: {
            rejectUnauthorized: false,
            servername: input.host,
            minVersion: "TLSv1" as const,
            ciphers: "DEFAULT:@SECLEVEL=0",
          },
        });

        await client.connect();
        const mailboxes = await client.list();
        const folderNames = mailboxes.map(m => m.path);
        await client.logout();

        return { success: true, folders: folderNames };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    }),
});
