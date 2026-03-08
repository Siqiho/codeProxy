import { apiClient } from "@/lib/http/client";
import type { UsageData } from "@/lib/http/types";

export interface UsageExportPayload {
  version?: number;
  exported_at?: string;
  usage?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UsageImportResponse {
  added?: number;
  skipped?: number;
  total_requests?: number;
  failed_requests?: number;
  [key: string]: unknown;
}

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

  exportUsage(): Promise<UsageExportPayload> {
    return apiClient.get<UsageExportPayload>("/usage/export");
  },

  importUsage(payload: unknown): Promise<UsageImportResponse> {
    return apiClient.post<UsageImportResponse>("/usage/import", payload);
  },

  getDashboardSummary(days = 7): Promise<DashboardSummary> {
    return apiClient.get<DashboardSummary>(`/dashboard-summary?days=${days}`);
  },
};

export interface DashboardSummary {
  kpi: {
    total_requests: number;
    success_requests: number;
    failed_requests: number;
    success_rate: number;
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens: number;
    cached_tokens: number;
    total_tokens: number;
  };
  counts: {
    api_keys: number;
    providers_total: number;
    gemini_keys: number;
    claude_keys: number;
    codex_keys: number;
    vertex_keys: number;
    openai_providers: number;
    auth_files: number;
  };
  days: number;
}
