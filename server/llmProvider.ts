/**
 * llmProvider.ts
 *
 * Centralised LLM provider factory.
 * Reads the app_settings table at runtime to determine which provider/model/key to use.
 * Uses the correct AI SDK provider package for each backend (Anthropic, Google, OpenAI).
 *
 * Usage:
 *   const { model, enrichModel } = await getLLMProvider();
 *   const result = await streamText({ model, ... });
 */

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { ENV } from "./_core/env";
import { getAllLLMSettings } from "./settingsDb";

export interface LLMProvider {
  /** Ready-to-use chat model */
  model: LanguageModel;
  /** Ready-to-use enrichment model */
  enrichModel: LanguageModel;
  /** Model ID string for chat */
  chatModelId: string;
  /** Model ID string for enrichment */
  enrichModelId: string;
  /** Embedding model ID */
  embeddingModel: string;
  /** Which provider is active (for logging/display) */
  providerName: string;
  /** Legacy: OpenAI-compatible provider factory (for embeddings) */
  provider: ReturnType<typeof createOpenAI>;
}

/**
 * Returns the configured LLM provider and models.
 * Always reads from DB so config changes take effect without restart.
 */
export async function getLLMProvider(): Promise<LLMProvider> {
  const settings = await getAllLLMSettings();

  // If no custom API key is set, use the built-in Forge API (OpenAI-compatible)
  if (!settings.apiKey) {
    if (!ENV.forgeApiUrl) {
      throw new Error(
        "No LLM provider configured. Go to Settings → AI Provider to add your API key."
      );
    }
    const forgeProvider = createOpenAI({
      apiKey: ENV.forgeApiKey,
      baseURL: `${ENV.forgeApiUrl}/v1`,
    });
    const chatModelId = settings.chatModel || "gemini-2.5-flash";
    const enrichModelId = settings.enrichModel || "claude-sonnet-4-5";
    return {
      model: forgeProvider.chat(chatModelId),
      enrichModel: forgeProvider.chat(enrichModelId),
      chatModelId,
      enrichModelId,
      embeddingModel: "text-embedding-3-small",
      providerName: "forge",
      provider: forgeProvider,
    };
  }

  // Custom provider configured — use the correct SDK
  const chatModelId = settings.chatModel || defaultChatModel(settings.provider);
  const enrichModelId = settings.enrichModel || defaultEnrichModel(settings.provider);

  switch (settings.provider) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: settings.apiKey });
      // For embeddings we still need an OpenAI-compatible provider
      const openaiForEmbeddings = createOpenAI({
        apiKey: ENV.forgeApiKey || "dummy",
        baseURL: ENV.forgeApiUrl ? `${ENV.forgeApiUrl}/v1` : "https://api.openai.com/v1",
      });
      return {
        model: anthropic.languageModel(chatModelId),
        enrichModel: anthropic.languageModel(enrichModelId),
        chatModelId,
        enrichModelId,
        embeddingModel: "text-embedding-3-small",
        providerName: "anthropic",
        provider: openaiForEmbeddings,
      };
    }

    case "google": {
      const google = createGoogleGenerativeAI({ apiKey: settings.apiKey });
      const openaiForEmbeddings = createOpenAI({
        apiKey: ENV.forgeApiKey || "dummy",
        baseURL: ENV.forgeApiUrl ? `${ENV.forgeApiUrl}/v1` : "https://api.openai.com/v1",
      });
      return {
        model: google(chatModelId),
        enrichModel: google(enrichModelId),
        chatModelId,
        enrichModelId,
        embeddingModel: "text-embedding-3-small",
        providerName: "google",
        provider: openaiForEmbeddings,
      };
    }

    case "openai":
    default: {
      const baseURL = settings.baseUrl || "https://api.openai.com/v1";
      const openai = createOpenAI({ apiKey: settings.apiKey, baseURL });
      return {
        model: openai.chat(chatModelId),
        enrichModel: openai.chat(enrichModelId),
        chatModelId,
        enrichModelId,
        embeddingModel: "text-embedding-3-small",
        providerName: settings.provider || "openai",
        provider: openai,
      };
    }
  }
}

/**
 * Returns an OpenAI-compatible provider specifically for embeddings.
 * Always uses OpenAI or Forge API, since not all providers support embeddings.
 */
export async function getEmbeddingProvider(): Promise<ReturnType<typeof createOpenAI>> {
  const settings = await getAllLLMSettings();

  // If user has OpenAI as their provider with a custom key, use that
  if (settings.apiKey && settings.provider === "openai") {
    return createOpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl || "https://api.openai.com/v1",
    });
  }

  // Otherwise fall back to Forge API (OpenAI-compatible)
  if (ENV.forgeApiUrl) {
    return createOpenAI({
      apiKey: ENV.forgeApiKey,
      baseURL: `${ENV.forgeApiUrl}/v1`,
    });
  }

  throw new Error(
    "No embedding provider available. Configure an OpenAI API key in Settings, or set BUILT_IN_FORGE_API_URL."
  );
}

function defaultChatModel(provider: string): string {
  switch (provider) {
    case "anthropic": return "claude-sonnet-4-5";
    case "google": return "gemini-2.5-flash";
    case "openai": return "gpt-4o";
    default: return "gpt-4o";
  }
}

function defaultEnrichModel(provider: string): string {
  switch (provider) {
    case "anthropic": return "claude-sonnet-4-5";
    case "google": return "gemini-2.5-flash";
    case "openai": return "gpt-4o";
    default: return "gpt-4o";
  }
}
