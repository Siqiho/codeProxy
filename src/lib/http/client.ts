import { REQUEST_TIMEOUT_MS, VERSION_HEADER_KEYS, BUILD_DATE_HEADER_KEYS } from "@/lib/constants";
import { computeManagementApiBase } from "@/lib/connection";

interface ApiClientConfig {
  apiBase: string;
  managementKey: string;
}

export class ApiClient {
  private apiBase = "";

  private managementKey = "";

  setConfig(config: ApiClientConfig): void {
    this.apiBase = computeManagementApiBase(config.apiBase);
    this.managementKey = config.managementKey.trim();
  }

  private readHeader(headers: Headers, keys: string[]): string | null {
    for (const key of keys) {
      const value = headers.get(key);
      if (value?.trim()) {
        return value;
      }
    }
    return null;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.apiBase}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(this.managementKey
            ? {
                Authorization: `Bearer ${this.managementKey}`,
              }
            : {}),
          ...init?.headers,
        },
      });

      if (response.status === 401) {
        window.dispatchEvent(new Event("unauthorized"));
      }

      const version = this.readHeader(response.headers, VERSION_HEADER_KEYS);
      const buildDate = this.readHeader(response.headers, BUILD_DATE_HEADER_KEYS);

      if (version || buildDate) {
        window.dispatchEvent(
          new CustomEvent("server-version-update", {
            detail: { version, buildDate },
          }),
        );
      }

      if (!response.ok) {
        let message = `请求失败（${response.status}）`;
        try {
          const errorPayload = (await response.json()) as Record<string, unknown>;
          const errorText =
            typeof errorPayload.error === "string"
              ? errorPayload.error
              : typeof errorPayload.message === "string"
                ? errorPayload.message
                : null;
          if (errorText) {
            message = errorText;
          }
        } catch {
          // 忽略错误体解析失败
        }
        throw new Error(message);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
}

export const apiClient = new ApiClient();
