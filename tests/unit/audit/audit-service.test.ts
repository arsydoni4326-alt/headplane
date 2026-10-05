import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { beforeEach, describe, expect, test } from "vitest";

import { actorFromPrincipal, createAuditService, type AuditService } from "~/server/audit";
import type { Principal } from "~/server/web/auth";

function createTestAudit() {
  const db = drizzle(":memory:");
  migrate(db, { migrationsFolder: "./drizzle" });
  return { audit: createAuditService(db), db };
}

describe("audit service", () => {
  let audit: AuditService;

  beforeEach(() => {
    ({ audit } = createTestAudit());
  });

  test("record inserts an entry that list returns", async () => {
    await audit.record({
      actorId: "user-1",
      actorName: "Alice",
      action: "machine.rename",
      resourceType: "machine",
      resourceId: "node-1",
      details: { from: "old", to: "new" },
    });

    const { records, total } = await audit.list();
    expect(total).toBe(1);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      actorId: "user-1",
      actorName: "Alice",
      action: "machine.rename",
      resourceType: "machine",
      resourceId: "node-1",
      details: { from: "old", to: "new" },
    });
    expect(records[0].createdAt).toBeInstanceOf(Date);
  });

  test("record without optional fields stores nulls", async () => {
    await audit.record({
      actorName: "API key",
      action: "acl.update",
      resourceType: "acl",
    });

    const { records } = await audit.list();
    expect(records[0]).toMatchObject({
      actorId: null,
      actorName: "API key",
      resourceId: null,
      details: null,
    });
  });

  test("list returns entries newest first", async () => {
    const base = Date.now();
    for (let i = 0; i < 3; i++) {
      await audit.record({
        actorName: `Actor ${i}`,
        action: "machine.expire",
        resourceType: "machine",
        createdAt: new Date(base + i * 1000),
      });
    }

    const { records } = await audit.list();
    expect(records.map((r) => r.actorName)).toEqual(["Actor 2", "Actor 1", "Actor 0"]);
  });

  test("list filters by action", async () => {
    await audit.record({ actorName: "A", action: "machine.expire", resourceType: "machine" });
    await audit.record({ actorName: "A", action: "machine.delete", resourceType: "machine" });

    const { records, total } = await audit.list({ action: "machine.expire" });
    expect(total).toBe(1);
    expect(records[0].action).toBe("machine.expire");
  });

  test("list filters by actor name", async () => {
    await audit.record({ actorName: "Alice", action: "machine.expire", resourceType: "machine" });
    await audit.record({ actorName: "Bob", action: "machine.expire", resourceType: "machine" });

    const { records, total } = await audit.list({ actorName: "Bob" });
    expect(total).toBe(1);
    expect(records[0].actorName).toBe("Bob");
  });

  test("list paginates with limit and offset", async () => {
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      await audit.record({
        actorName: `A${i}`,
        action: "machine.expire",
        resourceType: "machine",
        createdAt: new Date(base + i * 1000),
      });
    }

    const first = await audit.list({ limit: 2, offset: 0 });
    expect(first.records).toHaveLength(2);
    expect(first.total).toBe(5);
    expect(first.records.map((r) => r.actorName)).toEqual(["A4", "A3"]);

    const second = await audit.list({ limit: 2, offset: 2 });
    expect(second.records.map((r) => r.actorName)).toEqual(["A2", "A1"]);
  });
});

describe("actorFromPrincipal", () => {
  test("user principal uses profile name", () => {
    const principal: Principal = {
      kind: "oidc",
      sessionId: "s1",
      user: { id: "u1", subject: "sub-1", role: "admin", headscaleUserId: "hs-1" },
      profile: { name: "Alice", email: "alice@example.com" },
    };

    expect(actorFromPrincipal(principal)).toEqual({ actorId: "u1", actorName: "Alice" });
  });

  test("user principal falls back to email when name is missing", () => {
    const principal: Principal = {
      kind: "oidc",
      sessionId: "s1",
      user: { id: "u1", subject: "sub-1", role: "admin", headscaleUserId: "hs-1" },
      profile: { name: "", email: "alice@example.com" },
    };

    expect(actorFromPrincipal(principal)).toEqual({
      actorId: "u1",
      actorName: "alice@example.com",
    });
  });

  test("api key principal uses display name and no actor id", () => {
    const principal: Principal = {
      kind: "api_key",
      sessionId: "s1",
      displayName: "deploy-key",
      apiKey: "hskey-api-...",
    };

    expect(actorFromPrincipal(principal)).toEqual({ actorId: null, actorName: "deploy-key" });
  });

  test("password principal uses its username and no actor id", () => {
    const principal: Principal = {
      kind: "password",
      sessionId: "s1",
      token: "session-token",
      username: "admin",
    };

    expect(actorFromPrincipal(principal)).toEqual({ actorId: null, actorName: "admin" });
  });
});
