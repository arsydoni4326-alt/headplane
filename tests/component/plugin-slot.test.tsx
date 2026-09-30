import { render, screen } from "@testing-library/react";
import { describe, expect, test, beforeEach } from "vitest";

import { PluginSlot } from "~/plugins/PluginSlot";
import { PluginProvider } from "~/plugins/PluginProvider";
import { pluginRegistry } from "~/plugins/registry";
import type { Plugin } from "~/plugins/types";

describe("PluginSlot", () => {
  beforeEach(() => {
    pluginRegistry.clear();
  });

  test("renders widgets for the specified slot", async () => {
    const TestWidget = () => <div data-testid="test-widget">Test Widget</div>;

    const plugin: Plugin = {
      metadata: { id: "test-plugin", name: "Test", version: "1.0.0" },
      widgets: [
        {
          slot: "dashboard",
          component: TestWidget,
        },
      ],
    };

    await pluginRegistry.register(() => plugin);
    await pluginRegistry.initialize();

    render(
      <PluginProvider>
        <PluginSlot slot="dashboard" />
      </PluginProvider>
    );

    // Wait for the widget to appear
    const widget = await screen.findByTestId("test-widget");
    expect(widget).toBeInTheDocument();
  });

  test("renders nothing when no widgets are registered", () => {
    const { container } = render(
      <PluginProvider>
        <PluginSlot slot="dashboard" />
      </PluginProvider>
    );

    expect(container.firstChild).toBeNull();
  });

  test("renders widgets in priority order", async () => {
    const Widget1 = () => <div data-testid="widget-1">Widget 1</div>;
    const Widget2 = () => <div data-testid="widget-2">Widget 2</div>;
    const Widget3 = () => <div data-testid="widget-3">Widget 3</div>;

    const plugin: Plugin = {
      metadata: { id: "multi-widget", name: "Multi", version: "1.0.0" },
      widgets: [
        { slot: "dashboard", component: Widget2, priority: 5 },
        { slot: "dashboard", component: Widget1, priority: 10 },
        { slot: "dashboard", component: Widget3, priority: 1 },
      ],
    };

    await pluginRegistry.register(() => plugin);
    await pluginRegistry.initialize();

    render(
      <PluginProvider>
        <PluginSlot slot="dashboard" />
      </PluginProvider>
    );

    const widgets = await screen.findAllByTestId(/^widget-/);
    expect(widgets).toHaveLength(3);

    // Check order: priority 10, 5, 1
    expect(widgets[0]).toHaveAttribute("data-testid", "widget-1");
    expect(widgets[1]).toHaveAttribute("data-testid", "widget-2");
    expect(widgets[2]).toHaveAttribute("data-testid", "widget-3");
  });

  test("passes context to widgets", async () => {
    const ContextWidget = ({ context }: { context?: Record<string, unknown> }) => (
      <div data-testid="context-widget">{context?.testValue as string}</div>
    );

    const plugin: Plugin = {
      metadata: { id: "context-plugin", name: "Context", version: "1.0.0" },
      widgets: [
        {
          slot: "dashboard",
          component: ContextWidget,
        },
      ],
    };

    await pluginRegistry.register(() => plugin);
    await pluginRegistry.initialize();

    render(
      <PluginProvider>
        <PluginSlot slot="dashboard" context={{ testValue: "Hello Context" }} />
      </PluginProvider>
    );

    const widget = await screen.findByTestId("context-widget");
    expect(widget).toHaveTextContent("Hello Context");
  });

  test("applies wrapper component when provided", async () => {
    const TestWidget = () => <div data-testid="test-widget">Widget</div>;
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <div data-testid="wrapper">{children}</div>
    );

    const plugin: Plugin = {
      metadata: { id: "wrapper-test", name: "Wrapper", version: "1.0.0" },
      widgets: [
        {
          slot: "dashboard",
          component: TestWidget,
        },
      ],
    };

    await pluginRegistry.register(() => plugin);
    await pluginRegistry.initialize();

    render(
      <PluginProvider>
        <PluginSlot slot="dashboard" wrapper={Wrapper} />
      </PluginProvider>
    );

    const wrapper = await screen.findByTestId("wrapper");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toContainElement(screen.getByTestId("test-widget"));
  });

  test("only renders widgets for the correct slot", async () => {
    const DashboardWidget = () => <div data-testid="dashboard-widget">Dashboard</div>;
    const HeaderWidget = () => <div data-testid="header-widget">Header</div>;

    const plugin: Plugin = {
      metadata: { id: "multi-slot", name: "Multi", version: "1.0.0" },
      widgets: [
        { slot: "dashboard", component: DashboardWidget },
        { slot: "header", component: HeaderWidget },
      ],
    };

    await pluginRegistry.register(() => plugin);
    await pluginRegistry.initialize();

    render(
      <PluginProvider>
        <PluginSlot slot="dashboard" />
      </PluginProvider>
    );

    const dashboardWidget = await screen.findByTestId("dashboard-widget");
    expect(dashboardWidget).toBeInTheDocument();
    expect(screen.queryByTestId("header-widget")).not.toBeInTheDocument();
  });
});
