import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getAllLLMSettings, getSetting, setSetting, SETTING_KEYS } from "../settingsDb";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { ENV } from "../_core/env";

export const settingsRouter = router({
  getLLMConfig: protectedProcedure.query(async () => {
    const settings = await getAllLLMSettings();
    // Mask the API key — return only whether one is set
    return {
      provider: settings.provider,
      chatModel: settings.chatModel,
      enrichModel: settings.enrichModel,
      hasApiKey: settings.apiKey.length > 0,
      baseUrl: settings.baseUrl,
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
      })
    )
    .mutation(async ({ input }) => {
      const updates: Promise<void>[] = [];
      if (input.provider !== undefined) updates.push(setSetting(SETTING_KEYS.LLM_PROVIDER, input.provider));
      if (input.chatModel !== undefined) updates.push(setSetting(SETTING_KEYS.LLM_CHAT_MODEL, input.chatModel));
      if (input.enrichModel !== undefined) updates.push(setSetting(SETTING_KEYS.LLM_ENRICH_MODEL, input.enrichModel));
      if (input.apiKey !== undefined && input.apiKey.length > 0) updates.push(setSetting(SETTING_KEYS.LLM_API_KEY, input.apiKey));
      if (input.baseUrl !== undefined) updates.push(setSetting(SETTING_KEYS.LLM_BASE_URL, input.baseUrl));
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
        // Determine API key and base URL
        const apiKey = input.apiKey && input.apiKey.length > 0
          ? input.apiKey
          : await getSetting(SETTING_KEYS.LLM_API_KEY) ?? ENV.forgeApiKey;

        let baseUrl: string;
        if (input.baseUrl && input.baseUrl.length > 0) {
          baseUrl = input.baseUrl;
        } else if (input.provider === "forge" || (!input.baseUrl && !input.apiKey)) {
          baseUrl = `${ENV.forgeApiUrl}/v1`;
        } else if (input.provider === "anthropic") {
          baseUrl = "https://api.anthropic.com/v1";
        } else if (input.provider === "google") {
          baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
        } else {
          baseUrl = "https://api.openai.com/v1";
        }

        const openai = createOpenAI({ apiKey, baseURL: baseUrl });
        const result = await generateText({
          model: openai.chat(input.model),
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
});
