import { describe, expect, test, vi } from "vitest";

import { loader } from "~/layout/app";
import {
  appConfigContext,
  authContext,
  headscaleConfigContext,
  headscaleContext,
  headscaleLiveStoreContext,
  requestApiContext,
} from "~/server/context";

describe("app layout loader", () => {
  test("exposes the configured avatar for a local password administrator", async () => {
    const principal = {
      kind: "password" as const,
      sessionId: "session-id",
      token: "local-admin-token",
      username: "admin",
    };
    const auth = {
      can: vi.fn().mockReturnValue(true),
      destroySession: vi.fn(),
    };
    const context = {
      get: (key: unknown) => {
        if (key === appConfigContext) {
          return {
            debug: false,
            headscale: { url: "http://headscale.test" },
            user: { avatar: "/avatars/admin.png" },
          };
        }
        if (key === authContext) return auth;
        if (key === requestApiContext) {
          return vi.fn().mockResolvedValue({
            api: { apiKeys: { list: vi.fn().mockResolvedValue([]) } },
            principal,
          });
        }
        if (key === headscaleContext) return { health: vi.fn().mockResolvedValue(false) };
        if (key === headscaleConfigContext) return { readable: vi.fn().mockReturnValue(true) };
        if (key === headscaleLiveStoreContext) return {};
        return undefined;
      },
    };

    const result = await loader({
      context,
      params: {},
      request: new Request("http://headplane.test/admin/machines"),
    } as never);

    expect(result).toMatchObject({
      user: {
        name: "admin",
        picture: "/avatars/admin.png",
        subject: "password",
        username: "admin",
      },
    });
  });
});
