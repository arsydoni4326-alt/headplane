import { RouterContextProvider } from "react-router";
import { describe, expect, test, vi } from "vitest";

import { machineAction } from "~/routes/machines/machine-actions";
import { action as scanQRAction } from "~/routes/machines/scan-qr";
import {
  auditContext,
  authContext,
  headscaleLiveStoreContext,
  requestApiContext,
} from "~/server/context";
import { nodesResource } from "~/server/headscale/live-store";
import type { Principal } from "~/server/web/auth";
import { Capabilities } from "~/server/web/roles";
import { normalizeRegistrationKey } from "~/utils/register-key";

import { getBootstrapClient, getNode, getRuntimeClient, HS_VERSIONS } from "../setup/env";

function qrRegisterRequest(qrData: string, user = "node-qr@") {
  const form = new FormData();
  form.set("qr_data", qrData);
  form.set("user", user);

  return new Request("http://headplane.test/machines/scan-qr", {
    method: "POST",
    body: form,
  });
}

function qrRegistrationPayload(authId: string, serverUrl: string, expiresAt: string) {
  return JSON.stringify({
    type: "headscale-registration",
    version: "1",
    auth_id: authId,
    server_url: serverUrl,
    expires_at: expiresAt,
  });
}

function actionContext(api: Awaited<ReturnType<typeof getRuntimeClient>>) {
  const auth = { can: vi.fn(() => true) };
  const liveStore = { refresh: vi.fn() };
  const audit = { record: vi.fn().mockResolvedValue(undefined), list: vi.fn() };
  const principal: Principal = {
    kind: "oidc",
    sessionId: "integration-session",
    user: {
      id: "integration-user",
      subject: "integration-subject",
      role: "admin",
      headscaleUserId: undefined,
    },
    profile: {
      name: "Integration User",
    },
  };
  const context = new RouterContextProvider();

  context.set(auditContext, audit as never);
  context.set(authContext, auth as never);
  context.set(headscaleLiveStoreContext, liveStore as never);
  context.set(requestApiContext, vi.fn(async () => ({ principal, api })) as never);

  return { audit, auth, context, liveStore };
}

describe.for(HS_VERSIONS)("Headscale %s: Users", { concurrent: false }, (version) => {
  let workingNodeId: string;

  test("pending nodes can register through a QR payload", async () => {
    const client = await getRuntimeClient(version);
    const tailnetNode = await getNode(version);
    const { audit, auth, context, liveStore } = actionContext(client);
    const user = await client.users.create({ name: "node-qr@" });
    const payload = qrRegistrationPayload(
      tailnetNode.authCode,
      new URL(tailnetNode.registerUrl).origin,
      new Date(Date.now() + 5 * 60_000).toISOString(),
    );
    const register = vi.spyOn(client.nodes, "register");

    const response = await scanQRAction({
      request: qrRegisterRequest(payload, user.name),
      context,
      params: {},
    } as never);

    expect(auth.can).toHaveBeenCalledWith(expect.anything(), Capabilities.write_machines);
    expect(liveStore.refresh).toHaveBeenCalledWith(nodesResource, client);
    expect(liveStore.refresh).toHaveBeenCalledOnce();
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);

    const nodes = await client.nodes.list();
    const matchingNodes = nodes.filter((node) => node.name === tailnetNode.nodeName);
    expect(matchingNodes).toHaveLength(1);
    const node = matchingNodes[0]!;
    expect(node.user?.name).toBe(user.name);
    expect((response as Response).headers.get("Location")).toBe(`/machines/${node.id}`);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "machine.register",
        resourceType: "machine",
        resourceId: node.id,
        details: { name: node.givenName, user: user.name, method: "qr_code" },
      }),
    );
    expect(register).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledWith(
      user.name,
      normalizeRegistrationKey(tailnetNode.authCode),
    );

    await expect(
      scanQRAction({
        request: qrRegisterRequest(payload, user.name),
        context,
        params: {},
      } as never),
    ).rejects.toMatchObject({
      type: "DataWithResponseInit",
      init: { status: 500 },
    });

    expect(register).toHaveBeenCalledTimes(2);
    const nodesAfterReplay = await client.nodes.list();
    expect(
      nodesAfterReplay.filter((candidate) => candidate.name === tailnetNode.nodeName),
    ).toHaveLength(1);
    register.mockRestore();
  });

  test("invalid QR payloads do not call Headscale registration", async () => {
    const client = await getRuntimeClient(version);
    const register = vi.spyOn(client.nodes, "register");
    const future = new Date(Date.now() + 5 * 60_000).toISOString();
    const validFields = {
      type: "headscale-registration",
      version: "1",
      auth_id: "hskey-authreq-valid-payload-key",
      server_url: "https://headscale.example.test",
      expires_at: future,
    };
    const cases = [
      {
        name: "malformed",
        payload: "not-json",
        error: "Invalid QR code format",
      },
      {
        name: "missing type",
        payload: JSON.stringify({ ...validFields, type: undefined }),
        error: "Invalid QR code type",
      },
      {
        name: "unsupported type",
        payload: JSON.stringify({ ...validFields, type: "other-registration" }),
        error: "Invalid QR code type",
      },
      {
        name: "missing version",
        payload: JSON.stringify({ ...validFields, version: undefined }),
        error: "Unsupported QR code version",
      },
      {
        name: "unsupported version",
        payload: JSON.stringify({ ...validFields, version: "2" }),
        error: "Unsupported QR code version",
      },
      {
        name: "expired",
        payload: JSON.stringify({ ...validFields, expires_at: new Date(0).toISOString() }),
        error: "QR code has expired. Start registration again to get a new code.",
      },
      {
        name: "missing auth ID",
        payload: JSON.stringify({ ...validFields, auth_id: undefined }),
        error: "Missing auth_id in QR code",
      },
      {
        name: "missing server URL",
        payload: JSON.stringify({ ...validFields, server_url: undefined }),
        error: "Missing server_url in QR code",
      },
      {
        name: "missing expiration",
        payload: JSON.stringify({ ...validFields, expires_at: undefined }),
        error: "Invalid QR code expiration",
      },
    ];

    for (const invalid of cases) {
      const { context } = actionContext(client);
      await expect(
        scanQRAction({
          request: qrRegisterRequest(invalid.payload),
          context,
          params: {},
        } as never),
      ).rejects.toMatchObject({
        type: "DataWithResponseInit",
        data: invalid.error,
        init: { status: 400 },
      });
    }

    expect(register).not.toHaveBeenCalled();
    register.mockRestore();
  });

  test("nodes can be retrieved", async () => {
    const client = await getRuntimeClient(version);
    const { nodeName } = await getNode(version);
    const nodes = await client.nodes.list();
    const node = nodes.find((n) => n.name === nodeName);
    expect(node).toBeDefined();
    expect(node?.name).toBe(nodeName);

    const fetchedNode = await client.nodes.get(node!.id);
    expect(fetchedNode).toBeDefined();
    expect(fetchedNode.id).toBe(node!.id);
    workingNodeId = node!.id;
  });

  test("nodes can be renamed", async () => {
    const client = await getRuntimeClient(version);
    const { nodeName } = await getNode(version);
    const newName = `${nodeName}-renamed`;

    await client.nodes.rename(workingNodeId, newName);
    const renamedNode = await client.nodes.get(workingNodeId);
    expect(renamedNode).toBeDefined();
    expect(renamedNode.givenName).toBe(newName);
  });

  test("nodes can be reassigned to another user", async (context) => {
    const bootstrap = await getBootstrapClient(version);
    // Reassigning a node owner was removed in 0.28.
    if (bootstrap.capabilities.nodeOwnerIsImmutable) {
      context.skip();
    }

    const client = await getRuntimeClient(version);
    const user = await client.users.create({ name: "node-reassign@" });

    // reassignUser is only defined on pre-0.28 clients, hence the guard above.
    await client.nodes.reassignUser!(workingNodeId, user.id);
    const reassignedNode = await client.nodes.get(workingNodeId);
    expect(reassignedNode).toBeDefined();
    expect(reassignedNode.user?.name).toBe(user.name);
  });

  test("nodes can be expired", async () => {
    const client = await getRuntimeClient(version);
    await client.nodes.expire(workingNodeId);

    const expiredNode = await client.nodes.get(workingNodeId);
    expect(expiredNode).toBeDefined();
    expect(expiredNode.expiry).toBeDefined();
  });

  test("node keys can be rotated via the machine action", async () => {
    const client = await getRuntimeClient(version);
    const { audit, context } = actionContext(client);

    const form = new FormData();
    form.set("action_id", "rotate_key");
    form.set("node_id", workingNodeId);

    const response = await machineAction({
      request: new Request("http://headplane.test/machines", {
        method: "POST",
        body: form,
      }),
      context,
      params: {},
    } as never);

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "machine.rotate_key",
        resourceType: "machine",
        resourceId: workingNodeId,
      }),
    );
    expect(response).toEqual(
      expect.objectContaining({
        message: "Key rotated — the machine must re-authenticate",
      }),
    );
  });

  test("key expiry of nodes can be toggled", async (context) => {
    const bootstrap = await getBootstrapClient(version);
    // Key expiry was introduced in 0.29.0
    if (!bootstrap.capabilities.keyExpiryCanBeDisabled) {
      context.skip();
    }

    const client = await getRuntimeClient(version);
    await client.nodes.toggleExpiry(workingNodeId, true);

    const permanentNode = await client.nodes.get(workingNodeId);
    expect(permanentNode).toBeDefined();
    expect(permanentNode.expiry).toBeNull();

    await client.nodes.toggleExpiry(workingNodeId, false);

    const node = await client.nodes.get(workingNodeId);
    expect(node).toBeDefined();
    expect(node.expiry).not.toBeNull();
  });

  test("nodes can be deleted", async () => {
    const client = await getRuntimeClient(version);
    await client.nodes.delete(workingNodeId);

    const nodes = await client.nodes.list();
    const node = nodes.find((n) => n.id === workingNodeId);
    expect(node).toBeUndefined();
  });
});
