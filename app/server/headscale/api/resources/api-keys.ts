import type { Key } from "~/types";

import type { Capabilities } from "../capabilities";
import type { Transport } from "../transport";

export interface ApiKeyApi {
  list(): Promise<Key[]>;
  create(expiration: Date): Promise<{ apiKey: string }>;
  expire(idOrPrefix: { id?: string; prefix?: string }): Promise<void>;
  delete(prefix: string, id?: string): Promise<void>;
}

export function makeApiKeyApi(
  transport: Transport,
  _capabilities: Capabilities,
  apiKey: string,
): ApiKeyApi {
  return {
    list: async () => {
      const { apiKeys } = await transport.request<{ apiKeys: Key[] }>({
        method: "GET",
        path: "v1/apikey",
        apiKey,
      });
      return apiKeys;
    },
    create: async (expiration: Date) => {
      const { apiKey: newKey } = await transport.request<{ apiKey: string }>({
        method: "POST",
        path: "v1/apikey",
        apiKey,
        body: { expiration: expiration.toISOString() },
      });
      return { apiKey: newKey };
    },
    expire: async (idOrPrefix: { id?: string; prefix?: string }) => {
      await transport.request({
        method: "POST",
        path: "v1/apikey/expire",
        apiKey,
        body: idOrPrefix,
      });
    },
    delete: async (prefix: string, id?: string) => {
      const queryParams = id ? `?id=${encodeURIComponent(id)}` : "";
      await transport.request({
        method: "DELETE",
        path: `v1/apikey/${encodeURIComponent(prefix)}${queryParams}`,
        apiKey,
      });
    },
  };
}
