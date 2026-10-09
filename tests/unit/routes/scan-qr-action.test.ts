import { RouterContextProvider } from "react-router";
import { describe, expect, test, vi } from "vitest";

import { action, loader } from "~/routes/machines/scan-qr";
import {
  auditContext,
  authContext,
  headscaleLiveStoreContext,
  requestApiContext,
} from "~/server/context";
import { nodesResource, usersResource } from "~/server/headscale/live-store";
import type { Principal } from "~/server/web/auth";
import { Capabilities } from "~/server/web/roles";

const principal: Principal = {
  kind: "api_key",
  sessionId: "test-session",
  displayName: "test-key",
  apiKey: "test-key",
};

function qrPayload() {
  return JSON.stringify({
    type: "headscale-registration",
    version: "1",
    auth_id: "hskey-authreq-ABCDEFGHIJKLMNOPQRSTUVWX",
    server_url: "https://headscale.example.test",
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  });
}

function qrRequest(qrData = qrPayload(), user = "alice") {
  const form = new FormData();
  form.set("qr_data", qrData);
  form.set("user", user);

  return new Request("http://headplane.test/machines/scan-qr", {
    method: "POST",
    body: form,
  });
}

function createContext(canWriteMachines: boolean) {
  const require = vi.fn().mockResolvedValue(principal);
  const can = vi.fn(() => canWriteMachines);
  const get = vi.fn().mockResolvedValue({
    data: [
      { id: "1", name: "alice" },
      { id: "2", name: "bob" },
    ],
  });
  const refresh = vi.fn().mockResolvedValue(undefined);
  const record = vi.fn().mockResolvedValue(undefined);
  const register = vi.fn().mockResolvedValue({ id: "42", givenName: "laptop" });
  const api = { nodes: { register } };
  const requestApi = vi.fn().mockResolvedValue({ principal, api });
  const context = new RouterContextProvider();

  context.set(authContext, { require, can } as never);
  context.set(headscaleLiveStoreContext, { get, refresh } as never);
  context.set(auditContext, { record } as never);
  context.set(requestApiContext, requestApi as never);

  return { api, can, context, get, record, refresh, register, requestApi, require };
}

describe("scan QR route authorization", () => {
  test("does not expose selectable users without machine-write permission", async () => {
    const { can, context, get, requestApi, require } = createContext(false);

    await expect(
      loader({
        request: new Request("http://headplane.test/machines/scan-qr"),
        context,
        params: {},
      } as never),
    ).rejects.toMatchObject({
      type: "DataWithResponseInit",
      data: "You do not have permission to register machines",
      init: { status: 403 },
    });

    expect(require).toHaveBeenCalledOnce();
    expect(can).toHaveBeenCalledWith(principal, Capabilities.write_machines);
    expect(requestApi).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  test("returns Headscale users only to machine-write principals", async () => {
    const { api, can, context, get, requestApi } = createContext(true);

    await expect(
      loader({
        request: new Request("http://headplane.test/machines/scan-qr"),
        context,
        params: {},
      } as never),
    ).resolves.toEqual({
      users: [
        { id: "1", name: "alice" },
        { id: "2", name: "bob" },
      ],
    });

    expect(can).toHaveBeenCalledWith(principal, Capabilities.write_machines);
    expect(requestApi).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledWith(usersResource, api);
  });

  test("does not submit a scanned payload without machine-write permission", async () => {
    const { can, context, record, refresh, register } = createContext(false);

    await expect(
      action({ request: qrRequest(), context, params: {} } as never),
    ).rejects.toMatchObject({
      type: "DataWithResponseInit",
      data: "You do not have permission to register machines",
      init: { status: 403 },
    });

    expect(can).toHaveBeenCalledWith(principal, Capabilities.write_machines);
    expect(register).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  test("registers through the configured API client and records the QR method", async () => {
    const { api, can, context, record, refresh, register } = createContext(true);

    const response = await action({ request: qrRequest(), context, params: {} } as never);

    expect(can).toHaveBeenCalledWith(principal, Capabilities.write_machines);
    expect(register).toHaveBeenCalledWith("alice", "hskey-authreq-ABCDEFGHIJKLMNOPQRSTUVWX");
    expect(refresh).toHaveBeenCalledWith(nodesResource, api);
    expect(record).toHaveBeenCalledWith({
      actorId: null,
      actorName: "test-key",
      action: "machine.register",
      resourceType: "machine",
      resourceId: "42",
      details: { name: "laptop", user: "alice", method: "qr_code" },
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe("/machines/42");
  });
});
