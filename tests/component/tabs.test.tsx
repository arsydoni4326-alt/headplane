import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { Tabs, TabsList, TabsTab, TabsPanel } from "~/components/tabs";

describe("Tabs", () => {
  test("renders tabs and panels", () => {
    render(
      <Tabs label="Test tabs">
        <TabsList>
          <TabsTab value="a">Tab A</TabsTab>
          <TabsTab value="b">Tab B</TabsTab>
        </TabsList>
        <TabsPanel value="a">Content A</TabsPanel>
        <TabsPanel value="b">Content B</TabsPanel>
      </Tabs>,
    );

    expect(screen.getByText("Tab A")).toBeInTheDocument();
    expect(screen.getByText("Tab B")).toBeInTheDocument();
  });

  test("switches tab on click", async () => {
    render(
      <Tabs label="Test tabs">
        <TabsList>
          <TabsTab value="a">Tab A</TabsTab>
          <TabsTab value="b">Tab B</TabsTab>
        </TabsList>
        <TabsPanel value="a">Content A</TabsPanel>
        <TabsPanel value="b">Content B</TabsPanel>
      </Tabs>,
    );

    // Click Tab B
    await userEvent.click(screen.getByText("Tab B"));
    // Content B should be visible
    expect(screen.getByText("Content B")).toBeInTheDocument();
  });

  test("calls onValueChange when tab changes", async () => {
    const handleChange = vi.fn();
    render(
      <Tabs label="Test tabs" onValueChange={handleChange}>
        <TabsList>
          <TabsTab value="a">Tab A</TabsTab>
          <TabsTab value="b">Tab B</TabsTab>
        </TabsList>
        <TabsPanel value="a">Content A</TabsPanel>
        <TabsPanel value="b">Content B</TabsPanel>
      </Tabs>,
    );

    // onValueChange may be called on mount with the default value (0 → "a")
    // Clear those initial calls.
    handleChange.mockClear();

    await userEvent.click(screen.getByText("Tab B"));
    // The actual value should be "b" (the second call's first argument)
    const calls = handleChange.mock.calls.filter((call) => call[0] === "b");
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });
});
