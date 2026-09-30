import { describe, expect, test, beforeEach, afterEach } from "vitest";

import { PluginRegistry } from "~/plugins/registry";
import type { Plugin, PluginRegistration } from "~/plugins/types";

describe("PluginRegistry", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  const createMockPlugin = (id: string, overrides?: Partial<Plugin>): Plugin => ({
    metadata: {
      id,
      name: `Test Plugin ${id}`,
      version: "1.0.0",
    },
    ...overrides,
  });

  test("registers a plugin successfully", async () => {
    const plugin = createMockPlugin("test-plugin");
    const registration: PluginRegistration = () => plugin;

    await registry.register(registration);

    expect(registry.get("test-plugin")).toBeDefined();
    expect(registry.get("test-plugin")?.status).toBe("active");
  });

  test("rejects duplicate plugin IDs", async () => {
    const plugin1 = createMockPlugin("duplicate-id");
    const plugin2 = createMockPlugin("duplicate-id");

    await registry.register(() => plugin1);

    await expect(registry.register(() => plugin2)).rejects.toThrow(
      'Plugin with id "duplicate-id" is already registered',
    );
  });

  test("rejects plugins without an ID", async () => {
    const plugin = { metadata: { id: "", name: "No ID", version: "1.0.0" } };

    await expect(registry.register(() => plugin)).rejects.toThrow("Plugin must have an id");
  });

  test("validates route paths start with /plugins/", async () => {
    const plugin = createMockPlugin("bad-route", {
      routes: [{ path: "/invalid-path", component: () => null }],
    });

    await expect(registry.register(() => plugin)).rejects.toThrow(
      'Plugin route paths must start with "/plugins/"',
    );
  });

  test("validates navigation paths start with /plugins/", async () => {
    const plugin = createMockPlugin("bad-nav", {
      navigation: [{ label: "Bad Nav", path: "/invalid-path" }],
    });

    await expect(registry.register(() => plugin)).rejects.toThrow(
      'Plugin navigation paths must start with "/plugins/"',
    );
  });

  test("calls lifecycle hooks in correct order", async () => {
    const calls: string[] = [];

    const plugin = createMockPlugin("lifecycle-test", {
      lifecycle: {
        onLoad: () => {
          calls.push("onLoad");
        },
        onReady: () => {
          calls.push("onReady");
        },
      },
    });

    await registry.register(() => plugin);
    await registry.initialize();

    expect(calls).toEqual(["onLoad", "onReady"]);
  });

  test("handles async lifecycle hooks", async () => {
    let loaded = false;

    const plugin = createMockPlugin("async-test", {
      lifecycle: {
        onLoad: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          loaded = true;
        },
      },
    });

    await registry.register(() => plugin);

    expect(loaded).toBe(true);
  });

  test("getAll returns all plugins", async () => {
    await registry.register(() => createMockPlugin("plugin-1"));
    await registry.register(() => createMockPlugin("plugin-2"));
    await registry.register(() => createMockPlugin("plugin-3"));

    const all = registry.getAll();

    expect(all).toHaveLength(3);
    expect(all.map((p) => p.plugin.metadata.id)).toContain("plugin-1");
    expect(all.map((p) => p.plugin.metadata.id)).toContain("plugin-2");
    expect(all.map((p) => p.plugin.metadata.id)).toContain("plugin-3");
  });

  test("getActive returns only active plugins", async () => {
    const plugin1 = createMockPlugin("active-1");
    const plugin2 = createMockPlugin("will-error", {
      lifecycle: {
        onReady: async () => {
          throw new Error("Test error");
        },
      },
    });

    await registry.register(() => plugin1);
    await registry.register(() => plugin2);
    await registry.initialize();

    const active = registry.getActive();

    expect(active).toHaveLength(1);
    expect(active[0].plugin.metadata.id).toBe("active-1");
  });

  test("isActive checks plugin status", async () => {
    await registry.register(() => createMockPlugin("active-plugin"));

    expect(registry.isActive("active-plugin")).toBe(true);
    expect(registry.isActive("non-existent")).toBe(false);
  });

  test("unregister calls onUnload hook", async () => {
    let unloaded = false;

    const plugin = createMockPlugin("unregister-test", {
      lifecycle: {
        onUnload: () => {
          unloaded = true;
        },
      },
    });

    await registry.register(() => plugin);
    await registry.unregister("unregister-test");

    expect(unloaded).toBe(true);
    expect(registry.get("unregister-test")).toBeUndefined();
  });

  test("initialize only runs once", async () => {
    let readyCallCount = 0;

    const plugin = createMockPlugin("init-test", {
      lifecycle: {
        onReady: () => {
          readyCallCount++;
        },
      },
    });

    await registry.register(() => plugin);
    await registry.initialize();
    await registry.initialize();
    await registry.initialize();

    expect(readyCallCount).toBe(1);
  });

  test("clear removes all plugins", async () => {
    await registry.register(() => createMockPlugin("plugin-1"));
    await registry.register(() => createMockPlugin("plugin-2"));

    registry.clear();

    expect(registry.getAll()).toHaveLength(0);
  });
});
