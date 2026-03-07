/**
 * llmProvider.ts
 *
 * Centralised LLM provider factory.
 * Reads the app_settings table at runtime to determine which provider/model/key to use.
 * Falls back to the Manus Forge API if no custom key is configured.
 *
 * Usage:
 *   const { provider, chatModel, enrichModel } = await getLLMProvider();
 *   const result = await streamText({ model: provider.chat(chatModel), ... });
 */

import { createOpenAI } from "@ai-sdk/openai";
import { ENV } from "./_core/env";
import { getAllLLMSettings } from "./settingsDb";

export interface LLMProvider {
  /** AI SDK LanguageModelV1 factory — call .chat(modelId) to get a model */
  provider: ReturnType<typeof createOpenAI>;
  /** Model to use for AI chat conversations */
  chatModel: string;
  /** Model to use for lead enrichment */
  enrichModel: string;
  /** Which provider is active (for logging/display) */
  providerName: string;
}

/**
 * Returns the configured LLM provider and model names.
 * Always reads from DB so config changes take effect without restart.
 */
export async function getLLMProvider(): Promise<LLMProvider> {
  const settings = await getAllLLMSettings();

  // If no custom API key is set, use the Manus Forge API
  if (!settings.apiKey) {
    const forgeProvider = createOpenAI({
      apiKey: ENV.forgeApiKey,
      baseURL: `${ENV.forgeApiUrl}/v1`,
    });
    return {
      provider: forgeProvider,
      chatModel: settings.chatModel || "gemini-2.5-flash",
      enrichModel: settings.enrichModel || "claude-sonnet-4-5",
      providerName: "forge",
    };
  }

  // Custom provider configured
  let baseURL: string;
  if (settings.baseUrl) {
    // User-specified base URL (custom endpoint, Ollama, Groq, etc.)
    baseURL = settings.baseUrl;
  } else {
    // Derive base URL from provider name
    switch (settings.provider) {
      case "anthropic":
        baseURL = "https://api.anthropic.com/v1";
        break;
      case "google":
        // Google Gemini via OpenAI-compatible endpoint
        baseURL = "https://generativelanguage.googleapis.com/v1beta/openai";
        break;
      case "openai":
      default:
        baseURL = "https://api.openai.com/v1";
        break;
    }
  }

  const customProvider = createOpenAI({
    apiKey: settings.apiKey,
    baseURL,
  });

  return {
    provider: customProvider,
    chatModel: settings.chatModel || defaultChatModel(settings.provider),
    enrichModel: settings.enrichModel || defaultEnrichModel(settings.provider),
    providerName: settings.provider,
  };
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
