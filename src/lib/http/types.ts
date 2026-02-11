export interface AuthSnapshot {
  apiBase: string;
  managementKey: string;
  rememberPassword: boolean;
}

export interface UsageDetail {
  timestamp: string;
  failed: boolean;
  source: string;
  auth_index: string;
  tokens: {
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens: number;
    cached_tokens: number;
    total_tokens: number;
  };
}

export interface UsageData {
  apis: Record<
    string,
    {
      models: Record<
        string,
        {
          details: UsageDetail[];
        }
      >;
    }
  >;
}

export interface ProviderModel {
  name?: string;
  alias?: string;
}

export interface ProviderApiKeyEntry {
  apiKey: string;
}

export interface OpenAIProvider {
  name: string;
  headers?: Record<string, string>;
  models?: ProviderModel[];
  apiKeyEntries?: ProviderApiKeyEntry[];
}

export interface ProviderSimpleConfig {
  apiKey: string;
  prefix?: string;
  models?: ProviderModel[];
}
