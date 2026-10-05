import { describe, expect, test, vi } from "vitest";

import { routesAction } from "~/routes/routes/routes-actions";
import {
  auditContext,
  authContext,
  headscaleLiveStoreContext,
  requestApiContext,
} from "~/server/context";
import type { Principal } from "~/server/web/auth";

function updateRoutesRequest() {
  const form = new FormData();
  form.set("action_id", "update_routes");
  form.set("node_id", "35");
  form.set("routes", "10.55.0.0/24");
  form.set("enabled", "true");

  return new Request("http://headplane.test/routes", { method: "POST", body: form });
}

function createContext({
  approveRoutes,
  refresh,
  record,
  principal,
}: {
  approveRoutes: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
  record: ReturnType<typeof vi.fn>;
  principal: Principal;
}) {
  const node = { id: "35", givenName: "router", approvedRoutes: [] };

  return {
    get: (context: unknown) => {
      if (context === auditContext) return { record };
      if (context === authContext) {
        return { can: () => true, canManageNode: () => true };
      }
      if (context === headscaleLiveStoreContext) return { refresh };
      if (context === requestApiContext) {
        return async () => ({
          principal,
          api: { nodes: { approveRoutes, get: async () => node } },
        });
      }
      return undefined;
    },
  };
}

describe("routes action", () => {
  test("records route updates from password-authenticated users", async () => {
    const approveRoutes = vi.fn().mockResolvedValue(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const record = vi.fn().mockResolvedValue(undefined);
    const principal: Principal = {
      kind: "password",
      sessionId: "test-session",
      token: "test-token",
      username: "admin",
    };

    const result = await routesAction({
      request: updateRoutesRequest(),
      context: createContext({ approveRoutes, refresh, record, principal }),
      params: {},
    } as never);

    expect(result).toEqual({ message: "Routes updated" });
    expect(approveRoutes).toHaveBeenCalledWith("35", ["10.55.0.0/24"]);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: null, actorName: "admin", action: "machine.routes" }),
    );
  });

  test("propagates a Headscale route-update failure", async () => {
    const approveRoutes = vi.fn().mockRejectedValue(new Error("Headscale route update failed"));
    const refresh = vi.fn();
    const record = vi.fn();
    const principal: Principal = {
      kind: "api_key",
      sessionId: "test-session",
      displayName: "test-key",
      apiKey: "test-key",
    };

    await expect(
      routesAction({
        request: updateRoutesRequest(),
        context: createContext({ approveRoutes, refresh, record, principal }),
        params: {},
      } as never),
    ).rejects.toThrow("Headscale route update failed");

    expect(refresh).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});
