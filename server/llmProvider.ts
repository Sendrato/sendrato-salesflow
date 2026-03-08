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
import { createMistral } from "@ai-sdk/mistral";
import type { EmbeddingModel, LanguageModel } from "ai";
import { ENV } from "./_core/env";
import { getAllLLMSettings, getSetting, SETTING_KEYS } from "./settingsDb";

export interface LLMProvider {
  /** Ready-to-use chat model */
  model: LanguageModel;
  /** Ready-to-use enrichment model */
  enrichModel: LanguageModel;
  /** Model ID string for chat */
  chatModelId: string;
  /** Model ID string for enrichment */
  enrichModelId: string;
  /** Which provider is active (for logging/display) */
  providerName: string;
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
      providerName: "forge",
    };
  }

  // Custom provider configured — use the correct SDK
  const chatModelId = settings.chatModel || defaultChatModel(settings.provider);
  const enrichModelId = settings.enrichModel || defaultEnrichModel(settings.provider);

  switch (settings.provider) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: settings.apiKey });
      return {
        model: anthropic.languageModel(chatModelId),
        enrichModel: anthropic.languageModel(enrichModelId),
        chatModelId,
        enrichModelId,
        providerName: "anthropic",
      };
    }

    case "google": {
      const google = createGoogleGenerativeAI({ apiKey: settings.apiKey });
      return {
        model: google(chatModelId),
        enrichModel: google(enrichModelId),
        chatModelId,
        enrichModelId,
        providerName: "google",
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
        providerName: settings.provider || "openai",
      };
    }
  }
}

/**
 * Returns a ready-to-use Mistral embedding model.
 * Uses the embedding API key from Settings.
 */
export async function getEmbeddingModel(): Promise<EmbeddingModel> {
  const apiKey = await getSetting(SETTING_KEYS.EMBEDDING_API_KEY);

  if (!apiKey) {
    throw new Error(
      "No embedding API key configured. Go to Settings and add your Mistral API key for embeddings."
    );
  }

  const mistral = createMistral({ apiKey });
  return mistral.textEmbeddingModel("mistral-embed");
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
