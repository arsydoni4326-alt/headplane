import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { PluginProvider, usePlugins, useActivePlugins } from "~/plugins/PluginProvider";
import { pluginRegistry } from "~/plugins/registry";
import type { Plugin } from "~/plugins/types";

describe("PluginProvider", () => {
  test("provides plugin context to children", async () => {
    const TestComponent = () => {
      const { plugins, initialized } = usePlugins();
      return (
        <div>
          <div data-testid="plugin-count">{plugins.length}</div>
          <div data-testid="initialized">{initialized ? "yes" : "no"}</div>
        </div>
      );
    };

    render(
      <PluginProvider>
        <TestComponent />
      </PluginProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("initialized")).toHaveTextContent("yes");
    });
  });

  test("throws error when usePlugins is used outside provider", () => {
    const TestComponent = () => {
      usePlugins();
      return null;
    };

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TestComponent />)).toThrow(
      "usePlugins must be used within a PluginProvider"
    );

    consoleSpy.mockRestore();
  });

  test("useActivePlugins filters active plugins", async () => {
    // Clear registry before test
    pluginRegistry.clear();

    // Register test plugins
    const activePlugin: Plugin = {
      metadata: { id: "active-plugin", name: "Active", version: "1.0.0" },
    };

    await pluginRegistry.register(() => activePlugin);

    const TestComponent = () => {
      const activePlugins = useActivePlugins();
      return <div data-testid="active-count">{activePlugins.length}</div>;
    };

    render(
      <PluginProvider>
        <TestComponent />
      </PluginProvider>
    );

    await waitFor(() => {
      const element = screen.getByTestId("active-count");
      expect(element).toHaveTextContent("1");
    });

    // Clean up
    pluginRegistry.clear();
  });
});
