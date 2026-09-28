import { describe, expect, test } from "vitest";

import type { Machine } from "~/types";
import { mapNodes } from "~/utils/node-info";
import { buildTopology, colorForGroup } from "~/utils/topology";

function makeMachine(overrides: Partial<Machine> & { id: string; name: string }): Machine {
  return {
    machineKey: "mkey",
    nodeKey: "nkey",
    discoKey: "dkey",
    ipAddresses: ["100.64.0.1"],
    lastSeen: new Date().toISOString(),
    expiry: null,
    createdAt: new Date().toISOString(),
    registerMethod: "REGISTER_METHOD_CLI",
    tags: [],
    givenName: overrides.name,
    online: true,
    approvedRoutes: [],
    availableRoutes: [],
    subnetRoutes: [],
    ...overrides,
  } as Machine;
}

function makeUser(id: string, name: string) {
  return { id, name, createdAt: new Date().toISOString() };
}

describe("buildTopology", () => {
  test("groups nodes by owner and lays them out", () => {
    const nodes = mapNodes([
      makeMachine({ id: "1", name: "alice-laptop", user: makeUser("u1", "alice") }),
      makeMachine({ id: "2", name: "bob-laptop", user: makeUser("u2", "bob") }),
      makeMachine({ id: "3", name: "tagged-node", user: undefined }),
    ]);

    const graph = buildTopology(nodes);

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(0);
    expect(graph.width).toBeGreaterThan(0);
    expect(graph.height).toBeGreaterThan(0);

    // All nodes are placed at distinct positions.
    const positions = new Set(graph.nodes.map((n) => `${n.x},${n.y}`));
    expect(positions.size).toBe(3);
  });

  test("adds subnet nodes and edges for subnet routers", () => {
    const nodes = mapNodes([
      makeMachine({
        id: "1",
        name: "router",
        user: makeUser("u1", "alice"),
        availableRoutes: ["192.168.1.0/24"],
        approvedRoutes: ["192.168.1.0/24"],
      }),
    ]);

    const graph = buildTopology(nodes);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes.filter((n) => n.kind === "subnet")).toHaveLength(1);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ from: "1", kind: "subnet" });
  });

  test("flags exit nodes", () => {
    const nodes = mapNodes([
      makeMachine({
        id: "1",
        name: "exit",
        user: makeUser("u1", "alice"),
        availableRoutes: ["0.0.0.0/0", "::/0"],
        approvedRoutes: ["0.0.0.0/0", "::/0"],
      }),
    ]);

    const graph = buildTopology(nodes);

    const exitNode = graph.nodes.find((n) => n.id === "1");
    expect(exitNode?.isExitNode).toBe(true);
  });

  test("marks expired nodes", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const nodes = mapNodes([
      makeMachine({ id: "1", name: "old", user: makeUser("u1", "alice"), expiry: past }),
    ]);

    const graph = buildTopology(nodes);

    expect(graph.nodes[0].isExpired).toBe(true);
    expect(graph.nodes[0].isOnline).toBe(false);
  });

  test("handles an empty node list", () => {
    const graph = buildTopology([]);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
    expect(graph.width).toBeGreaterThan(0);
    expect(graph.height).toBeGreaterThan(0);
  });
});

describe("colorForGroup", () => {
  test("is deterministic for the same group", () => {
    expect(colorForGroup("alice")).toBe(colorForGroup("alice"));
  });

  test("returns a color from the palette", () => {
    const color = colorForGroup("alice");
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
