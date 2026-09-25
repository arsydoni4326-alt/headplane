// MARK: Headscale updateCheck
//
// These tests exercise the `updateCheck` method on the Headscale client,
// which backs Headplane's `/admin/api/update-check` proxy route. They use
// a Node http server to stand in for Headscale so we control the
// `/api/v1/update-check` response and can assert the forwarded URL.

import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

import { afterEach, describe, expect, test } from "vitest";

import { createHeadscale } from "~/server/headscale/api";

let servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.map(
      (s) =>
        new Promise<void>((resolve) => {
          s.close(() => resolve());
        }),
    ),
  );
  servers = [];
});

function startServer(handler: (req: Request) => Response): Promise<{
  url: string;
  updateCheckRequests: Request[];
}> {
  const updateCheckRequests: Request[] = [];
  const server = createServer((req, res) => {
    const fullUrl = `http://${req.headers.host}${req.url}`;
    const request = new Request(fullUrl, { method: req.method });
    if (new URL(fullUrl).pathname.startsWith("/api/v1/update-check")) {
      updateCheckRequests.push(request);
    }
    const response = handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    response.text().then((body) => res.end(body));
  });
  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        updateCheckRequests,
      });
    });
  });
}

describe("Headscale updateCheck", () => {
  test("forwards query parameters to /api/v1/update-check", async () => {
    const { url, updateCheckRequests } = await startServer((req) => {
      if (new URL(req.url ?? "/").pathname === "/version") {
        return Response.json({
          version: "v0.28.0",
          commit: "abc",
          buildTime: "",
          go: "",
          dirty: false,
        });
      }
      return Response.json({
        current: { version: "v0.29.6", commit: "abc1234", buildTime: "", dirty: false },
        updateAvailable: true,
        remote: {
          commit: "def5678",
          url: "https://github.com/arsydoni4326-alt/headscale",
        },
      });
    });

    const headscale = await createHeadscale({ url });
    const result = await headscale.updateCheck({ check: "true" });

    expect(updateCheckRequests).toHaveLength(1);
    const requestUrl = new URL(updateCheckRequests[0].url);
    expect(requestUrl.pathname).toBe("/api/v1/update-check");
    expect(requestUrl.search).toBe("?check=true");
    expect(result.updateAvailable).toBe(true);
    expect(result.remote?.commit).toBe("def5678");

    await headscale.dispose();
  });

  test("calls without a query string when no query is provided", async () => {
    const { url, updateCheckRequests } = await startServer((req) => {
      if (new URL(req.url ?? "/").pathname === "/version") {
        return Response.json({
          version: "v0.28.0",
          commit: "abc",
          buildTime: "",
          go: "",
          dirty: false,
        });
      }
      return Response.json({
        current: { version: "v0.29.6", commit: "abc1234", buildTime: "", dirty: false },
      });
    });

    const headscale = await createHeadscale({ url });
    const result = await headscale.updateCheck();

    expect(updateCheckRequests).toHaveLength(1);
    const requestUrl = new URL(updateCheckRequests[0].url);
    expect(requestUrl.pathname).toBe("/api/v1/update-check");
    expect(requestUrl.search).toBe("");
    expect(result.updateAvailable).toBeUndefined();

    await headscale.dispose();
  });
});
