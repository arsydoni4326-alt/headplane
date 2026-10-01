import { describe, expect, test, vi } from "vitest";

import { authContext, requestApiContext } from "~/server/context";

describe("live event loader", () => {
  test("clears an invalid session cookie instead of throwing", async () => {
    const { loader } = await import("~/routes/util/live");
    const request = new Request("http://headplane.test/admin/events/live", {
      headers: { cookie: "_hp_auth=" },
    });
    const destroySession = vi.fn().mockResolvedValue("_hp_auth=; Max-Age=0");
    const require = vi.fn().mockRejectedValue(new Error("Session cookie is empty"));
    const getRequestApi = vi.fn();
    const context = {
      get: (key: unknown) => {
        if (key === authContext) return { destroySession, require };
        if (key === requestApiContext) return getRequestApi;
        return undefined;
      },
    };

    const response = await loader({ request, context, params: {} } as never);

    expect(response.status).toBe(401);
    expect(response.headers.get("Set-Cookie")).toBe("_hp_auth=; Max-Age=0");
    expect(destroySession).toHaveBeenCalledWith(request);
    expect(getRequestApi).not.toHaveBeenCalled();
  });
});
