import { apiClient } from "@/lib/http/client";
import type { OpenAIProvider, ProviderSimpleConfig, UsageData } from "@/lib/http/types";

const toArray = <T>(value: unknown): T[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const nested =
      record.items ??
      record["openai-compatibility"] ??
      record["gemini-api-key"] ??
      record["claude-api-key"] ??
      record["codex-api-key"] ??
      record["vertex-api-key"];

    if (Array.isArray(nested)) {
      return nested as T[];
    }
  }

  return [];
};

export const configApi = {
  getConfig: () => apiClient.get<Record<string, unknown>>("/config"),
};

export const usageApi = {
  async getUsage(): Promise<UsageData> {
    const response = await apiClient.get<Record<string, unknown>>("/usage");
    const candidate =
      response.usage && typeof response.usage === "object" ? response.usage : response;

    if (!candidate || typeof candidate !== "object") {
      return { apis: {} };
    }

    const payload = candidate as { apis?: UsageData["apis"] };

    if (!payload.apis || typeof payload.apis !== "object") {
      return { apis: {} };
    }

    return {
      apis: payload.apis,
    };
  },
};

export const providersApi = {
  async getOpenAIProviders(): Promise<OpenAIProvider[]> {
    const response = await apiClient.get<unknown>("/openai-compatibility");
    return toArray<OpenAIProvider>(response);
  },

  async getGeminiKeys(): Promise<ProviderSimpleConfig[]> {
    const response = await apiClient.get<unknown>("/gemini-api-key");
    return toArray<ProviderSimpleConfig>(response);
  },

  async getClaudeConfigs(): Promise<ProviderSimpleConfig[]> {
    const response = await apiClient.get<unknown>("/claude-api-key");
    return toArray<ProviderSimpleConfig>(response);
  },

  async getCodexConfigs(): Promise<ProviderSimpleConfig[]> {
    const response = await apiClient.get<unknown>("/codex-api-key");
    return toArray<ProviderSimpleConfig>(response);
  },

  async getVertexConfigs(): Promise<ProviderSimpleConfig[]> {
    const response = await apiClient.get<unknown>("/vertex-api-key");
    return toArray<ProviderSimpleConfig>(response);
  },
};
