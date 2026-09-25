import { describe, expect, test, vi } from "vitest";

import { headscaleContext } from "~/server/context";

function mockRequest(url: string): Request {
  return new Request(url);
}

function createMockContext({
  headscale,
}: {
  headscale: { updateCheck: ReturnType<typeof vi.fn> };
}) {
  return {
    get: (context: typeof headscaleContext) => {
      if (context === headscaleContext) return headscale;
      return undefined;
    },
  };
}

describe("update-check route", () => {
  test("forwards all query parameters to headscale.updateCheck", async () => {
    const mockUpdateCheck = vi.fn().mockResolvedValue({
      current: { version: "v0.29.6", commit: "abc1234", buildTime: "", dirty: false },
      updateAvailable: true,
      remote: {
        commit: "def5678",
        url: "https://github.com/arsydoni4326-alt/headscale",
      },
    });

    const { loader } = await import("~/routes/util/update-check");

    const response = await loader({
      request: mockRequest(
        "https://headplane.example.com/admin/api/update-check?check=true&foo=bar",
      ),
      context: createMockContext({ headscale: { updateCheck: mockUpdateCheck } }),
      params: {},
    } as any);

    expect(mockUpdateCheck).toHaveBeenCalledWith({ check: "true", foo: "bar" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const body = await response.json();
    expect(body.updateAvailable).toBe(true);
    expect(body.remote.commit).toBe("def5678");
  });

  test("calls updateCheck with an empty query when no parameters are present", async () => {
    const mockUpdateCheck = vi.fn().mockResolvedValue({
      current: { version: "v0.29.6", commit: "abc1234", buildTime: "", dirty: false },
    });

    const { loader } = await import("~/routes/util/update-check");

    const response = await loader({
      request: mockRequest("https://headplane.example.com/admin/api/update-check"),
      context: createMockContext({ headscale: { updateCheck: mockUpdateCheck } }),
      params: {},
    } as any);

    expect(mockUpdateCheck).toHaveBeenCalledWith({});
    expect(response.status).toBe(200);
  });
});
