import { beforeEach, describe, expect, test, vi } from "vitest";

import { action, loader } from "~/routes/admin/route";
import {
  auditContext,
  authContext,
  headscaleApiKeyContext,
  headscaleContext,
  localAdminContext,
} from "~/server/context";
import type { Principal } from "~/server/web/auth";

const principal: Principal = {
  kind: "password",
  sessionId: "password-session",
  token: "local-admin-token",
  username: "admin",
};

function createServices() {
  const apiKeys = {
    create: vi.fn(),
    delete: vi.fn(),
    list: vi.fn().mockResolvedValue([
      {
        id: "service-key",
        prefix: "service-********",
        expiration: null,
        createdAt: "2026-10-08T00:00:00.000Z",
      },
    ]),
  };

  return {
    apiKeys,
    audit: { record: vi.fn().mockResolvedValue(undefined) },
    auth: {
      can: vi.fn().mockReturnValue(true),
      getHeadscaleApiKey: vi.fn().mockReturnValue("service-key-secret"),
      require: vi.fn().mockResolvedValue(principal),
    },
    headscale: { client: vi.fn().mockReturnValue({ apiKeys }) },
    localAdmin: { getUsername: vi.fn().mockReturnValue("admin") },
  };
}

function createContext(services: ReturnType<typeof createServices>) {
  return {
    get(context: unknown) {
      if (context === auditContext) return services.audit;
      if (context === authContext) return services.auth;
      if (context === headscaleApiKeyContext) return "service-key-secret";
      if (context === headscaleContext) return services.headscale;
      if (context === localAdminContext) {
        return { state: "enabled" as const, value: services.localAdmin };
      }
      return undefined;
    },
  };
}

function requestWithForm(form: FormData) {
  return new Request("http://headplane.test/admin", { method: "POST", body: form });
}

describe("admin API key management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns only the configured service key prefix from the loader", async () => {
    const services = createServices();

    const result = await loader({
      request: new Request("http://headplane.test/admin"),
      context: createContext(services),
      params: {},
    } as never);

    expect(result).toMatchObject({
      configuredApiKeyPrefix: "service-",
      apiKeys: [{ id: "service-key" }],
    });
    expect(JSON.stringify(result)).not.toContain("service-key-secret");
  });

  test("blocks crafted deletion requests for the configured service key", async () => {
    const services = createServices();
    const form = new FormData();
    form.set("_action", "delete-apikey");
    form.set("prefix", "service-********");

    const result = await action({
      request: requestWithForm(form),
      context: createContext(services),
      params: {},
    } as never);

    expect(result).toEqual({ success: false, error: "Cannot delete configured service key" });
    expect(services.apiKeys.delete).not.toHaveBeenCalled();
  });
});
